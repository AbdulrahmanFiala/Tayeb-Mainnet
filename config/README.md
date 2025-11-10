# Configuration Files

This directory contains centralized configuration files for the Tayeb platform.

## Files

### `halaCoins.json`
Single source of truth for all Initial Hala Coins configuration. This file:
- Defines all 16 Initial Hala Coins with metadata
- Stores deployed token contract addresses (updated by `deploy-tokens.ts`)
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

### `deploy/deploy-core.ts`
- Deploys ShariaCompliance, ShariaSwap, ShariaDCA
- Registers coins from `halaCoins.json` to ShariaCompliance contract
- Updates `deployedContracts.json`: Adds addresses to `main` section
- Leaves `amm.router` / `amm.weth` untouched (expects them to be pre-filled)

### `deploy/deploy-all.ts`
- Runs `deploy/deploy-core.ts` followed by `xcm/deploy-remote-swap.ts`
- Useful for mainnet or orchestrated deployments

### `deploy/sync-coins-from-contract.ts`
- Reads all coins from ShariaCompliance contract
- Updates `halaCoins.json`: Syncs coin data, sets `permissible` flags
- Updates `deployedContracts.json`: Syncs token addresses

### `automation/listen-coin-events.ts`
- Listens to contract events (CoinRegistered, CoinRemoved, CoinUpdated)
- Automatically updates both JSON files when events occur