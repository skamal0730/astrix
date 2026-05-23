require("dotenv").config();

const { Client, TopicId, TopicMessageQuery } = require("@hashgraph/sdk");
const { ethers } = require("ethers");
const { z } = require("zod");
const { testnetDefaults, requireEnv: cfgEnv } = require("../config/loadTestnet");

const testnet = testnetDefaults();

const solverIntentSchema = z.object({
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

const settlementAbi = [
  "function settle((uint256 intentId,address signer,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 deadline,uint256 nonce,address receiver,uint256 chainId) intent, bytes signature, bytes path) external returns (uint256 amountOut)",
];

function requireEnv(name, fallback) {
  return cfgEnv(name, fallback);
}

function computeProfitabilityBps(amountIn, minAmountOut) {
  if (amountIn === 0n) return -10000n;
  return (minAmountOut * 10_000n) / amountIn - 10_000n;
}

function normalizeIntent(raw) {
  const parsed = solverIntentSchema.parse(raw);
  return {
    requestId: raw.requestId ? String(raw.requestId) : undefined,
    intentId: BigInt(parsed.intentId),
    signer: parsed.signer,
    tokenIn: parsed.tokenIn,
    tokenOut: parsed.tokenOut,
    amountIn: BigInt(parsed.amountIn),
    minAmountOut: BigInt(parsed.minAmountOut),
    deadline: BigInt(parsed.deadline),
    nonce: BigInt(parsed.nonce),
    receiver: parsed.receiver,
    chainId: BigInt(parsed.chainId),
    signature: parsed.signature,
  };
}

async function pushStatus(requestId, patch) {
  const backendUrl = process.env.BACKEND_STATUS_URL || "http://localhost:3001";
  if (!requestId) return;
  try {
    await fetch(`${backendUrl}/api/status/update`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requestId, ...patch }),
    });
  } catch (_err) {
    // Best effort status update; solver should continue even if backend is unavailable.
  }
}

async function startSolver() {
  const topicId = TopicId.fromString(requireEnv("HCS_TOPIC_ID"));
  const rpcUrl = requireEnv("HEDERA_RPC_URL");
  const privateKey = requireEnv("SOLVER_PRIVATE_KEY");
  const settlementAddress = requireEnv("SETTLEMENT_CONTRACT");
  const whbar = requireEnv("WHBAR_TOKEN", testnet.whbarEvm);
  const usdc = requireEnv("USDC_TOKEN", testnet.usdcEvm);
  const poolFee = Number(process.env.POOL_FEE || testnet.poolFee);
  const expectedChainId = BigInt(process.env.CHAIN_ID || testnet.chainId);
  const minProfitBps = BigInt(process.env.MIN_PROFIT_BPS || "0");

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const settlement = new ethers.Contract(settlementAddress, settlementAbi, wallet);

  const client = Client.forTestnet();

  console.log(
    JSON.stringify(
      {
        action: "solver-started",
        topicId: topicId.toString(),
        settlementAddress,
        signer: wallet.address,
      },
      null,
      2
    )
  );

  new TopicMessageQuery()
    .setTopicId(topicId)
    .subscribe(client, async (message) => {
      try {
        const raw = JSON.parse(Buffer.from(message.contents).toString("utf8"));
        const intent = normalizeIntent(raw);

        if (intent.chainId !== expectedChainId) {
          await pushStatus(intent.requestId, { stage: "solver_skipped_chain", step: 4 });
          console.log(`Skipping intent ${intent.intentId}: chainId mismatch.`);
          return;
        }
        if (intent.deadline < BigInt(Math.floor(Date.now() / 1000))) {
          await pushStatus(intent.requestId, { stage: "solver_skipped_expired", step: 4 });
          console.log(`Skipping intent ${intent.intentId}: expired.`);
          return;
        }
        const tIn = intent.tokenIn.toLowerCase();
        const tOut = intent.tokenOut.toLowerCase();
        const whbarL = whbar.toLowerCase();
        const usdcL = usdc.toLowerCase();
        const isWhbarToUsdc = tIn === whbarL && tOut === usdcL;
        const isUsdcToWhbar = tIn === usdcL && tOut === whbarL;
        if (!isWhbarToUsdc && !isUsdcToWhbar) {
          await pushStatus(intent.requestId, { stage: "solver_skipped_pair", step: 4 });
          console.log(`Skipping intent ${intent.intentId}: unsupported pair.`);
          return;
        }

        const bps = computeProfitabilityBps(intent.amountIn, intent.minAmountOut);
        if (bps < minProfitBps) {
          await pushStatus(intent.requestId, { stage: "solver_skipped_profit", step: 4 });
          console.log(`Skipping intent ${intent.intentId}: below profitability threshold.`);
          return;
        }

        await pushStatus(intent.requestId, { stage: "solver_executing", step: 4 });
        const path = isWhbarToUsdc
          ? ethers.solidityPacked(["address", "uint24", "address"], [whbar, poolFee, usdc])
          : ethers.solidityPacked(["address", "uint24", "address"], [usdc, poolFee, whbar]);
        const tx = await settlement.settle(
          {
            intentId: intent.intentId,
            signer: intent.signer,
            tokenIn: intent.tokenIn,
            tokenOut: intent.tokenOut,
            amountIn: intent.amountIn,
            minAmountOut: intent.minAmountOut,
            deadline: intent.deadline,
            nonce: intent.nonce,
            receiver: intent.receiver,
            chainId: intent.chainId,
          },
          intent.signature,
          path
        );
        const receipt = await tx.wait();
        await pushStatus(intent.requestId, {
          stage: receipt?.status === 1 ? "settled" : "solver_failed",
          step: 4,
          settlementTxHash: tx.hash,
        });

        console.log(
          JSON.stringify(
            {
              action: "settled-intent",
              intentId: String(intent.intentId),
              txHash: tx.hash,
              status: receipt?.status,
            },
            null,
            2
          )
        );
      } catch (err) {
        console.error(`Failed to process topic message: ${err.message || err}`);
      }
    });
}

startSolver().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
