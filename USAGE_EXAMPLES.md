# Usage Examples

This document contains detailed code examples for integrating with the Tayeb platform.

## 📋 Table of Contents

- [Post-Deployment Setup](#post-deployment-setup)
- [Coin Management Workflow](#coin-management-workflow)
- [Executing Swaps](#executing-swaps)
- [Creating DCA Orders](#creating-dca-orders)
- [Setting Up Automation](#setting-up-automation)

## Post-Deployment Setup

After deployment, all token addresses are automatically registered. Access deployed addresses:

```typescript
// Frontend example
import halaCoins from './config/halaCoins.json';
import deployedContracts from './config/deployedContracts.json';

// Connect to contracts
const shariaSwap = new ethers.Contract(
  deployedContracts.main.shariaSwap,
  shariaSwapABI,
  provider
);

// Get token addresses
const btcAddress = halaCoins.coins.find(c => c.symbol === "BTC")?.addresses.moonbeam;
const ethAddress = halaCoins.coins.find(c => c.symbol === "ETH")?.addresses.moonbeam;
const usdtAddress = halaCoins.coins.find(c => c.symbol === "USDT")?.addresses.moonbeam;
```

### React/Next.js Example

```typescript
import { ethers } from "ethers";
import { BrowserProvider } from "ethers";
import ShariaSwapABI from "./artifacts/contracts/ShariaSwap.sol/ShariaSwap.json";
import deployedContracts from "./config/deployedContracts.json";

function useShariaSwap() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [shariaSwap, setShariaSwap] = useState<ethers.Contract | null>(null);

  useEffect(() => {
    if (window.ethereum) {
      const provider = new BrowserProvider(window.ethereum);
      setProvider(provider);
      
      const contract = new ethers.Contract(
        deployedContracts.main.shariaSwap,
        ShariaSwapABI.abi,
        await provider.getSigner()
      );
      setShariaSwap(contract);
    }
  }, []);

  return { provider, shariaSwap };
}
```

## Coin Management Workflow

### Contract is Source of Truth

The ShariaCompliance contract is the authoritative source for coin registrations. When you add/remove coins on-chain:

**1. Owner calls contract functions:**
```solidity
// Add coin
shariaCompliance.registerShariaCoin("NEW", "New Token", "NEW", "Compliance reason");

// Remove coin
shariaCompliance.removeShariaCoin("OLD");

// Update status
shariaCompliance.updateComplianceStatus("TOKEN", false, "Reason for removal");
```

**2. Sync JSON from contract:**

**Manual Sync:**
```bash
npm run sync:coins
```
- Reads all coins from contract
- Updates `halaCoins.json` to match contract state
- Adds new coins, marks removed ones as `permissible: false`
- Updates token addresses in `deployedContracts.json`

**Auto Sync (Continuous):**
```bash
npm run listen:events
```
- Listens to `CoinRegistered`, `CoinRemoved`, `CoinUpdated` events
- Automatically updates JSON files when events occur
- Runs continuously (Press Ctrl+C to stop)

### Permissible Flag

- `permissible: true` - Coin is registered and verified in contract
- `permissible: false` - Coin removed from contract (kept in JSON for history)

### Adding New Coins

**Method 1: On-Chain (Recommended)**
1. Deploy token contract (if needed): `npm run deploy:tokens`
2. Owner calls `registerShariaCoin()` on contract
3. Run `npm run sync:coins` (or use listener)
4. JSON automatically updated

**Method 2: Via JSON First**
1. Add coin to `halaCoins.json`
2. Deploy token: `npm run deploy:tokens` (deploys new token)
3. Ensure liquidity exists on your chosen router before enabling swaps for the token
4. Run `npm run deploy:core` (registers new coin in ShariaCompliance)
5. Confirm router/liquidity: point at an existing Uniswap V2 router with sufficient liquidity for your path

### Code Example: Register Coin from Frontend

```typescript
import deployedContracts from './config/deployedContracts.json';
import ShariaComplianceABI from './artifacts/contracts/ShariaCompliance.sol/ShariaCompliance.json';

const shariaCompliance = new ethers.Contract(
  deployedContracts.main.shariaCompliance,
  ShariaComplianceABI.abi,
  signer // Owner account
);

// Register a new coin
const tx = await shariaCompliance.registerShariaCoin(
  "NEW",
  "New Token",
  "NEW",
  "Compliance reason"
);

await tx.wait();
console.log("Coin registered!");

// Then sync JSON files
// Run: npm run sync:coins
```

## Executing Swaps

> **💡 Routing Control**: You now provide the exact path. If ETH → BTC liquidity is best through USDC, pass `[ETH, USDC, BTC]`. This keeps routing transparent and lets you integrate any off-chain pathfinder.

### Swap DEV for Token

```typescript
// Swap DEV for USDT (Sharia-compliant)
// Get addresses from JSON configs
import halaCoins from './config/halaCoins.json';
import deployedContracts from './config/deployedContracts.json';

const shariaSwap = new ethers.Contract(
  deployedContracts.main.shariaSwap,
  shariaSwapABI,
  provider
);

const usdtCoin = halaCoins.coins.find(c => c.symbol === "USDT");
const USDT_ADDRESS = usdtCoin?.addresses.moonbeam;

const amountIn = ethers.parseEther("1.0"); // 1 DEV
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

### Swap Token for Token

```typescript
// Swap BTC for ETH
// Note: If no direct BTC/ETH pair exists, this will automatically route through USDC (BTC → USDC → ETH)
import halaCoins from './config/halaCoins.json';
import deployedContracts from './config/deployedContracts.json';

const shariaSwap = new ethers.Contract(
  deployedContracts.main.shariaSwap,
  shariaSwapABI,
  signer
);

const WETH_ADDRESS = deployedContracts.amm.weth!;

const btcCoin = halaCoins.coins.find(c => c.symbol === "BTC");
const ethCoin = halaCoins.coins.find(c => c.symbol === "ETH");

const BTC_ADDRESS = btcCoin?.addresses.moonbeam;
const ETH_ADDRESS = ethCoin?.addresses.moonbeam;

// Approve first (if needed)
const btcToken = new ethers.Contract(BTC_ADDRESS, ERC20_ABI, signer);
await btcToken.approve(shariaSwap.target, ethers.MaxUint256);

// Build an explicit route (e.g. BTC -> USDC -> ETH)
const usdcCoin = halaCoins.coins.find(c => c.symbol === "USDC");
const USDC_ADDRESS = usdcCoin?.addresses.moonbeam;
const amountIn = ethers.parseUnits("0.1", 8); // 0.1 BTC (8 decimals)
const path = [BTC_ADDRESS, USDC_ADDRESS, ETH_ADDRESS];

const quote = await shariaSwap.getSwapQuote(path, amountIn);
console.log(`Expected output: ${ethers.formatEther(quote)} ETH`);

// Execute swap
const minAmountOut = quote * BigInt(95) / BigInt(100); // 5% slippage tolerance
const deadline = Math.floor(Date.now() / 1000) + 60 * 15;

const tx = await shariaSwap.swapShariaCompliant(
  path,
  amountIn,
  minAmountOut,
  deadline
);

const receipt = await tx.wait();
console.log("Swap completed!", receipt.transactionHash);
```

### Get Swap Quote

```typescript
// Get price estimate before swapping
const amountIn = ethers.parseEther("1.0"); // 1 DEV
const path = [WETH_ADDRESS, USDT_ADDRESS];
const quote = await shariaSwap.getSwapQuote(path, amountIn);

console.log(`1 DEV = ${ethers.formatUnits(quote, 6)} USDT`);
```

### View Swap History

```typescript
// Get user's swap history
const history = await shariaSwap.getUserSwapHistory(userAddress);

history.forEach((swap, index) => {
  console.log(`Swap ${index + 1}:`);
  console.log(`  Token In: ${swap.tokenIn}`);
  console.log(`  Token Out: ${swap.tokenOut}`);
  console.log(`  Amount In: ${swap.amountIn}`);
  console.log(`  Amount Out: ${swap.amountOut}`);
  console.log(`  Timestamp: ${new Date(Number(swap.timestamp) * 1000)}`);
});
```

## Creating DCA Orders

### Basic DCA Order (DEV → Token)

```typescript
// DCA: Invest 1 DEV into USDT every day for 30 days
import deployedContracts from './config/deployedContracts.json';

const shariaDCA = new ethers.Contract(
  deployedContracts.main.shariaDCA,
  shariaDCAABI,
  signer
);

const usdtCoin = halaCoins.coins.find(c => c.symbol === "USDT");
const USDT_ADDRESS = usdtCoin?.addresses.moonbeam!;

const amountPerInterval = ethers.parseEther("1"); // 1 DEV per interval
const intervalSeconds = 86400; // 1 day (24 hours)
const totalIntervals = 30; // 30 days total
const totalDeposit = amountPerInterval * BigInt(totalIntervals); // 30 DEV total

const path = [WETH_ADDRESS, USDT_ADDRESS];
const tx = await shariaDCA.createDCAOrderWithDEV(
  USDT_ADDRESS,
  path,
  amountPerInterval,
  intervalSeconds,
  totalIntervals,
  { value: totalDeposit }
);

const receipt = await tx.wait();
console.log("DCA order created!");

// Get order ID from event
const event = receipt.logs.find(log => 
  log.topics[0] === ethers.id("DCAOrderCreated(uint256,address,string,string,uint256,uint256,uint256)")
);
const orderId = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], event.topics[1])[0];
console.log(`Order ID: ${orderId}`);
```

### DCA with Different Intervals

```typescript
// Weekly DCA: Invest 5 DEV into BTC every week for 12 weeks
const amountPerInterval = ethers.parseEther("5"); // 5 DEV per week
const intervalSeconds = 604800; // 1 week (7 days)
const totalIntervals = 12; // 12 weeks
const totalDeposit = amountPerInterval * BigInt(totalIntervals); // 60 DEV total

const btcPath = [WETH_ADDRESS, BTC_ADDRESS];
const tx = await shariaDCA.createDCAOrderWithDEV(
  BTC_ADDRESS,
  btcPath,
  amountPerInterval,
  intervalSeconds,
  totalIntervals,
  { value: totalDeposit }
);
```

### Token → Token DCA (NEW!)

```typescript
// DCA: Invest 100 USDC into BTC every day for 30 days
import halaCoins from './config/halaCoins.json';

const usdcCoin = halaCoins.coins.find(c => c.symbol === "USDC");
const USDC_ADDRESS = usdcCoin?.addresses.moonbeam;

// First, approve ShariaDCA to spend your USDC
const usdcToken = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
const amountPerInterval = ethers.parseUnits("100", 6); // 100 USDC (6 decimals)
const totalIntervals = 30;
const totalRequired = amountPerInterval * BigInt(totalIntervals); // 3000 USDC

await usdcToken.approve(deployedContracts.main.shariaDCA, totalRequired);

// Create DCA order (no ETH value needed for ERC20)
const usdcToBtcPath = [USDC_ADDRESS!, WETH_ADDRESS, BTC_ADDRESS!];
const tx = await shariaDCA.createDCAOrderWithToken(
  USDC_ADDRESS!,
  BTC_ADDRESS!,
  usdcToBtcPath,
  amountPerInterval,
  86400,            // Daily
  totalIntervals
);

const receipt = await tx.wait();
console.log("USDC → BTC DCA order created!");
```

### More Token → Token Examples

```typescript
// Example 1: ETH → USDT DCA
const sourceSymbol = "ETH";
const targetSymbol = "USDT";
const amountPerInterval = ethers.parseEther("0.1"); // 0.1 ETH
const intervalSeconds = 86400; // Daily
const totalIntervals = 30;

// Approve ETH token first
const ethToken = new ethers.Contract(ETH_ADDRESS, ERC20_ABI, signer);
await ethToken.approve(shariaDCA.target, amountPerInterval * BigInt(totalIntervals));

const ethToUsdtPath = [ETH_ADDRESS!, USDC_ADDRESS!, USDT_ADDRESS];
const tx = await shariaDCA.createDCAOrderWithToken(
  ETH_ADDRESS!,
  USDT_ADDRESS,
  ethToUsdtPath,
  amountPerInterval,
  intervalSeconds,
  totalIntervals
);

// Example 2: BTC → SOL DCA
// Explicit path through USDC
const solCoin = halaCoins.coins.find(c => c.symbol === "SOL");
const SOL_ADDRESS = solCoin?.addresses.moonbeam!;
const btcToSolPath = [BTC_ADDRESS!, USDC_ADDRESS!, SOL_ADDRESS];
const tx2 = await shariaDCA.createDCAOrderWithToken(
  BTC_ADDRESS!,
  SOL_ADDRESS,
  btcToSolPath,
  ethers.parseUnits("0.01", 8), // 0.01 BTC
  604800,   // Weekly
  12        // 12 weeks
);
```

### Get DCA Order Details

```typescript
// Get order information
const order = await shariaDCA.getDCAOrder(orderId);
const path = await shariaDCA.getOrderPath(orderId);

console.log(`Order ID: ${orderId}`);
console.log(`Owner: ${order.owner}`);
console.log(`Source Token: ${order.sourceToken}`);
console.log(`Target Token: ${order.targetToken}`);
console.log(`Stored Path: ${path.join(" -> ")}`);
console.log(`Amount Per Interval: ${ethers.formatUnits(order.amountPerInterval, 18)} (check decimals)`);
console.log(`Interval: ${order.interval} seconds`);
console.log(`Total Intervals: ${order.totalIntervals}`);
console.log(`Completed Intervals: ${order.intervalsCompleted}`);
console.log(`Next Execution: ${new Date(Number(order.nextExecutionTime) * 1000)}`);
console.log(`Active: ${order.isActive}`);
```

### Get User's DCA Orders

```typescript
// Get all orders for a user
const orders = await shariaDCA.getUserOrders(userAddress);

orders.forEach((orderId, index) => {
  console.log(`Order ${index + 1}: ${orderId}`);
  // Get full order details
  shariaDCA.getDCAOrder(orderId).then(order => {
    console.log(`  Target: ${order.targetSymbol}`);
    console.log(`  Progress: ${order.completedIntervals}/${order.totalIntervals}`);
  });
});
```

### Cancel DCA Order

```typescript
// Cancel order and get refund for uncompleted intervals
const order = await shariaDCA.getDCAOrder(orderId);
const remainingIntervals = order.totalIntervals - order.completedIntervals;
const refundAmount = order.amountPerInterval * BigInt(remainingIntervals);

console.log(`Canceling order ${orderId}...`);
console.log(`Refund: ${ethers.formatEther(refundAmount)} DEV`);

const tx = await shariaDCA.cancelDCAOrder(orderId);
const receipt = await tx.wait();
console.log("Order canceled! Refund will be sent to your address.");
```

### Manual DCA Execution

```typescript
// Execute DCA order manually
const tx = await shariaDCA.executeDCAOrder(orderId);
const receipt = await tx.wait();
console.log("DCA interval executed!", receipt.transactionHash);
```

## Setting Up Automation

### Automatic DCA Execution

For automatic DCA execution, use the local automation script:

1. Ensure your `.env` file has `PRIVATE_KEY` set (executor wallet)
2. Ensure the executor wallet has DEV tokens for gas
3. Run the automation script:
   ```bash
   npx hardhat run scripts/automation/auto-execute-dca.ts --network moonbeam
   ```
4. The script will check every 60 seconds and execute ready orders automatically
5. Keep the script running for continuous automation

### Manual Execution

You can also execute orders manually:

```typescript
// Check if order is ready for execution
const order = await shariaDCA.getDCAOrder(orderId);
const currentTime = Math.floor(Date.now() / 1000);

if (Number(order.nextExecutionTime) <= currentTime && order.isActive) {
  console.log("Order is ready for execution!");
  
  const tx = await shariaDCA.executeDCAOrder(orderId);
  const receipt = await tx.wait();
  console.log("DCA executed!", receipt.transactionHash);
} else {
  console.log("Order not ready yet. Next execution:", new Date(Number(order.nextExecutionTime) * 1000));
}
```

### Check Upkeep Status

```typescript
// Check if upkeep is needed (for automation script)
const [upkeepNeeded, performData] = await shariaDCA.checkUpkeep("0x");

if (upkeepNeeded) {
  console.log("Upkeep needed! Orders ready for execution.");
  const orderIds = ethers.AbiCoder.defaultAbiCoder().decode(
    ["uint256[]"],
    performData
  )[0];
  console.log("Ready orders:", orderIds);
  
  // Execute via automation script or manually call performUpkeep()
} else {
  console.log("No upkeep needed at this time.");
}
```

### One-Time Execution Script

For cron jobs or scheduled tasks, use the one-time execution script:

```bash
npx hardhat run scripts/automation/execute-ready-orders.ts --network moonbeam
```

This script executes all ready orders once and exits, perfect for GitHub Actions or cron jobs.

## Integration with ShariaCompliance

### Check Token Compliance

```typescript
import deployedContracts from './config/deployedContracts.json';

const shariaCompliance = new ethers.Contract(
  deployedContracts.main.shariaCompliance,
  shariaComplianceABI,
  provider
);

// Check if a token is Sharia-compliant
const symbol = "BTC";
const isCompliant = await shariaCompliance.isShariaCompliant(symbol);
console.log(`${symbol} is ${isCompliant ? "compliant" : "not compliant"}`);

// Get all compliant tokens
const allCoins = await shariaCompliance.getAllShariaCoins();
allCoins.forEach(coin => {
  console.log(`${coin.symbol}: ${coin.name} - ${coin.complianceReason}`);
});
```

### Get Token Address from Contract

```typescript
// Get token address from ShariaCompliance contract
const symbol = "USDT";
const tokenAddress = await shariaCompliance.symbolToAddress(symbol);
console.log(`${symbol} address: ${tokenAddress}`);
```

## Error Handling

### Example with Error Handling

```typescript
async function swapTokens(tokenIn: string, tokenOut: string, amountIn: bigint) {
  try {
    const shariaSwap = new ethers.Contract(
      deployedContracts.main.shariaSwap,
      shariaSwapABI,
      signer
    );

    // Check compliance first
    const shariaCompliance = new ethers.Contract(
      deployedContracts.main.shariaCompliance,
      shariaComplianceABI,
      provider
    );

    const isCompliant = await shariaCompliance.isShariaCompliant(tokenOut);
    if (!isCompliant) {
      throw new Error(`${tokenOut} is not Sharia-compliant`);
    }

    // Get quote
    const quote = await shariaSwap.getSwapQuote(tokenIn, tokenOut, amountIn);
    const minAmountOut = quote * BigInt(95) / BigInt(100); // 5% slippage
    const deadline = Math.floor(Date.now() / 1000) + 60 * 15;

    // Execute swap
    const tx = await shariaSwap.swapShariaCompliant(
      tokenIn,
      tokenOut,
      amountIn,
      minAmountOut,
      deadline
    );

    const receipt = await tx.wait();
    console.log("Swap successful!", receipt.transactionHash);
    return receipt;
  } catch (error: any) {
    console.error("Swap failed:", error.message);
    throw error;
  }
}
```

## Debugging Failed Transactions

### Decode Failed Transaction Script

If a transaction fails, use the decode script to understand what went wrong:

```bash
# Using environment variable
TX_HASH=0x773aac5810a73346407eccc695b23aa9197653b4d306effe58f2714683509a23 \
npx hardhat run scripts/decode-failed-tx.ts --network moonbeam
```

## Frontend Integration (React Example)

```typescript
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { BrowserProvider } from 'ethers';
import deployedContracts from './config/deployedContracts.json';
import ShariaSwapABI from './artifacts/contracts/ShariaSwap.sol/ShariaSwap.json';

function SwapInterface() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [shariaSwap, setShariaSwap] = useState<ethers.Contract | null>(null);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    async function connect() {
      if (window.ethereum) {
        const provider = new BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(
          deployedContracts.main.shariaSwap,
          ShariaSwapABI.abi,
          signer
        );
        
        setProvider(provider);
        setSigner(signer);
        setShariaSwap(contract);
      }
    }
    connect();
  }, []);

  const handleSwap = async () => {
    if (!shariaSwap || !amount) return;
    
    try {
      const amountIn = ethers.parseEther(amount);
      const minAmountOut = 0; // Calculate based on quote
      const deadline = Math.floor(Date.now() / 1000) + 60 * 15;
      
      const tx = await shariaSwap.swapGLMRForToken(
        USDT_ADDRESS,
        minAmountOut,
        deadline,
        { value: amountIn }
      );
      
      await tx.wait();
      alert('Swap successful!');
    } catch (error) {
      console.error('Swap failed:', error);
      alert('Swap failed. Please try again.');
    }
  };

  return (
    <div>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount in DEV"
      />
      <button onClick={handleSwap}>Swap</button>
    </div>
  );
}
```

---

For more information, see:
- [README.md](./README.md) - Main documentation
- [SETUP.md](./SETUP.md) - Setup and deployment guide
- [DEPLOYMENT_WORKFLOW.md](./DEPLOYMENT_WORKFLOW.md) - Deployment workflow details

