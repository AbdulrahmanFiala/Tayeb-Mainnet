# Tayeb - Sharia Compliant DeFi Platform on Moonbeam

A comprehensive decentralized platform for Sharia-compliant cryptocurrency investment, built with Solidity smart contracts and deployed on Moonbeam.

## 🌟 Features

### 1. Sharia-Compliant Asset Registry
- **Verified Token Registry**: Admin-controlled list of Sharia-compliant tokens
- **Compliance Validation**: All swaps and investments validated against Sharia principles
- **Transparent Documentation**: Each token includes compliance reasoning

### 2. Token Swapping (ShariaSwap)
- **DEX Integration**: Connects with StellaSwap and BeamSwap on Moonbeam
- **Compliance Enforcement**: Only allows swaps into Sharia-compliant tokens
- **Swap History**: Track all user swap activities
- **Price Quotes**: Get swap estimates before execution
- **Slippage Protection**: Minimum output amount guarantees

### 3. ETF Portfolio Building (ShariaETF)
- **Custom ETFs**: Create personalized portfolios with allocation percentages
- **Template ETFs**: Pre-configured Sharia-compliant portfolios
- **Batch Swaps**: Invest in multiple tokens simultaneously
- **Portfolio Tracking**: Monitor ETF performance and user investments

### 4. Dollar Cost Averaging (ShariaDCA)
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
            │                         ┌───────────▼──────────┐
┌───────────┴──────────┐              │     ShariaETF       │
│     ShariaDCA        │              │    - Portfolio      │
│  - Chainlink Auto    │              │    - Batch Swaps    │
│  - Scheduled Orders  │              └─────────────────────┘
└──────────────────────┘                          │
            │                                     │
            └─────────────┬───────────────────────┘
                          │
              ┌───────────▼──────────────┐
              │  StellaSwap / BeamSwap   │
              │    (DEX on Moonbeam)     │
              └──────────────────────────┘
```

## 📦 Smart Contracts

### ShariaCompliance.sol
Core registry managing Sharia-compliant token approvals.

**Key Functions:**
- `registerShariaCoin(coinId, name, symbol, reason)` - Admin: Add token
- `removeShariaCoin(coinId)` - Admin: Remove token  
- `isShariaCompliant(coinId)` - Check compliance status
- `getAllShariaCoins()` - Get all approved tokens
- `requireShariaCompliant(coinId)` - Validation helper (reverts if not compliant)

### ShariaSwap.sol
Token swapping with DEX integration and compliance validation.

**Key Functions:**
- `swapShariaCompliant(tokenIn, tokenOut, amountIn, minAmountOut, deadline)` - Execute swap
- `swapGLMRForToken(tokenOut, minAmountOut, deadline)` - Swap native GLMR
- `getSwapQuote(tokenIn, tokenOut, amountIn)` - Get price estimate
- `getUserSwapHistory(user)` - View swap history
- `registerAsset(tokenAddress, symbol)` - Admin: Register token address

### ShariaETF.sol
Create and invest in Sharia-compliant ETF portfolios.

**Key Functions:**
- `createETF(name, description, symbols, percentages)` - Create custom ETF
- `createTemplateETF(...)` - Admin: Create template ETF
- `investInETF(etfId, minAmountsOut, deadline)` - Invest with GLMR
- `investInETFWithToken(etfId, inputToken, inputAmount, ...)` - Invest with ERC20
- `getETF(etfId, isTemplate)` - Get ETF details
- `getUserETFs(user)` - Get user's ETF subscriptions
- `registerTokenAddress(symbol, address)` - Admin: Register token

### ShariaDCA.sol
Automated Dollar Cost Averaging with Chainlink integration.

**Key Functions:**
- `createDCAOrder(targetSymbol, amountPerInterval, intervalSeconds, totalIntervals)` - Create order (prepaid)
- `executeDCAOrder(orderId)` - Execute next interval (manual or automated)
- `cancelDCAOrder(orderId)` - Cancel and get refund
- `getDCAOrder(orderId)` - Get order details
- `getUserOrders(user)` - Get user's orders
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
npm run deploy:testnet
```

For detailed setup instructions, troubleshooting, and post-deployment steps, refer to [SETUP.md](./SETUP.md).

## 💻 Usage

> **Note**: For post-deployment setup scripts and token registration, see [SETUP.md](./SETUP.md)

### Post-Deployment Setup

After deploying, you need to register token addresses for trading:

```typescript
// Using ethers.js

import { ethers } from "ethers";
import ShariaSwapABI from "./artifacts/contracts/ShariaSwap.sol/ShariaSwap.json";

// Connect to Moonbeam
const provider = new ethers.JsonRpcProvider("https://rpc.api.moonbase.moonbeam.network");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// Initialize contracts
const shariaSwap = new ethers.Contract(SHARIA_SWAP_ADDRESS, ShariaSwapABI.abi, wallet);
const shariaETF = new ethers.Contract(SHARIA_ETF_ADDRESS, ShariaETFABI.abi, wallet);
const shariaDCA = new ethers.Contract(SHARIA_DCA_ADDRESS, ShariaDCAABI.abi, wallet);

// Register token addresses (find actual addresses on Moonbase Alpha)
const USDT_ADDRESS = "0x..."; // Example
const USDC_ADDRESS = "0x...";

await shariaSwap.registerAsset(USDT_ADDRESS, "USDT");
await shariaSwap.registerAsset(USDC_ADDRESS, "USDC");

await shariaETF.registerTokenAddress("USDT", USDT_ADDRESS);
await shariaETF.registerTokenAddress("USDC", USDC_ADDRESS);

await shariaDCA.registerTokenAddress("USDT", USDT_ADDRESS);
await shariaDCA.registerTokenAddress("USDC", USDC_ADDRESS);
```

