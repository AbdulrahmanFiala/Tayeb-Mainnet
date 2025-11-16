# XCM Cross-Chain Swaps - Quick Start Guide

## Overview

Execute Sharia-compliant token swaps from Moonbeam to Hydration using XCM (Cross-Consensus Messaging).

## Prerequisites

1. Moonbeam wallet with GLMR for gas
2. Source tokens (e.g., USDT, USDC, DOT) on Moonbeam
3. CrosschainSwapInitiator contract deployed

## Supported Tokens

| Symbol   | Moonbeam Address                              | Hydration Asset | Decimals |
|----------|-----------------------------------------------|-----------------|----------|
| USDT     | 0xffffffffea09fb06d082fd1275cd48b191cbcd1d    | 10              | 6        |
| USDC_XC  | 0xffffffff7d2b0b761af01ca8e25242976ac0ad7d    | 21              | 6        |
| DOT      | 0xffffffff1fcacbd218edc0eba20fc2308c778080    | 5               | 10       |
| GLMR     | 0xacc15dc74880c9944775448304b263d191cbcd1d    | 16              | 18       |
| WBTC_WH  | 0xe57ebd2d67b462e9926e04a8e33f01cd0d64346d    | 19              | 8        |
| ETH_WH   | 0xab3f0245b83feb11d15aaffefd7ad465a59817ed    | 20              | 18       |

See `config/xcmConfig.json` for the complete list.

## Interactive Swap (Recommended)

### 1. Run the script

```bash
npx hardhat run scripts/xcm/initiate-remote-swap.ts --network moonbeam
```

### 2. Follow the prompts

```
Enter source token address (on Moonbeam): 0xffffffffea09fb06d082fd1275cd48b191cbcd1d
Enter target token address (on Hydration): 0xffffffff1fcacbd218edc0eba20fc2308c778080
Enter amount to swap (in token units): 100
Enter minimum output amount: 10
```

### 3. Confirm the swap

The script will:
- ✅ Validate Sharia compliance
- ✅ Connect to Hydration and encode the swap call
- ✅ Approve tokens
- ✅ Initiate the swap
- ✅ Show you the swap ID and XCM message hash

### 4. Monitor status

