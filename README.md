# Tayeb - Sharia Compliant DeFi Platform

A comprehensive decentralized platform for Sharia-compliant cryptocurrency investment built for Moonbeam mainnet.

## 🌟 Features

### 1. Sharia-Compliant Asset Registry
- **Verified Token Registry**: Admin-controlled list of Sharia-compliant tokens
- **Compliance Validation**: All swaps and investments validated against Sharia principles
- **Transparent Documentation**: Each token includes compliance reasoning

### 2. Token Swapping (ShariaLocalSwap)
- **Router Integration**: Works with any Uniswap V2-compatible router (e.g. StellaSwap on Moonbeam). Tayeb never supplies liquidity itself—the router and path must come from an external DEX SDK.
- **User-Defined Paths**: Callers provide the exact swap path for full control and transparency
- **Compliance Enforcement**: Only allows swaps into Sharia-compliant assets registered on-chain
- **Swap History**: Track all user swap activities
- **Price Quotes**: Use router quoting for preview before execution
- **Slippage Protection**: Minimum output amount guarantees

### 3. Dollar Cost Averaging (ShariaDCA)
- **Automated DCA**: Schedule periodic investments into Sharia-compliant tokens
- **Router-Agnostic**: Reuses the same user-provided paths as ShariaLocalSwap
- **Local Automation**: Automated execution via local script
- **Flexible Intervals**: Set custom schedules
- **Prepaid Deposits**: Lock funds for future executions
- **Cancel Anytime**: Get refunds for uncompleted intervals

### 4. Cross-Chain Swaps (XCM Integration)
- **Polkadot XCM**: Native cross-chain messaging for parachain interoperability
- **Hydration Omnipool**: Execute swaps on Hydration's unified liquidity pool
- **Automatic Routing**: Seamless asset transfers between Moonbeam and Hydration
- **Sharia Validation**: All cross-chain swaps validated for compliance
- **Status Monitoring**: Track XCM message delivery and execution
- **Round-Trip Swaps**: Lock on Moonbeam → Swap on Hydration → Return to Moonbeam

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────┐
│                      Frontend DApp                         │
│              (React/Next.js + ethers.js)                   │
└───────────┬────────────────────────────────────┬───────────┘
            │                                    │
┌───────────▼──────────┐              ┌──────────▼──────────┐
│  ShariaCompliance    │              │  ShariaLocalSwap    │
│  - Token Registry    │◄─────────────┤    - Router Proxy   │
│  - Validation        │              │    - Swap Logic     │
└──────────────────────┘              └─────────────────────┘
            ▲                                     │
            │                                     │
┌───────────┴──────────┐                         │
│     ShariaDCA        │                         │
│  - Automation Script │                         │
│  - Scheduled Orders  │                         │
└──────────────────────┘                         │
            │                                     │
            └─────────────┬───────────────────────┘
                          │
              ┌───────────▼──────────────┐
              │  External DEX Liquidity  │
              │ (Uniswap V2-compatible)  │
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

**Note:** Coins are registered programmatically from `config/tayebCoins.json` during deployment. After deployment, use contract functions to add/remove coins, then sync JSON with `npm run sync:coins`.

### ShariaLocalSwap.sol
Token swapping with DEX integration and compliance validation.

**Key Functions:**
- `swapShariaCompliant(path, amountIn, minAmountOut, deadline)` - Execute swap with explicit routing path
- `swapGLMRForToken(path, minAmountOut, deadline)` - Swap native DEV using a WETH-prefixed path
- `getSwapQuote(path, amountIn)` - Get price estimate for a provided path
- `getUserSwapHistory(user)` - View swap history

**Features:**
- **Path Transparency**: Frontends select their preferred pools and pass the path to the contract
- **Compliance Guardrails**: Contract enforces that the output token is Sharia-approved
- Token addresses are automatically queried from `ShariaCompliance` contract. No separate registration needed.
- Plays nicely with DEX routing SDKs (StellaSwap, Odyssey, etc.)—build the optimal route off-chain and forward it through Tayeb for compliance enforcement.
- **SDK Friendly**: call StellaSwap’s router helpers, then forward `swapCallParameters.path` into Tayeb contracts to keep compliance guarantees.

### ShariaDCA.sol
Automated Dollar Cost Averaging with local automation script.

**Key Functions:**
- `createDCAOrderWithDEV(targetToken, path, amountPerInterval, intervalSeconds, totalIntervals)` - Create order with native DEV
- `createDCAOrderWithToken(sourceToken, targetToken, path, amountPerInterval, intervalSeconds, totalIntervals)` - Create order with ERC20 tokens
- `executeDCAOrder(orderId)` - Execute next interval (called by automation script or manually)
- `cancelDCAOrder(orderId)` - Cancel and get refund
- `getDCAOrder(orderId)` - Get order details
- `getUserOrders(user)` - Get user's orders
- `getOrderPath(orderId)` - Retrieve stored swap path
- `checkUpkeep()` / `performUpkeep()` - Automation functions for local script

