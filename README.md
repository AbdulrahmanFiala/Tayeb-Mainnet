# Tayeb - Sharia Compliant DeFi Platform

A comprehensive decentralized platform for Sharia-compliant cryptocurrency investment, built with Solidity smart contracts for Moonbase Alpha (Moonbeam Testnet).

## 🌟 Features

### 1. Sharia-Compliant Asset Registry
- **Verified Token Registry**: Admin-controlled list of Sharia-compliant tokens
- **Compliance Validation**: All swaps and investments validated against Sharia principles
- **Transparent Documentation**: Each token includes compliance reasoning

### 2. Token Swapping (ShariaSwap)
- **Custom AMM**: Built-in Uniswap V2-style AMM for testing
- **Compliance Enforcement**: Only allows swaps into Sharia-compliant tokens
- **Swap History**: Track all user swap activities
- **Price Quotes**: Get swap estimates before execution
- **Slippage Protection**: Minimum output amount guarantees

### 3. Dollar Cost Averaging (ShariaDCA)
- **Automated DCA**: Schedule periodic investments into Sharia-compliant tokens
- **Chainlink Automation**: Trustless execution via Chainlink Keepers
- **Flexible Intervals**: Set custom time intervals (1 hour to 30 days)
- **Prepaid Deposits**: Lock funds for all future DCA executions
- **Cancel Anytime**: Get refunds for uncompleted intervals

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      Frontend DApp                         │
│              (React/Next.js + ethers.js)                   │
└───────────┬────────────────────────────────────┬───────────┘
            │                                    │
┌───────────▼──────────┐              ┌──────────▼──────────┐
│  ShariaCompliance    │              │    ShariaSwap       │
│  - Token Registry    │◄─────────────┤    - DEX Router     │
│  - Validation        │              │    - Swap Logic     │
└──────────────────────┘              └─────────────────────┘
            ▲                                     │
            │                                     │
┌───────────┴──────────┐                         │
│     ShariaDCA        │                         │
│  - Chainlink Auto    │                         │
│  - Scheduled Orders  │                         │
└──────────────────────┘                         │
            │                                     │
            └─────────────┬───────────────────────┘
                          │
              ┌───────────▼──────────────┐
              │      Custom AMM          │
              │  (Uniswap V2 Style)      │
              └──────────────────────────┘
```

## 📦 Smart Contracts

### ShariaCompliance.sol
Core registry managing Sharia-compliant token approvals. **Contract is source of truth** for coin registrations.

**Key Functions:**
- `registerShariaCoin(coinId, name, symbol, reason)` - Owner: Add token
- `removeShariaCoin(coinId)` - Owner: Remove token  
- `updateComplianceStatus(coinId, verified, reason)` - Owner: Update coin status
- `isShariaCompliant(coinId)` - Check compliance status
- `getAllShariaCoins()` - Get all approved tokens
- `requireShariaCompliant(coinId)` - Validation helper (reverts if not compliant)

**Note:** Coins are registered programmatically from `config/halaCoins.json` during deployment. After deployment, use contract functions to add/remove coins, then sync JSON with `npm run sync:coins`.

### ShariaSwap.sol
Token swapping with DEX integration and compliance validation.

**Key Functions:**
- `swapShariaCompliant(tokenIn, tokenOut, amountIn, minAmountOut, deadline)` - Execute swap
- `swapGLMRForToken(tokenOut, minAmountOut, deadline)` - Swap native DEV
- `getSwapQuote(tokenIn, tokenOut, amountIn)` - Get price estimate
- `getUserSwapHistory(user)` - View swap history

**Note:** Token addresses are automatically queried from `ShariaCompliance` contract. No separate registration needed.

### ShariaDCA.sol
Automated Dollar Cost Averaging with Chainlink integration.

**Key Functions:**
- `createDCAOrder(targetSymbol, amountPerInterval, intervalSeconds, totalIntervals)` - Create order (prepaid)
- `executeDCAOrder(orderId)` - Execute next interval (manual or automated)
- `cancelDCAOrder(orderId)` - Cancel and get refund
- `getDCAOrder(orderId)` - Get order details
- `getUserOrders(user)` - Get user's orders

**Note:** Token addresses are automatically queried from `ShariaCompliance` contract. No separate registration needed.
- `checkUpkeep()` / `performUpkeep()` - Chainlink Automation integration

## 🚀 Getting Started

> **Quick Start**: For a step-by-step setup guide, see [SETUP.md](./SETUP.md)

### Prerequisites

- Node.js 18+ and npm/yarn
- MetaMask or compatible Web3 wallet
- DEV tokens on Moonbase Alpha testnet (faucet: https://faucet.moonbeam.network/)

### Quick Setup

```bash
# Clone and install
git clone https://github.com/yourusername/Tayeb.git
cd Tayeb
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your PRIVATE_KEY (see SETUP.md for details)

