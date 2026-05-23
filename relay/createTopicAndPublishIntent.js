require("dotenv").config();

const {
  AccountId,
  Client,
  PrivateKey,
  TopicCreateTransaction,
  TopicId,
  TopicMessageSubmitTransaction,
} = require("@hashgraph/sdk");
const { z } = require("zod");
const { testnetDefaults } = require("../config/loadTestnet");

const MAX_HCS_MESSAGE_BYTES = Number(
  process.env.MAX_HCS_MESSAGE_BYTES || testnetDefaults().maxHcsMessageBytes,
);

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
  signature: z.string().optional(),
});

function createClientFromEnv() {
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;
  if (!operatorId || !operatorKey) {
    throw new Error("Missing HEDERA_OPERATOR_ID or HEDERA_OPERATOR_KEY");
  }

  const client = Client.forTestnet();
  client.setOperator(AccountId.fromString(operatorId), PrivateKey.fromString(operatorKey));
  return client;
}

async function createTopic() {
  const client = createClientFromEnv();
  const submitKeyRaw = process.env.HCS_SUBMIT_KEY;
  let tx = new TopicCreateTransaction().setTopicMemo("Astrix intent relay topic");

  if (submitKeyRaw) {
    const submitKey = PrivateKey.fromString(submitKeyRaw);
    tx = tx.setSubmitKey(submitKey.publicKey);
  }

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);
  const topicId = receipt.topicId?.toString();
  console.log(JSON.stringify({ action: "create-topic", topicId }, null, 2));
}

async function publishIntent() {
  const client = createClientFromEnv();

  const topicIdRaw = process.env.HCS_TOPIC_ID;
  if (!topicIdRaw) {
    throw new Error("Missing HCS_TOPIC_ID");
  }
  const topicId = TopicId.fromString(topicIdRaw);

  const inputArg = process.argv[3];
  if (!inputArg) {
    throw new Error("Missing intent payload. Pass JSON string as the 2nd argument.");
  }

  let parsed;
  try {
    parsed = JSON.parse(inputArg);
  } catch {
    throw new Error("Intent payload must be valid JSON.");
  }

  const validated = intentSchema.parse(parsed);
  const payload = JSON.stringify(validated);
  const byteLength = Buffer.byteLength(payload, "utf8");
  if (byteLength > MAX_HCS_MESSAGE_BYTES) {
    throw new Error(`Intent payload too large (${byteLength} bytes). Max is ${MAX_HCS_MESSAGE_BYTES}.`);
  }

  let tx = new TopicMessageSubmitTransaction().setTopicId(topicId).setMessage(payload);
  const submitKeyRaw = process.env.HCS_SUBMIT_KEY;
  if (submitKeyRaw) {
    const submitKey = PrivateKey.fromString(submitKeyRaw);
    tx = await tx.freezeWith(client);
    tx = await tx.sign(submitKey);
  }

  const submit = await tx.execute(client);

  const receipt = await submit.getReceipt(client);
  console.log(
    JSON.stringify(
      {
        action: "publish-intent",
        topicId: topicId.toString(),
        status: String(receipt.status),
        bytes: byteLength,
        transactionId: submit.transactionId.toString(),
      },
      null,
      2
    )
  );
}

async function main() {
  const command = process.argv[2];
  if (command === "create-topic") {
    await createTopic();
    return;
  }
  if (command === "publish-intent") {
    await publishIntent();
    return;
  }
  console.error("Usage:");
  console.error("  node relay/createTopicAndPublishIntent.js create-topic");
  console.error("  node relay/createTopicAndPublishIntent.js publish-intent '{\"intentId\":1,...}'");
  process.exit(1);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
