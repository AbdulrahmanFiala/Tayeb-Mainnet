# Configuration Files

This directory contains centralized configuration files for the Tayeb platform.

## Files

### `tayebCoins.json`
Single source of truth for all Tayeb Coins configuration. This file:
- Defines the canonical list of compliant assets with metadata
- Supports per-asset `variants` so bridged/flavoured tokens can inherit metadata from their parent while providing unique symbols and addresses
- Stores deployed token contract addresses (updated by deployment or sync scripts)
- Can be imported by both backend scripts and frontend

### `deployedContracts.json`
Stores all deployed contract addresses (DEX config + Tayeb contracts). This file:
- Contains router + WETH addresses (manually curated or synced via deployment scripts)
- Optionally tracks token addresses (`tokens`) for convenience
- Optionally tracks external pair addresses under `pairs`
- Records deployed Tayeb contracts in the `main` section
- Includes deployment metadata (date, deployer, block number)
- Can be imported by frontend for connecting to contracts

## Coin Management Workflow

For detailed instructions on adding/removing coins, syncing JSON files, and managing the coin registry, see [USAGE_EXAMPLES.md](../USAGE_EXAMPLES.md#coin-management-workflow).

## How Scripts Update Config Files

### `deploy/deploy-sharia-compliance.ts`
- Deploys `ShariaCompliance`
- Registers any base coins or variants from `tayebCoins.json` that have Moonbeam addresses
- Updates `deployedContracts.json` with the contract address and metadata

### `deploy/deploy-crosschain-initiator.ts`
- Deploys `CrosschainSwapInitiator` using constructor arguments from `config/xcmConfig.json`
- Updates `deployedContracts.json` metadata

### `deploy/deploy-sharia-local-swap.ts`
- Deploys `ShariaLocalSwap` against the configured router/WGLMR pair
- Persists the deployed address to `deployedContracts.json`

### `deploy/deploy-sharia-dca.ts`
- Deploys `ShariaDCA` against the configured router/WGLMR pair
- Persists the deployed address to `deployedContracts.json`

### `deploy/deploy-all.ts`
- Convenience wrapper that runs all four deploy scripts (compliance, cross-chain initiator, ShariaLocalSwap, ShariaDCA)
- Useful for mainnet or orchestrated deployments (deploys/updates everything in one go)

### `automation/sync-coins-from-contract.ts`
- Reads all coins from ShariaCompliance contract
- Updates `tayebCoins.json`: Syncs coin data, sets `permissible` flags
- Updates `deployedContracts.json`: Syncs token addresses

### `automation/listen-coin-events.ts`
- Listens to contract events (CoinRegistered, CoinRemoved, CoinUpdated)
- Automatically updates both JSON files when events occur

### `automation/plan-local-swap.ts`
- Queries StellaSwap's hybrid router via `@stellaswap/swap-sdk`
- Resolves token addresses from `tayebCoins.json`
- Prints router hints and path arrays for use with `ShariaLocalSwap`
- Exits with an error if the external SDK cannot supply a route (Tayeb never falls back to proprietary liquidity)