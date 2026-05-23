# Astrix

Astrix is an intent-centric DeFi protocol on Hedera.  
This repository contains a production-ready web app foundation with:

- Next.js 15 website (`web/`) with investor-grade UI and protocol playground.
- Express backend (`backend/server.js`) for secure HCS broadcasting and status tracking.
- Solver worker (`solver/solver.js`) for HCS subscription and on-chain settlement.
- Solidity settlement contract (`contracts/IntentSettlement.sol`) with EIP-712 verification.

## Architecture

1. User connects wallet (MetaMask or HashPack flow).
2. User signs a typed `SwapIntent` off-chain.
3. Web app calls `/api/broadcast` (Next route proxy).
4. Backend submits intent message to HCS topic.
5. Solver consumes topic and tries `settle(...)` on Hedera testnet.
6. UI polls status and shows HashScan links.

## Tech stack

- Web: Next.js 15 App Router + TypeScript + plain CSS + Framer Motion.
- Backend: Node.js + Express + `@hashgraph/sdk`.
- Blockchain: `ethers` v6 + `@hashgraph/sdk` + `@hashgraph/hedera-wallet-connect`.
- Contracts: Foundry + OpenZeppelin.

## Environment setup

### Root `.env`

```bash
cp .env.example .env
```

Fill required values:

- `HEDERA_OPERATOR_ID`
- `HEDERA_OPERATOR_KEY`
- `HCS_SUBMIT_KEY`
- `HCS_TOPIC_ID`
- `HEDERA_RPC_URL`
- `SOLVER_PRIVATE_KEY`
- `SETTLEMENT_CONTRACT`
- `WHBAR_TOKEN`
- `USDC_TOKEN`
- `ROUTER_ADDRESS`

### Web env

```bash
cp web/.env.example web/.env.local
```

Recommended:

- `BACKEND_API_URL=http://localhost:3001`
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=<your_walletconnect_project_id>`
- `NEXT_PUBLIC_SETTLEMENT_CONTRACT=<deployed_contract>`

## Run locally

Install deps:

```bash
npm install
npm --prefix web install
```

Run all services:

```bash
npm run dev
```

Services:

- Web: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Solver: background process in same dev command

## Key endpoints

- `POST /api/broadcast` (web proxy → backend)
- `GET /api/status/:id` (live tracker polling)
- `GET /api/balances?accountId=0.0.xxxxx` (mirror-node balances via backend)

Backend-native endpoints:

- `POST /api/broadcast`
- `GET /api/status/:id`
- `GET /api/status/:id/stream`
- `POST /api/status/update` (solver updates)
- `GET /api/balances/:accountId`

## Contract workflow

Build contracts:

```bash
forge build
```

Deploy settlement contract:

```bash
forge script script/DeployIntentSettlement.s.sol:DeployIntentSettlement \
  --rpc-url "$HEDERA_RPC_URL" \
  --private-key "$SOLVER_PRIVATE_KEY" \
  --broadcast
```

## Hedera testnet defaults used in UI

- Chain ID: `296`
- WHBAR Token ID: `0.0.15058`
- USDC Token ID: `0.0.429274`

## Notes

- Keep operator and submit keys server-side only.
- Solver status updates are in-memory for MVP; migrate to Redis/Postgres for production persistence.
- HashPack connection uses Hedera WalletConnect flow and requires a WalletConnect project ID.