### Executing Swaps

```typescript
// Swap GLMR for USDT (Sharia-compliant)
const amountIn = ethers.parseEther("1.0"); // 1 GLMR
const minAmountOut = ethers.parseUnits("5", 6); // Minimum 5 USDT (6 decimals)
const deadline = Math.floor(Date.now() / 1000) + 60 * 15; // 15 minutes

const tx = await shariaSwap.swapGLMRForToken(
  USDT_ADDRESS,
  minAmountOut,
  deadline,
  { value: amountIn }
);

await tx.wait();
console.log("Swap completed!");
```

### Creating an ETF

```typescript
// Create a balanced Sharia ETF
const etfName = "Balanced Sharia Portfolio";
const description = "50% USDT, 50% USDC";
const symbols = ["USDT", "USDC"];
const percentages = [50, 50]; // Must sum to 100

const tx = await shariaETF.createETF(
  etfName,
  description,
  symbols,
  percentages
);

const receipt = await tx.wait();

// Get ETF ID from event
const event = receipt.logs.find(log => log.topics[0] === ethers.id("ETFCreated(uint256,string,address,bool)"));
const etfId = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], event.topics[1])[0];

console.log("ETF created with ID:", etfId);
```

### Investing in an ETF

```typescript
// Invest 10 GLMR in the ETF
const investAmount = ethers.parseEther("10");
const minAmountsOut = [
  ethers.parseUnits("25", 6),  // Min 25 USDT
  ethers.parseUnits("25", 6)   // Min 25 USDC
];
const deadline = Math.floor(Date.now() / 1000) + 60 * 15;

const tx = await shariaETF.investInETF(
  etfId,
  minAmountsOut,
  deadline,
  { value: investAmount }
);

await tx.wait();
console.log("Investment complete!");
```

### Creating a DCA Order

```typescript
// DCA: Invest 1 GLMR into USDT every day for 30 days
const targetSymbol = "USDT";
const amountPerInterval = ethers.parseEther("1"); // 1 GLMR per interval
const intervalSeconds = 86400; // 1 day (24 hours)
const totalIntervals = 30; // 30 days total
const totalDeposit = amountPerInterval * BigInt(totalIntervals); // 30 GLMR total

const tx = await shariaDCA.createDCAOrder(
  targetSymbol,
  amountPerInterval,
  intervalSeconds,
  totalIntervals,
  { value: totalDeposit }
);

const receipt = await tx.wait();
console.log("DCA order created!");

// Get order ID from event
const event = receipt.logs.find(log => 
  log.topics[0] === ethers.id("DCAOrderCreated(uint256,address,string,uint256,uint256,uint256)")
);
const orderId = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], event.topics[1])[0];
```

### Setting Up Chainlink Automation (Optional)

For automatic DCA execution:

1. Visit: https://automation.chain.link/moonbase
2. Click "Register New Upkeep"
3. Select "Custom Logic"
4. Enter your ShariaDCA contract address
5. Fund with LINK tokens
6. DCA orders will execute automatically when due

Or execute manually:
```typescript
const tx = await shariaDCA.executeDCAOrder(orderId);
await tx.wait();
```

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

- **WGLMR**: `0xD909178CC99d318e4D46e7E66a972955859670E1`
- **StellaSwap Router**: `0x8Ac868293D97761A1fED6d4A01E9FF17C5594Aa3`

## 🔐 Security

- All contracts use OpenZeppelin's battle-tested libraries
- ReentrancyGuard on all state-changing functions
- Ownable pattern for admin functions
- SafeERC20 for token transfers
- Custom errors for gas efficiency

## 📚 Resources

- **Setup Guide**: See [SETUP.md](./SETUP.md) for quick start and troubleshooting
- **Migration Guide**: See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for Ink! → Solidity details
- **Moonbeam Docs**: https://docs.moonbeam.network/
- **StellaSwap**: https://stellaswap.com/
- **BeamSwap**: https://beamswap.io/
- **Chainlink Automation**: https://automation.chain.link/
- **Hardhat**: https://hardhat.org/

## 🛠️ Development

### Project Structure

```
Tayeb/
├── contracts/           # Solidity smart contracts
│   ├── ShariaCompliance.sol
│   ├── ShariaSwap.sol
│   ├── ShariaETF.sol
│   ├── ShariaDCA.sol
│   └── interfaces/
│       └── IDEXRouter.sol
├── scripts/            # Deployment scripts
│   └── deploy.ts
├── test/              # Test files
│   └── ShariaCompliance.test.ts
├── hardhat.config.ts  # Hardhat configuration
├── package.json       # Dependencies
└── README.md         # This file
```

### Adding New Features

1. Create new contract in `contracts/`
2. Add deployment logic in `scripts/deploy.ts`
3. Write tests in `test/`
4. Update README with usage examples

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