- **Moonbeam**: Check transaction on [Moonscan](https://moonscan.io/)
- **XCM Message**: Track on [Polkadot Subscan](https://polkadot.subscan.io/)
- **Hydration**: Verify execution on [Hydration Subscan](https://hydration.subscan.io/)

## Programmatic Swap (For Developers)

```typescript
import { ethers } from "hardhat";
import { 
  connectToHydration, 
  loadXcmConfig, 
  getTokenInfo, 
  encodeOmnipoolSell 
} from "./scripts/xcm/encode-hydration-swap";

async function swapUSDTtoDOT() {
  const [signer] = await ethers.getSigners();
  
  // Addresses
  const sourceToken = "0xffffffffea09fb06d082fd1275cd48b191cbcd1d"; // USDT
  const targetToken = "0xffffffff1fcacbd218edc0eba20fc2308c778080"; // DOT
  
  // Load config and connect to Hydration
  const xcmConfig = loadXcmConfig();
  const api = await connectToHydration(xcmConfig.hydration.rpcUrl);
  
  // Get token info
  const sourceInfo = getTokenInfo(xcmConfig, sourceToken);
  const targetInfo = getTokenInfo(xcmConfig, targetToken);
  
  // Encode Omnipool call
  const amountIn = (100 * Math.pow(10, sourceInfo.decimals)).toString(); // 100 USDT
  const minOut = (10 * Math.pow(10, targetInfo.decimals)).toString(); // Min 10 DOT
  
  const encodedCall = await encodeOmnipoolSell(
    api,
    sourceInfo.assetId,
    targetInfo.assetId,
    amountIn,
    minOut
  );
  
  await api.disconnect();
  
  // Get contract
  const crosschainSwap = await ethers.getContractAt(
    "CrosschainSwapInitiator",
    "0x..." // From config/deployedContracts.json
  );
  
  // Approve tokens
  const token = await ethers.getContractAt("IERC20", sourceToken);
  await token.approve(crosschainSwap.address, ethers.parseUnits("100", 6));
  
  // Initiate swap
  const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const tx = await crosschainSwap.initiateRemoteSwap(
    sourceToken,
    targetToken,
    ethers.parseUnits("100", 6),
    ethers.parseUnits("10", 10),
    deadline,
    encodedCall
  );
  
  const receipt = await tx.wait();
  console.log("Swap initiated:", receipt.hash);
}
```

## Frontend Integration

### Step 1: Install Dependencies

```bash
npm install @polkadot/api ethers
```

### Step 2: Import Functions

```typescript
import { ApiPromise, WsProvider } from '@polkadot/api';
import xcmConfig from './config/xcmConfig.json';
```

### Step 3: Encode Call

```typescript
async function encodeSwapCall(
  sourceAddress: string,
  targetAddress: string,
  amountIn: string,
  minAmountOut: string
) {
  // Connect to Hydration
  const provider = new WsProvider(xcmConfig.hydration.rpcUrl);
  const api = await ApiPromise.create({ provider });
  
  // Get token info from mapping
  const sourceInfo = xcmConfig.tokenMapping.moonbeamToHydration[sourceAddress.toLowerCase()];
  const targetInfo = xcmConfig.tokenMapping.moonbeamToHydration[targetAddress.toLowerCase()];
  
  // Encode call
  const call = api.tx.omnipool.sell(
    sourceInfo.assetId,
    targetInfo.assetId,
    amountIn,
    minAmountOut
  );
  
  const encodedCall = call.method.toHex();
  
  await api.disconnect();
  return encodedCall;
}
```

### Step 4: Execute Swap

```typescript
const encodedCall = await encodeSwapCall(
  sourceToken,
  targetToken,
  amountInSmallestUnit,
  minAmountOutSmallestUnit
);

const tx = await crosschainSwapContract.initiateRemoteSwap(
  sourceToken,
  targetToken,
  amount,
  minOut,
  deadline,
  encodedCall
);
```

## Common Issues

### 1. "Token address not found in mapping"

**Cause:** Token not supported for XCM swaps

**Solution:** Check `config/xcmConfig.json` for supported tokens, or add the token to the mapping

### 2. "XCM Transfer Failed"

**Cause:** Insufficient HDX in Moonbeam's sovereign account on Hydration

**Solution:** Fund the sovereign account: `0x7369626cd1070000000000000000000000000000000000000000000000000000`

### 3. "Swap stuck in Initiated status"

**Cause:** XCM message not delivered or Omnipool execution failed

**Solution:**
- Check XCM message on [Polkadot Subscan](https://polkadot.subscan.io/)
- Verify HRMP channels are open
- Check Omnipool liquidity for the pair

### 4. "Not Sharia Compliant"

**Cause:** Target token not registered or not permissible

**Solution:** Register the token in ShariaCompliance contract first

## Testing

### Test Encoding (No Transactions)

```bash
npx ts-node scripts/xcm/test-encoding.ts
```

This validates:
- Token mapping
- Hydration RPC connection
- SCALE encoding
- Call format

### Test Small Swap (Mainnet)

1. Start with a small amount (10-20 USDT)
2. Use the interactive script
3. Monitor the XCM message
4. Verify swap execution on Hydration
5. Check for returned tokens

## Gas Costs

- **Moonbeam transaction**: ~500,000 gas (~0.0005 GLMR)
- **XCM message fee**: ~0.1 GLMR (configurable)
- **Hydration execution**: Paid from sovereign account
- **Omnipool swap fee**: 0.3% of swap amount

**Total**: ~0.1005 GLMR + 0.3% of swap

## Monitoring

### Check Swap Status

```typescript
const swap = await crosschainSwap.getSwap(swapId);
console.log("Status:", swap.status);
// 0 = Pending
// 1 = Initiated
// 2 = Completed
// 3 = Failed
// 4 = Cancelled
```

### Cancel Swap (If Failed)

```typescript
await crosschainSwap.cancelSwap(swapId);
```

Note: Only works for Failed or Pending swaps.

## Resources

- **Full Guide**: [XCM_INTEGRATION.md](./XCM_INTEGRATION.md)
- **Implementation Details**: [XCM_IMPLEMENTATION_V2.md](../XCM_IMPLEMENTATION_V2.md)
- **Quick Reference**: [XCM_QUICK_REFERENCE.md](./XCM_QUICK_REFERENCE.md)

## Support

For issues or questions:
1. Check the [troubleshooting section](./XCM_INTEGRATION.md#monitoring--debugging)
2. Open a GitHub issue
3. Contact the Tayeb team

---

**Last Updated:** November 12, 2025  
**Version:** 2.0.0

