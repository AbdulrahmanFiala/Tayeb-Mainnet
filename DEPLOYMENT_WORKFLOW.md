# Deployment Workflow

> **Quick Start**: For a simple step-by-step setup guide, see [SETUP.md](./SETUP.md)

## Overview

The deployment is modular and split into focused scripts:
1. **Tokens** - Deploy MockERC20 tokens (deploy-tokens.ts)
2. **AMM Core** - Deploy Factory & Router (deploy-amm-core.ts)
3. **Pairs** - Create liquidity pairs (create-pairs.ts)
4. **Minting** - Mint initial tokens (mint-tokens.ts)
5. **Main Contracts** - Deploy ShariaCompliance, ShariaSwap, ShariaDCA (deploy-core.ts)

All scripts are idempotent and safe to re-run. All addresses are automatically saved to JSON config files (`config/deployedContracts.json` and `config/halaCoins.json`) for reuse and frontend access.

## Quick Start

### Option 1: Full Deployment (Recommended)
```bash
npm run deploy:testnet
```
This automatically runs all deployment scripts in order:
1. Deploys tokens (deploy-tokens.ts)
2. Deploys AMM core - Factory & Router (deploy-amm-core.ts)
3. Creates liquidity pairs (create-pairs.ts)
4. Mints initial tokens (mint-tokens.ts)
5. Deploys main contracts (deploy-core.ts)

All scripts are idempotent - they check for existing contracts and skip if already deployed. All addresses are automatically saved to JSON config files.

### Option 2: Manual Step-by-Step

**1. Deploy Tokens**
```bash
npm run deploy:tokens
# or
npx hardhat run scripts/deploy-tokens.ts --network moonbase
```
This deploys:
- All 16 Initial Hala Coins (MockERC20: BTC, ETH, USDT, USDC, etc.)
- **Saves token addresses to both `halaCoins.json` and `deployedContracts.json`**

**2. Deploy AMM Core**
```bash
npm run deploy:amm-core
# or
npx hardhat run scripts/deploy-amm-core.ts --network moonbase
```
This deploys:
- SimpleFactory
- SimpleRouter
- WETH (if needed)
- **Saves addresses to `deployedContracts.json`**

**3. Create Pairs**
```bash
npm run deploy:pairs
# or
npx hardhat run scripts/create-pairs.ts --network moonbase
```
This creates:
- Liquidity pairs (each non-stablecoin with USDC, plus USDC/USDT pair)
- **Saves pair addresses to `deployedContracts.json`**

**4. Mint Tokens**
```bash
npm run deploy:mint
# or
npx hardhat run scripts/mint-tokens.ts --network moonbase
```
This mints initial tokens to the deployer for testing.

**5. Deploy Main Contracts**
```bash
npm run deploy:core
# or
npx hardhat run scripts/deploy-core.ts --network moonbase
```
This:
- Reads AMM addresses from `deployedContracts.json`
- Reads coin config from `halaCoins.json`
- Deploys ShariaCompliance, ShariaSwap, ShariaDCA
- **Registers coins from JSON** (skips if already registered)
- Registers token addresses
- **Saves addresses to JSON configs**

**6. Add Liquidity**
```bash
npx hardhat run scripts/addLiquidity.ts --network moonbase
```
This:
- Reads addresses from JSON configs (no manual editing needed!)
- Adds liquidity to all pairs (each non-stablecoin with USDC, plus USDC/USDT pair)

### Idempotent Deployment

All deployment scripts are idempotent and safe to re-run:
- ✅ Checks if contracts already exist on-chain
- ✅ Skips existing contracts
- ✅ Only deploys/registers new items
- ✅ No errors on re-runs

Running `npm run deploy:testnet` multiple times is safe - it will only deploy what's missing.

### Coin Management

For detailed information on adding/removing coins and syncing JSON files, see [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md#coin-management-workflow).

## Verification

After deployment, verify all contracts:

```bash
# Make sure ETHERSCAN_API_KEY is set in .env
npm run verify:all
```

This verifies:
- All tokens
- AMM contracts (Factory, Router)
- Main contracts (ShariaCompliance, ShariaSwap, ShariaDCA)
- All liquidity pairs

The script compiles contracts first and checks verification status, so it's safe to run multiple times.