# Compile, test, and deploy
npm run compile
npm test
npm run deploy:testnet  # Deploys with custom AMM on testnet
```

### Moonbase Alpha Testnet

This platform is designed for **Moonbase Alpha (testnet)** only:

- ✅ Custom Uniswap V2-style AMM (SimpleRouter, SimplePair, SimpleFactory)
- ✅ Mock ERC20 tokens (USDT, USDC, DAI) for testing
- ✅ Manual liquidity provision via `scripts/addLiquidity.ts`
- ✅ Free testnet DEV tokens for testing
- ✅ No real funds required

For detailed setup instructions, troubleshooting, and post-deployment steps, refer to [SETUP.md](./SETUP.md).

## 💻 Usage

> **📖 For comprehensive code examples and integration guides, see [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md)**

### Quick Steps

1. **Add Liquidity** (required after deployment):
   ```bash
   npx hardhat run scripts/addLiquidity.ts --network moonbase
   ```

2. **Access Deployed Addresses**:
   - Token addresses: `config/halaCoins.json`
   - Contract addresses: `config/deployedContracts.json`

3. **Integrate with Your App**:
   - See [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) for detailed code examples
   - Includes: swaps, DCA orders, frontend integration, error handling

For coin management, see [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md#coin-management-workflow).

## 🌐 Moonbeam Network Details

### Moonbase Alpha Testnet

- **Network Name**: Moonbase Alpha
- **RPC URL**: https://rpc.api.moonbase.moonbeam.network
- **Chain ID**: 1287
- **Currency**: DEV
- **Block Explorer**: https://moonbase.moonscan.io/
- **Faucet**: https://faucet.moonbeam.network/

### Moonbeam Mainnet

- **Network Name**: Moonbeam
- **RPC URL**: https://rpc.api.moonbeam.network
- **Chain ID**: 1284
- **Currency**: GLMR
- **Block Explorer**: https://moonscan.io/
- **API Key**: Get from https://etherscan.io/apidashboard (Etherscan API V2)

### Key Addresses (Moonbase Alpha)

- **WETH (Wrapped DEV)**: `0xD909178CC99d318e4D46e7E66a972955859670E1`


## 📚 Resources

- **Usage Examples**: See [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) for detailed code examples and integration guides
- **Setup Guide**: See [SETUP.md](./SETUP.md) for quick start and troubleshooting
- **Deployment Workflow**: See [DEPLOYMENT_WORKFLOW.md](./DEPLOYMENT_WORKFLOW.md) for deployment details
- **Moonbeam Docs**: https://docs.moonbeam.network/
- **Moonbase Faucet**: https://faucet.moonbeam.network/
- **Chainlink Automation**: https://automation.chain.link/
- **Hardhat**: https://hardhat.org/


### Development Workflow

For detailed development commands and troubleshooting, see [SETUP.md](./SETUP.md#-development-workflow).

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see LICENSE file for details

## ⚠️ Disclaimer

This platform provides tools for Sharia-compliant cryptocurrency investment. However:

- **Do Your Own Research**: Always verify token compliance with qualified Islamic scholars
- **No Financial Advice**: This is not financial or religious advice
- **Smart Contract Risk**: Use at your own risk; audit contracts before mainnet use
- **Testnet First**: Always test on Moonbase Alpha before using mainnet

## 📧 Contact

For questions, issues, or contributions:
- Open an issue on GitHub
- Submit a pull request
- Contact: [your contact info]

---

Built with ❤️ for the Muslim DeFi community