**Features:**
- **Any Token → Any Token DCA**: Deposit DEV, USDC, BTC, or any Sharia-compliant token and DCA into any other token
- **Explicit Routing**: Uses the same caller-provided path as ShariaLocalSwap, offering predictable execution routes
- Token addresses are automatically queried from `ShariaCompliance` contract. No separate registration needed.
- **Local Automation**: Run `scripts/automation/auto-execute-dca.ts` to automatically execute orders

### CrosschainSwapInitiator.sol
Cross-chain swap execution via Polkadot XCM to Hydration parachain.

**Key Functions:**
- `initiateRemoteSwap(sourceToken, targetToken, amount, minAmountOut, deadline)` - Initiate cross-chain swap
- `cancelSwap(swapId)` - Cancel pending swap and refund tokens
- `getSwap(swapId)` - Get swap details and status
- `getUserSwaps(user)` - Get all swaps for a user

**Features:**
- **XCM Integration**: Uses Moonbeam's XCM Transactor precompile for cross-chain messaging
- **Hydration Omnipool**: Executes swaps on Hydration's unified liquidity pool
- **Status Tracking**: Monitor swap progress (Pending, Initiated, Completed, Failed)
- **Sharia Compliance**: Validates target token compliance before initiating swap
- **Round-Trip**: Locks tokens on Moonbeam, swaps on Hydration, returns swapped tokens

## 🚀 Getting Started

> **Quick Start**: For a step-by-step setup guide, see [SETUP.md](./SETUP.md)

### Prerequisites

- Node.js 18+ and npm/yarn
- MetaMask or compatible Web3 wallet
- GLMR on Moonbeam

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
npm run deploy:mainnet  # Deploys ShariaCompliance + ShariaLocalSwap + CrosschainSwapInitiator + ShariaDCA
```

### Target Network

- **Moonbeam Mainnet**: Primary deployment surface (GLMR, production liquidity).

Use [SETUP.md](./SETUP.md) to configure your environment.

## 🔧 Debugging Tools

### Decode Failed Transactions

Debug failed transactions with the decode script:

```bash
TX_HASH=0x... npx hardhat run scripts/decode-failed-tx.ts --network moonbeam
```

The script will:
- Decode function calls and parameters
- Identify common mistakes (wrong addresses, invalid amounts, etc.)
- Show revert reasons and error messages
- Provide troubleshooting guidance

For detailed usage, see [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md#debugging-failed-transactions).

## 💻 Usage

> **📖 For comprehensive code examples and integration guides, see [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md)**

### Quick Steps

1. **Confirm Router Configuration**:
   - `config/deployedContracts.json` → `amm.router`, `amm.weth`
   - Update if you switch DEXes or use alternate liquidity sources

2. **Access Deployed Addresses**:
   - Token addresses: `config/tayebCoins.json`
   - Contract addresses: `config/deployedContracts.json`

3. **Integrate with Your App**:
   - See [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) for detailed code examples
   - Includes: swaps, DCA orders, frontend integration, error handling

For coin management, see [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md#coin-management-workflow).

## 🤝 Using StellaSwap SDK with Tayeb

Let StellaSwap compute optimal routes while Tayeb enforces Sharia compliance. The `plan-local-swap` helper wraps `@stellaswap/swap-sdk` so you can inspect router hints and address paths before calling `ShariaLocalSwap` or `ShariaDCA`. If the SDK cannot return a route, the helper aborts—Tayeb will not fall back to custom liquidity or guesses.

```
npm run plan:local-swap -- --token-in GLMR --token-out USDC_WH --amount 1 --slippage-bps 100
```

Sample output (successful quote):

```
🔍 StellaSwap Route Planner

Input token:
  Symbol:       GLMR
  Name:         Glimmer
  Address:      0xacc15dc74880c9944775448304b263d191c6077f
  Decimals:     18

Output token:
  Symbol:       USDC_WH (variant of USDC)
  Name:         USD Coin (Wormhole)
  Address:      0x931715fee2d06333043d11f658c8ce934ac61d0c
  Decimals:     6

Quote parameters:
  Amount (human):   1
  Amount (raw):     1000000000000000000
  Slippage (bps):   100
  Account:          0x0000000000000000000000000000000000000000

✅ Router suggested by StellaSwap SDK:
  0x70085a098FA8F080Ba831adB4e64fbC9FD07e062

