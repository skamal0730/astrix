const fs = require("fs");
const path = require("path");

let cached;

function loadTestnetConfig() {
  if (cached) return cached;
  const configPath = path.join(__dirname, "testnet.json");
  cached = JSON.parse(fs.readFileSync(configPath, "utf8"));
  return cached;
}

function testnetDefaults() {
  const c = loadTestnetConfig();
  return {
    chainId: String(c.chainId),
    whbarEvm: c.tokens.whbar.evmAddress,
    usdcEvm: c.tokens.usdc.evmAddress,
    whbarHederaId: c.tokens.whbar.hederaId,
    usdcHederaId: c.tokens.usdc.hederaId,
    router: c.saucerswap.router,
    quoter: c.saucerswap.quoter,
    poolFee: String(c.saucerswap.poolFee),
    maxHcsMessageBytes: c.hcs.maxMessageBytes,
    htsPrecompile: c.hederaSystemContracts.htsPrecompile,
  };
}

function envOr(name, fallback) {
  const value = process.env[name];
  if (value !== undefined && value !== "") return value;
  return fallback;
}

function requireEnv(name, fallback) {
  const value = envOr(name, fallback);
  if (value === undefined || value === "") {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

module.exports = { loadTestnetConfig, testnetDefaults, envOr, requireEnv };
