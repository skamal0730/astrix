"use client";

import { motion } from "framer-motion";

const columns = [
  {
    id: "hcs",
    headline: "Fair-Ordered Mempool (HCS)",
    body: "Astrix utilizes the Hedera Consensus Service to broadcast intents. Every trade request receives a verifiable, tamper-proof timestamp—reducing classic mempool leakage and strengthening MEV resistance before execution.",
  },
  {
    id: "solvers",
    headline: "Optimization as a Service",
    body: "Competitive solvers fulfill your intent using aggregated liquidity from SaucerSwap V2, HeliSwap, and private inventory—routing toward the best executable outcome under your signed constraints.",
  },
  {
    id: "hts",
    headline: "Atomic HTS Settlement",
    body: "Settlement is enforced by the Hedera Token Service. Funds move only if execution satisfies your EIP-712 intent. The swap is atomic: all-or-nothing, with trustless verification on-chain.",
  },
];

export function TechnicalDeepDive() {
  return (
    <section id="deep-dive" className="xy-dive xy-scroll-target">
      <div className="xy-dive__intro">
        <h2 className="xy-dive__h2">Technical Deep Dive</h2>
        <p className="xy-dive__sub">
          Zero slippage at your limit, MEV-resistant ordering, and atomic HTS settlement—designed for credible,
          audit-ready execution on Hedera.
        </p>
      </div>
      <div id="solvers" className="xy-dive__grid xy-scroll-target">
        {columns.map((col, idx) => (
          <motion.article
            key={col.id}
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: idx * 0.06 }}
            className="glass glow-ring xy-dive__card"
          >
            <h3>{col.headline}</h3>
            <p>{col.body}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