🛣️  Suggested swap path:
  [0] 0xacc15dc74880c9944775448304b263d191c6077f (GLMR)
  [1] 0x931715fee2d06333043d11f658c8ce934ac61d0c (USDC_WH)

📈 Estimated output:
  Raw:    994365
  Human:  0.994365
```

Key takeaways:

- ✅ The script uses `@stellaswap/swap-sdk` to request a quote with your chosen slippage.
- ✅ If the SDK cannot return a route, the script stops and asks you to retry later—Tayeb will not execute swaps unless an external router SDK provides the path.
- ✅ Paths are resolved against `tayebCoins.json`, so the final hop is guaranteed to be a Sharia-listed asset.
- ✅ You can pass `--dump` to inspect the raw response for advanced routing analysis.
- ✅ Feed the printed `path` straight into Tayeb contracts while Tayeb handles the compliance checks on-chain.

> **Heads-up:** As of November 2025 the public StellaSwap quote API intermittently responds with `500` (`could not detect network`). When this happens, contact StellaSwap support; Tayeb will not fall back to ad-hoc routing or local liquidity.

If the SDK is unavailable, the planner exits early with a message similar to:

```
❌ StellaSwap SDK did not return a usable route. Tayeb only executes swaps that are planned by external router SDKs.
   Please retry later or contact StellaSwap support if the issue persists.
```

## 🌉 Cross-Chain Swaps via XCM

Tayeb supports cross-chain swaps from Moonbeam to Hydration parachain using Polkadot's XCM protocol.

### Features

- **Native XCM Integration**: Uses Moonbeam's XCM Transactor precompile for secure cross-chain messaging
- **Hydration Omnipool**: Access deep liquidity on Hydration's unified liquidity pool
- **Sharia Compliance**: All cross-chain swaps validated for Islamic finance compliance
- **Round-Trip Execution**: Lock tokens on Moonbeam → Swap on Hydration → Receive back on Moonbeam
- **Status Monitoring**: Track XCM message delivery and swap execution in real-time

### Quick Start

1. **Deploy CrosschainSwapInitiator**:
   ```bash
   npx hardhat run scripts/xcm/deploy-remote-swap.ts --network moonbeam
   ```

2. **Initiate a Cross-Chain Swap**:
   ```bash
   npx hardhat run scripts/xcm/initiate-remote-swap.ts --network moonbeam
   ```

3. **Monitor Swap Status**:
   - Check on [Moonscan](https://moonscan.io/)
   - Track XCM messages on [Hydration Subscan](https://hydration.subscan.io/)

### Prerequisites

Before using cross-chain swaps, ensure:

- ✅ HRMP channel exists between Moonbeam and Hydration
- ✅ Assets are registered as XC-20s on both chains
- ✅ Moonbeam's sovereign account on Hydration has HDX for fees
- ✅ CrosschainSwapInitiator contract has DEV for XCM fees

### Documentation

For detailed setup, configuration, and troubleshooting, see:

📖 **[XCM Integration Guide](./docs/XCM_INTEGRATION.md)**

Topics covered:
- Architecture and message flow
- HRMP channel setup
- Asset registration (XC-20s)
- Sovereign account funding
- Deployment and configuration
- Monitoring and debugging
- Fee estimation
- Security considerations
- Troubleshooting common issues

## 🌐 Network Details

### Moonbeam Mainnet

- **RPC URL**: https://rpc.api.moonbeam.network
- **Chain ID**: 1284
- **Currency**: GLMR
- **Block Explorer**: https://moonscan.io/
- **Wrapped GLMR (WETH)**: `0xAcc15dC74880C9944775448304B263D191c6077F`
- **XCM Transactor Precompile**: `0x0000000000000000000000000000000000000806`

## 📚 Resources

- **Usage Examples**: See [USAGE_EXAMPLES.md](./USAGE_EXAMPLES.md) for detailed code examples and integration guides
- **Setup Guide**: See [SETUP.md](./SETUP.md) for quick start and troubleshooting
- **XCM Integration**: See [XCM_INTEGRATION.md](./docs/XCM_INTEGRATION.md) for cross-chain swap setup and troubleshooting
- **Deployment Workflow**: See [DEPLOYMENT_WORKFLOW.md](./DEPLOYMENT_WORKFLOW.md) for deployment details
- **Moonbeam Docs**: https://docs.moonbeam.network/
- **Hydration Docs**: https://docs.hydration.net/
- **Polkadot XCM**: https://wiki.polkadot.network/docs/learn-xcm
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
## 📧 Contact

For questions, issues, or contributions:
- Open an issue on GitHub
- Submit a pull request
- Contact: [your contact info]

---

Built with ❤️ for the Muslim DeFi community
