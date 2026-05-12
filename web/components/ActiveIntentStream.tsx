"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";

type TopicRow = {
  sequence_number?: number;
  requestId?: string;
  consensus_timestamp?: string;
};

type BackendIntent = {
  requestId?: string;
  stage?: string;
  hashscanUrl?: string;
};

function displayStatus(backend?: BackendIntent): "Signed" | "Broadcasted" | "Filled" {
  const s = backend?.stage || "";
  if (s === "settled") return "Filled";
  if (s === "signed") return "Signed";
  if (s === "broadcasted" || s === "solver_executing") return "Broadcasted";
  if (s.startsWith("solver_skipped") || s === "solver_failed") return "Broadcasted";
  return "Broadcasted";
}

function truncateSeq(seq: number | undefined) {
  if (seq == null) return "—";
  const s = String(seq);
  return s.length > 6 ? `…${s.slice(-6)}` : s;
}

function statusPillClass(status: string) {
  if (status === "Filled") return "xy-pill xy-pill--filled";
  if (status === "Signed") return "xy-pill xy-pill--signed";
  return "xy-pill xy-pill--broadcast";
}

export function ActiveIntentStream() {
  const [rows, setRows] = useState<
    { key: string; status: string; intentId: string; pair: string; href: string }[]
  >([]);
  const [topicId, setTopicId] = useState<string>("");
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    try {
      const [topicRes, recentRes] = await Promise.all([
        fetch("/api/topic-messages", { cache: "no-store" }),
        fetch("/api/intents/recent?limit=40", { cache: "no-store" }),
      ]);
      const topicJson = await topicRes.json();
      const recentJson = await recentRes.json();

      const byRequest = new Map<string, BackendIntent>();
      for (const it of recentJson.intents || []) {
        if (it?.requestId) byRequest.set(it.requestId, it);
      }

      const tid = topicJson.topicId || "";
      setTopicId(tid);
      if (topicJson.error) setError(topicJson.error);
      else setError("");

      const messages: TopicRow[] = [...(topicJson.messages || [])].reverse();
      const mapped = messages.map((m) => {
        const backend = m.requestId ? byRequest.get(m.requestId) : undefined;
        const status = displayStatus(backend);
        const href =
          backend?.hashscanUrl ||
          (tid ? `https://hashscan.io/testnet/topic/${tid}` : "https://hashscan.io/testnet");
        return {
          key: `${m.sequence_number}-${m.consensus_timestamp}`,
          status,
          intentId: truncateSeq(m.sequence_number),
          pair: "USDC / HBAR",
          href,
        };
      });

      if (mapped.length === 0 && (recentJson.intents || []).length > 0) {
        const fallback = (recentJson.intents as BackendIntent[]).slice(0, 12).map((it, i) => ({
          key: `mem-${it.requestId || i}`,
          status: displayStatus(it),
          intentId: (it.requestId || "").slice(-8) || "—",
          pair: "USDC / HBAR",
          href: it.hashscanUrl || "https://hashscan.io/testnet",
        }));
        setRows(fallback);
      } else {
        setRows(mapped);
      }
    } catch {
      setError("Unable to load stream");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section id="stream" className="xy-stream xy-scroll-target">
      <div className="xy-stream__head">
        <div>
          <h2 className="xy-stream__h2">Active Intent Stream</h2>
          <p className="xy-stream__desc">
            Recent HCS messages on your configured topic—enriched with relay status when available. Proof that intents
            hit Hedera consensus, not just the UI.
          </p>
        </div>
        {topicId ? (
          <span className="xy-stream__topic">
            Topic <span className="font-mono u-fg-soft">{topicId}</span>
          </span>
        ) : null}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-strong xy-stream__shell">
        <div className="xy-stream__scroll">
          <table className="xy-stream__table">
            <thead className="xy-stream__thead">
              <tr>
                <th>Status</th>
                <th>Intent ID</th>
                <th>Asset pair</th>
                <th>View</th>
              </tr>
            </thead>
            <tbody className="xy-stream__tbody">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="xy-stream__empty">
                    {error || "No messages yet. Broadcast an intent to see it on the ledger."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.key}>
                    <td>
                      <span className={statusPillClass(r.status)}>{r.status}</span>
                    </td>
                    <td className="xy-stream__mono">{r.intentId}</td>
                    <td className="xy-stream__pair">{r.pair}</td>
                    <td className="xy-stream__td-right">
                      <a href={r.href} target="_blank" rel="noreferrer" className="xy-stream__link" aria-label="View on HashScan">
                        ↗
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </section>
  );
}
