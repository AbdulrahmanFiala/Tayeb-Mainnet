# Configuration Files

This directory contains centralized configuration files for the Tayeb platform.

## Files

### `halaCoins.json`
Single source of truth for all Initial Hala Coins configuration. This file:
- Defines all 16 Initial Hala Coins with metadata
- Stores deployed token contract addresses (updated by `deploy-tokens.ts`)
- Can be imported by both backend scripts and frontend

### `deployedContracts.json`
Stores all deployed contract addresses (AMM + Main contracts). This file:
- Contains Factory, Router, WETH addresses (updated by `deploy-amm-core.ts`)
- Contains all token addresses (updated by `deploy-tokens.ts`)
- Contains all pair addresses (updated by `create-pairs.ts`)
- Contains ShariaCompliance, ShariaSwap, ShariaDCA addresses (updated by `deploy-core.ts`)
- Includes deployment metadata (date, deployer, block number)
- Can be imported by frontend for connecting to contracts

## Coin Management Workflow

For detailed instructions on adding/removing coins, syncing JSON files, and managing the coin registry, see [USAGE_EXAMPLES.md](../USAGE_EXAMPLES.md#coin-management-workflow).

## How Scripts Update Config Files

### `deploy-tokens.ts`
- Deploys MockERC20 tokens
- Updates `halaCoins.json`: Adds token addresses to `addresses.moonbase`
- Updates `deployedContracts.json`: Adds addresses to `tokens` section

### `deploy-amm-core.ts`
- Deploys SimpleFactory and SimpleRouter
- Updates `deployedContracts.json`: Adds addresses to `amm` section (factory, router, weth)

### `create-pairs.ts`
- Creates liquidity pairs via Factory
- Updates `deployedContracts.json`: Adds pair addresses to `pairs` section (e.g., "BTC_USDC": "0x...")

### `deploy-core.ts`
- Deploys ShariaCompliance, ShariaSwap, ShariaDCA
- Registers coins from `halaCoins.json` to ShariaCompliance contract
- Updates `deployedContracts.json`: Adds addresses to `main` section

### `sync-coins-from-contract.ts`
- Reads all coins from ShariaCompliance contract
- Updates `halaCoins.json`: Syncs coin data, sets `permissible` flags
- Updates `deployedContracts.json`: Syncs token addresses

### `listen-coin-events.ts`
- Listens to contract events (CoinRegistered, CoinRemoved, CoinUpdated)
- Automatically updates both JSON files when events occur