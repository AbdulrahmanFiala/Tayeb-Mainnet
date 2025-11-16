# Deployment Workflow

> **Quick Start**: See [SETUP.md](./SETUP.md) for a concise checklist.

## Overview

The deployment flow is modular:

- Individual scripts exist for each contract:
  - `scripts/deploy/deploy-sharia-compliance.ts`
  - `scripts/deploy/deploy-crosschain-initiator.ts`
  - `scripts/deploy/deploy-sharia-local-swap.ts`
  - `scripts/deploy/deploy-sharia-dca.ts`
- A single wrapper remains for full deployments:
  - `scripts/deploy/deploy-all.ts` (runs every deploy script in sequence)

All addresses are written to `config/deployedContracts.json`. Tokens are registered from `config/tayebCoins.json` automatically.

## Prerequisites

- `.env` containing `PRIVATE_KEY`, `MOONBEAM_RPC_URL`, etc.
- `config/deployedContracts.json` updated with the router + WETH you plan to use:
  ```json
  "amm": {
    "router": "0x...",
    "weth": "0x..."
  }
  ```
- Optional: `npm run plan:local-swap -- --token-in GLMR --token-out USDC_WH --amount 1` to verify the router/path returned by the StellaSwap SDK matches your configuration. If the command fails, pause deployment until the external DEX API is healthy again.
- Optional: populate `tokens` / `pairs` sections if you want to track existing liquidity.

## One-Step Deploy

```bash
npm run deploy:mainnet             # Moonbeam mainnet (⚠️ real GLMR)
```

`scripts/deploy/deploy-all.ts` runs the core deployment, then deploys ShariaLocalSwap and ShariaDCA inline.

## Manual Steps

### 1. Deploy ShariaCompliance (with token registration)
```bash
npx hardhat run scripts/deploy/deploy-sharia-compliance.ts --network moonbeam
```
This deploys the registry and registers every coin/variant in `tayebCoins.json` that has a Moonbeam address.

### 2. Deploy CrosschainSwapInitiator
```bash
npx hardhat run scripts/deploy/deploy-crosschain-initiator.ts --network moonbeam
```
Uses constructor parameters from `config/xcmConfig.json` and updates `deployedContracts.json`.

### 3. Deploy ShariaLocalSwap (Optional)
```bash
npx hardhat run scripts/deploy/deploy-sharia-local-swap.ts --network moonbeam
```
Wraps the configured DEX router for compliant swaps.

### 4. Deploy ShariaDCA (Optional)
```bash
npx hardhat run scripts/deploy/deploy-sharia-dca.ts --network moonbeam
```
Installs the DCA engine against the same router.

> Prefer a wrapper? `npx hardhat run scripts/deploy/deploy-all.ts --network moonbeam` runs all four steps sequentially.

### 3. Update Token Registry (Optional)
Add new assets to `tayebCoins.json` and run:
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
- [ ] Run a low-value swap on mainnet to confirm router + paths (prep paths with `npm run plan:local-swap`; abort if the SDK reports no route)
- [ ] Configure automation scripts (`automation/auto-execute-dca.ts`, `automation/execute-ready-orders.ts`)
- [ ] Configure mainnet monitors for XCM swaps if using the bridge

For XCM specifics, refer to the docs in `docs/`. For day-to-day integration examples, see [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md).
