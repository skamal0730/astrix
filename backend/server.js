require("dotenv").config();

const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const {
  AccountId,
  Client,
  PrivateKey,
  TopicCreateTransaction,
  TopicId,
  TopicMessageSubmitTransaction,
} = require("@hashgraph/sdk");
const { z } = require("zod");

const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((s) => s.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: "50kb" }));
app.use(express.static("frontend"));

const intentSchema = z.object({
  intentId: z.union([z.string(), z.number()]),
  signer: z.string(),
  tokenIn: z.string(),
  tokenOut: z.string(),
  amountIn: z.union([z.string(), z.number()]),
  minAmountOut: z.union([z.string(), z.number()]),
  deadline: z.union([z.string(), z.number()]),
  nonce: z.union([z.string(), z.number()]),
  receiver: z.string(),
  chainId: z.union([z.string(), z.number()]),
  signature: z.string(),
});

const statusStore = new Map();
const statusStreams = new Map();

function getClient() {
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;
  if (!operatorId || !operatorKey) {
    throw new Error("Missing HEDERA_OPERATOR_ID/HEDERA_OPERATOR_KEY");
  }
  const client = Client.forTestnet();
  client.setOperator(AccountId.fromString(operatorId), PrivateKey.fromString(operatorKey));
  return client;
}

function upsertStatus(id, patch) {
  const prev = statusStore.get(id) || { id, createdAt: Date.now() };
  const next = { ...prev, ...patch, updatedAt: Date.now() };
  statusStore.set(id, next);
  const listeners = statusStreams.get(id);
  if (listeners) {
    const payload = `data: ${JSON.stringify(next)}\n\n`;
    for (const res of listeners) res.write(payload);
  }
  return next;
}

function hcsHashscanLink(txId) {
  return `https://hashscan.io/testnet/transaction/${encodeURIComponent(txId)}`;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, topicId: process.env.HCS_TOPIC_ID || null });
});

app.post("/api/hcs/create-topic", async (_req, res) => {
  try {
    const client = getClient();
    let tx = new TopicCreateTransaction().setTopicMemo("Astrix intents");
    if (process.env.HCS_SUBMIT_KEY) {
      const submitKey = PrivateKey.fromString(process.env.HCS_SUBMIT_KEY);
      tx = tx.setSubmitKey(submitKey.publicKey);
    }
    const receipt = await (await tx.execute(client)).getReceipt(client);
    res.json({ topicId: receipt.topicId?.toString() });
  } catch (err) {
    res.status(400).json({ error: err.message || String(err) });
  }
});

app.post("/api/intents/publish", async (req, res) => {
  try {
    const client = getClient();
    const topicId = process.env.HCS_TOPIC_ID;
    if (!topicId) throw new Error("Set HCS_TOPIC_ID in .env");

    const intent = intentSchema.parse(req.body);
    const payload = JSON.stringify(intent);
    if (Buffer.byteLength(payload, "utf8") > 1024) {
      throw new Error("Intent payload exceeds 1024 bytes");
    }

    let tx = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(payload);

    if (process.env.HCS_SUBMIT_KEY) {
      tx = await tx.freezeWith(client);
      tx = await tx.sign(PrivateKey.fromString(process.env.HCS_SUBMIT_KEY));
    }

    const submit = await tx.execute(client);
    const receipt = await submit.getReceipt(client);
    res.json({
      status: String(receipt.status),
      transactionId: submit.transactionId.toString(),
      topicId,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || String(err) });
  }
});

app.post("/api/broadcast", async (req, res) => {
  try {
    const client = getClient();
    const topicId = process.env.HCS_TOPIC_ID;
    if (!topicId) throw new Error("Set HCS_TOPIC_ID in .env");

    const payloadIn = req.body || {};
    const intent = intentSchema.parse(payloadIn.intent || payloadIn);
    const requestId = payloadIn.requestId || `${intent.intentId}-${crypto.randomUUID()}`;
    const payload = JSON.stringify({ ...intent, requestId });
    if (Buffer.byteLength(payload, "utf8") > 1024) {
      throw new Error("Intent payload exceeds 1024 bytes");
    }

    upsertStatus(requestId, {
      requestId,
      intentId: String(intent.intentId),
      step: 2,
      stage: "signed",
      signer: intent.signer,
      topicId,
    });

    let tx = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(payload);

    if (process.env.HCS_SUBMIT_KEY) {
      tx = await tx.freezeWith(client);
      tx = await tx.sign(PrivateKey.fromString(process.env.HCS_SUBMIT_KEY));
    }

    const submit = await tx.execute(client);
    const receipt = await submit.getReceipt(client);
    const txId = submit.transactionId.toString();

    const status = upsertStatus(requestId, {
      stage: "broadcasted",
      step: 3,
      hcsStatus: String(receipt.status),
      hcsTransactionId: txId,
      hashscanUrl: hcsHashscanLink(txId),
    });

    res.json({ requestId, topicId, ...status });
  } catch (err) {
    res.status(400).json({ error: err.message || String(err) });
  }
});

app.get("/api/intents/recent", (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 25, 100);
  const intents = Array.from(statusStore.values())
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, limit);
  res.json({ intents });
});

app.get("/api/status/:id", (req, res) => {
  const status = statusStore.get(req.params.id);
  if (!status) {
    return res.status(404).json({ error: "Status not found" });
  }
  res.json(status);
});

app.get("/api/status/:id/stream", (req, res) => {
  const { id } = req.params;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const current = statusStore.get(id);
  if (current) {
    res.write(`data: ${JSON.stringify(current)}\n\n`);
  }

  const listeners = statusStreams.get(id) || new Set();
  listeners.add(res);
  statusStreams.set(id, listeners);

  req.on("close", () => {
    const currentListeners = statusStreams.get(id);
    if (!currentListeners) return;
    currentListeners.delete(res);
    if (currentListeners.size === 0) statusStreams.delete(id);
  });
});

app.post("/api/status/update", (req, res) => {
  try {
    const { requestId, stage, step, settlementTxHash, error } = req.body || {};
    if (!requestId) throw new Error("requestId is required");
    const next = upsertStatus(requestId, {
      stage,
      step,
      settlementTxHash,
      settlementHashscanUrl: settlementTxHash
        ? `https://hashscan.io/testnet/transaction/${settlementTxHash}`
        : undefined,
      error,
    });
    res.json(next);
  } catch (err) {
    res.status(400).json({ error: err.message || String(err) });
  }
});

app.get("/api/balances/:accountId", async (req, res) => {
  try {
    const accountId = req.params.accountId;
    const usdcTokenId = process.env.USDC_TOKEN_ID || "0.0.429274";
    const mirrorBase = process.env.MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com/api/v1";

    const [hbarResp, tokenResp] = await Promise.all([
      fetch(`${mirrorBase}/balances?account.id=${accountId}`),
      fetch(`${mirrorBase}/accounts/${accountId}/tokens?token.id=${usdcTokenId}`),
    ]);

    if (!hbarResp.ok) throw new Error("Failed to fetch HBAR balance from mirror node");
    const hbarJson = await hbarResp.json();
    const hbar = hbarJson.balances?.[0]?.balance ?? 0;

    let usdc = 0;
    if (tokenResp.ok) {
      const tokenJson = await tokenResp.json();
      usdc = tokenJson.tokens?.[0]?.balance ?? 0;
    }

    res.json({ accountId, hbarTinybar: String(hbar), usdcUnits: String(usdc), usdcTokenId });
  } catch (err) {
    res.status(400).json({ error: err.message || String(err) });
  }
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`Astrix backend running on http://localhost:${port}`);
});
