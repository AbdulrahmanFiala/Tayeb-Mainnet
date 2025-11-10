# Deployment Workflow

> **Quick Start**: See [SETUP.md](./SETUP.md) for a concise checklist.

## Overview

The deployment flow now consists of two tiers:

1. **Core Contracts** – `ShariaCompliance`, `CrosschainSwapInitiator`  
   Script: `scripts/deploy/deploy-core.ts`
2. **Full Stack (Optional)** – adds `ShariaLocalSwap` and `ShariaDCA`  
   Script: `scripts/deploy/deploy-all.ts` (runs core, then deploys ShariaLocalSwap + ShariaDCA inline)

All addresses are written to `config/deployedContracts.json`. Tokens are registered from `config/halaCoins.json` automatically.

## Prerequisites

- `.env` containing `PRIVATE_KEY`, `MOONBEAM_RPC_URL`, etc.
- `config/deployedContracts.json` updated with the router + WETH you plan to use:
  ```json
  "amm": {
    "router": "0x...",
    "weth": "0x..."
  }
  ```
- Optional: populate `tokens` / `pairs` sections if you want to track existing liquidity.

## One-Step Deploy

```bash
npm run deploy:mainnet             # Moonbeam mainnet (⚠️ real GLMR)
```

`scripts/deploy/deploy-all.ts` runs the core deployment, then deploys ShariaLocalSwap and ShariaDCA inline.

## Manual Steps

### 1. Deploy Core Contracts
```bash
npx hardhat run scripts/deploy/deploy-core.ts --network moonbeam
```
Actions performed:
- Deploys `ShariaCompliance` and `CrosschainSwapInitiator`
- Registers all tokens from `config/halaCoins.json`
- Writes addresses & metadata back to `config/deployedContracts.json`

Re-running the script is safe; it will reuse existing deployments when addresses are already set.

### 2. Deploy ShariaLocalSwap & ShariaDCA (Optional)
```bash
npx hardhat run scripts/deploy/deploy-all.ts --network moonbeam
```
`deploy-all` re-runs `deploy-core`, then deploys `ShariaLocalSwap` and `ShariaDCA`. It is idempotent; reruns reuse existing deployments.

### 3. Update Token Registry (Optional)
Add new assets to `halaCoins.json` and run:
```bash
npm run sync:coins -- --network moonbeam
```
This keeps the JSON file aligned with on-chain registrations.

## Verification

```bash
# Requires ETHERSCAN_API_KEY in .env
npm run verify:all -- --network moonbeam
```

The verification script covers:
- Tokens listed in `config/deployedContracts.json`
- ShariaCompliance / ShariaLocalSwap / ShariaDCA / CrosschainSwapInitiator

Re-running skips already-verified contracts.

## Post-Deployment Checklist

- [ ] Fund `ShariaLocalSwap` with necessary token approvals (if executing on behalf of a multisig)
- [ ] Create example DCA orders and ensure `path` arrays are valid
- [ ] Run a low-value swap on mainnet to confirm router + paths
- [ ] Configure automation scripts (`automation/auto-execute-dca.ts`, `automation/execute-ready-orders.ts`)
- [ ] Configure mainnet monitors for XCM swaps if using the bridge

For XCM specifics, refer to the docs in `docs/`. For day-to-day integration examples, see [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md).
