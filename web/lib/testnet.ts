import fs from "fs";
import path from "path";

export type TestnetConfig = {
  chainId: number;
  saucerswap: { router: string; quoter: string; poolFee: number };
  tokens: {
    whbar: { hederaId: string; evmAddress: string };
    usdc: { hederaId: string; evmAddress: string };
  };
  hcs: { maxMessageBytes: number };
};

let cached: TestnetConfig | null = null;

const FALLBACK: TestnetConfig = {
  chainId: 296,
  saucerswap: {
    router: "0x0000000000000000000000000000000000159398",
    quoter: "0x00000000000000000000000000000000001535b2",
    poolFee: 3000,
  },
  tokens: {
    whbar: {
      hederaId: "0.0.15058",
      evmAddress: "0x0000000000000000000000000000000000003ad2",
    },
    usdc: {
      hederaId: "0.0.429274",
      evmAddress: "0xc3ba8c19c1253c8ad43e1d3661a07efe41431ef4",
    },
  },
  hcs: { maxMessageBytes: 1024 },
};

export function getTestnetConfig(): TestnetConfig {
  if (cached) return cached;
  const candidates = [
    path.join(process.cwd(), "config", "testnet.json"),
    path.join(process.cwd(), "..", "config", "testnet.json"),
  ];
  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      cached = JSON.parse(fs.readFileSync(filePath, "utf8")) as TestnetConfig;
      return cached;
    }
  }
  cached = FALLBACK;
  return cached;
}
