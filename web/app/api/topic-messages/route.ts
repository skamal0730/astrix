import { NextResponse } from "next/server";

const DEFAULT_MIRROR = "https://testnet.mirrornode.hedera.com/api/v1";

type MirrorMessage = {
  consensus_timestamp?: string;
  message?: string;
  sequence_number?: number;
};

export async function GET() {
  const topicId =
    process.env.NEXT_PUBLIC_HCS_TOPIC_ID || process.env.HCS_TOPIC_ID || "";
  const mirrorBase = (process.env.MIRROR_NODE_URL || DEFAULT_MIRROR).replace(/\/$/, "");

  if (!topicId) {
    return NextResponse.json({ messages: [], warning: "HCS_TOPIC_ID not configured" });
  }

  try {
    const url = `${mirrorBase}/topics/${topicId}/messages?limit=30`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { messages: [], error: `Mirror error ${res.status}: ${text.slice(0, 200)}` },
        { status: 200 },
      );
    }
    const json = (await res.json()) as { messages?: MirrorMessage[] };
    const raw = json.messages || [];
    const messages = raw.map((m) => {
      let decoded = "";
      try {
        if (m.message) {
          decoded = Buffer.from(m.message, "base64").toString("utf8");
        }
      } catch {
        decoded = "";
      }
      let requestId: string | undefined;
      try {
        const parsed = JSON.parse(decoded) as { requestId?: string };
        requestId = parsed.requestId;
      } catch {
        requestId = undefined;
      }
      return {
        sequence_number: m.sequence_number,
        consensus_timestamp: m.consensus_timestamp,
        requestId,
        preview: decoded.length > 120 ? `${decoded.slice(0, 120)}…` : decoded,
      };
    });
    return NextResponse.json({ topicId, messages });
  } catch (error) {
    return NextResponse.json(
      { messages: [], error: error instanceof Error ? error.message : "Mirror fetch failed" },
      { status: 200 },
    );
  }
}
