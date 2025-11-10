# XCM Cross-Chain Integration Guide

## Overview

This guide explains how to use Tayeb's cross-chain swap functionality to execute Sharia-compliant swaps from Moonbeam to Hydration using Polkadot's Cross-Consensus Messaging (XCM) protocol.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Moonbeam (Mainnet)                             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  User Wallet                                             │   │
│  │    ↓                                                     │   │
│  │  ShariaCompliance (validates target token)               │   │
│  │    ↓                                                     │   │
│  │  RemoteSwapInitiator (locks source tokens, builds XCM)   │   │
│  │    ↓                                                     │   │
│  │  XCM Transactor Precompile (0x0806)                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ XCM Message
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│         Relay Chain (Polkadot Mainnet / Rococo Testnet)         │
│                Routes & schedules XCM execution                 │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Hydration (Omnipool parachain)                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Receives XCM Message                                    │   │
│  │    ↓                                                     │   │
│  │  Omnipool Pallet (executes swap)                         │   │
│  │    ↓                                                     │   │
│  │  XCM Transfer (returns swapped asset)                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            │ XCM Message (return)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│             User receives swapped tokens back on Moonbeam       │
└─────────────────────────────────────────────────────────────────┘
```

## Prerequisites

Before using cross-chain swaps, ensure the following infrastructure is in place:

### 1. HRMP Channels

Bidirectional HRMP (Horizontal Relay-routed Message Passing) channels must exist between Moonbeam and Hydration.

**Check channel status:**
- Visit [Polkadot.js Apps](https://polkadot.js.org/apps/)
- Connect to Rococo relay chain
- Navigate to: Network → Parachains → HRMP
- Verify channels exist: Moonbeam (2004) ↔ Hydration (2034)

**If channels don't exist:**
Channels are typically established by parachain teams through governance. Contact Moonbeam or Hydration teams if needed.

### 2. Asset Registration

Cross-chain assets must be registered as XC-20 tokens on both chains.

**On Moonbeam:**
- Assets from Hydration must be registered as XC-20s
- XC-20s are ERC-20 compatible tokens representing cross-chain assets
- Check registered assets: [Moonbeam XC-20 Registry](https://docs.moonbeam.network/builders/interoperability/xcm/xc20/overview/)

**On Hydration:**
- Moonbeam's native token (GLMR) must be registered
- Check Hydration's asset registry via Polkadot.js Apps

### 3. Sovereign Account Funding

Moonbeam's sovereign account on Hydration must have sufficient HDX tokens for XCM execution fees.

**Sovereign Account Address:**
```
0x7369626cd1070000000000000000000000000000000000000000000000000000
```

**Check balance:**
1. Visit [Hydration Subscan](https://hydration.subscan.io/)
2. Search for the sovereign account address
3. Verify HDX balance > 0

**Fund if needed:**
Send HDX tokens to the sovereign account from any Hydration wallet.

### 4. Testnet Tokens

**Fund GLMR (Moonbeam):**
- Acquire GLMR via exchange or bridge (production)
- Ensure your Moonbeam account is funded before initiating swaps

**Get HDX tokens (Hydration):**
- Request from Hydration team or fund via cross-chain transfer
- Required for: testing swaps, liquidity

## Deployment

### 1. Install Dependencies

```bash
npm install
```

This installs:
- `@polkadot/api` - Substrate RPC interaction
- `@polkadot/api-augment` - Type definitions
- `@moonbeam-network/xcm-sdk` - XCM message construction

### 2. Deploy Core Contracts

First, deploy the essential on-chain components:

```bash
npx hardhat run scripts/deploy/deploy-core.ts --network moonbeam
```

This deploys:
- ShariaCompliance (token registry)
- RemoteSwapInitiator (XCM bridge entrypoint)

To deploy the full Tayeb stack (adds ShariaSwap + ShariaDCA), run:

```bash
npm run deploy:moonbeam
```

Both scripts write addresses and metadata to `config/deployedContracts.json`.

**Configuration used:**
- ShariaCompliance address (from previous deployment)
- XCM Transactor precompile: `0x0000000000000000000000000000000000000806`
- Hydration parachain ID: `2034`
- Omnipool pallet index: `75`
- Sell call index: `0`

### 3. Fund the Contract

The RemoteSwapInitiator needs native DEV for XCM fees:

```bash
# Send 1 DEV to the contract
cast send <RemoteSwapInitiator_Address> --value 1ether --private-key $PRIVATE_KEY --rpc-url $MOONBEAM_RPC_URL
```

Or use MetaMask to send DEV directly to the contract address.

## Usage

### Interactive Swap

Use the interactive script to initiate a cross-chain swap:

```bash
npx hardhat run scripts/xcm/initiate-remote-swap.ts --network moonbeam
```

The script will:
1. Display available assets on Hydration
2. Prompt for source token, target token, and amounts
3. Validate Sharia compliance
4. Approve tokens
5. Initiate the swap
6. Monitor swap status
7. Display troubleshooting tips

### Programmatic Swap

```typescript
import { ethers } from "hardhat";

async function executeRemoteSwap() {
  const [signer] = await ethers.getSigners();
  
  // Get contract instance
  const remoteSwapInitiator = await ethers.getContractAt(
    "RemoteSwapInitiator",
    "0x..." // Address from deployedContracts.json
  );
  
  // Token addresses
  const sourceToken = "0x..."; // USDT (XC-20) on Moonbeam
  const targetToken = "0x..."; // HDX on Hydration
  
  // Amounts (in wei)
  const amount = ethers.parseEther("100"); // 100 USDT
  const minOut = ethers.parseEther("50"); // Min 50 HDX
  
  // Deadline (1 hour from now)
  const deadline = Math.floor(Date.now() / 1000) + 3600;
  
  // Approve tokens
  const token = await ethers.getContractAt("IERC20", sourceToken);
  await token.approve(remoteSwapInitiator.address, amount);
  
  // Initiate swap
  const tx = await remoteSwapInitiator.initiateRemoteSwap(
    sourceToken,
    targetToken,
    amount,
    minOut,
    deadline
  );
  
  const receipt = await tx.wait();
  console.log("Swap initiated:", receipt.hash);
  
  // Get swap ID from event
  const event = receipt.logs.find(log => 
    log.topics[0] === remoteSwapInitiator.interface.getEvent("RemoteSwapInitiated").topicHash
  );
  
  const swapId = event.topics[1];
  console.log("Swap ID:", swapId);
  
  // Monitor status
  const swap = await remoteSwapInitiator.getSwap(swapId);
  console.log("Status:", swap.status); // 0=Pending, 1=Initiated, 2=Completed, 3=Failed
}
```

### Cancel Swap

If a swap is stuck or failed, you can cancel it to recover your tokens:

```typescript
await remoteSwapInitiator.cancelSwap(swapId);
```

**Note:** Only works for swaps in Pending or Failed status.

## Hydration Omnipool Integration

### Supported Assets

The Omnipool on Hydration supports multiple assets. Check `config/xcmConfig.json` for the current registry:

```json
{
  "HDX": 0,
  "DOT": 5,
  "USDT": 10,
  "USDC": 21,
  "DAI": 18,
  "WETH": 20,
  "WBTC": 19
}
```

### Encoding Swap Calls

To properly encode Omnipool calls for XCM execution:

```bash
npx hardhat run scripts/xcm/encode-hydration-swap.ts
```

This script:
1. Connects to Hydration testnet
2. Encodes `omnipool.sell()` and `omnipool.buy()` calls
3. Outputs hex-encoded call data for XCM Transact

**Example output:**
```
📦 Encoded Omnipool Sell Call:
   Asset In: 10 (USDT)
   Asset Out: 0 (HDX)
   Amount: 100000000
   Min Buy Amount: 1000000000000
   Encoded: 0x4b00...
```

### Swap Types

**Sell (Exact Input):**
- You specify exact amount to sell
- Receive variable amount based on price
- Use: `omnipool.sell(assetIn, assetOut, amount, minBuyAmount)`

**Buy (Exact Output):**
- You specify exact amount to receive
- Pay variable amount based on price
- Use: `omnipool.buy(assetOut, assetIn, amount, maxSellAmount)`

## XCM Message Structure

The RemoteSwapInitiator constructs XCM messages with the following structure:

```
XCM Message [
  WithdrawAsset {
    assets: MultiAsset (source token)
    amount: swap amount
  },
  BuyExecution {
    fees: MultiAsset (HDX for execution)
    weight_limit: Unlimited
  },
  Transact {
    origin_type: SovereignAccount
    require_weight_at_most: 1,000,000,000
    call: EncodedCall (omnipool.sell)
  },
  DepositAsset {
    assets: All (swapped tokens)
    beneficiary: MultiLocation (user on Moonbeam)
  }
]
```

### Key Parameters

**Multilocation (Destination):**
```solidity
{
  parents: 1, // Parent relay chain
  interior: [Parachain(2034)] // Hydration
}
```

**Fee Payment:**
```solidity
{
  currencyAddress: address(0), // Native DEV
  amount: 0.1 ether // 0.1 DEV for fees
}
```

**Weight Limit:**
- Default: 1,000,000,000 weight units
- Adjustable via `updateMinXcmGas()`

## Monitoring & Debugging

### Check Swap Status

```typescript
const swap = await remoteSwapInitiator.getSwap(swapId);
console.log("Status:", swap.status);
console.log("User:", swap.user);
console.log("Source Token:", swap.sourceToken);
console.log("Target Token:", swap.targetToken);
console.log("Amount:", ethers.formatEther(swap.sourceAmount));
console.log("XCM Hash:", swap.xcmMessageHash);
```

### Monitor XCM Messages

**On Moonbeam:**
1. Visit [Moonscan](https://moonscan.io/)
2. Search for your transaction hash
3. Look for "XCM Transfer" events
4. Check message status: Sent, Received, Executed, Failed

**On Hydration:**
1. Visit [Hydration Subscan](https://hydration.subscan.io/)
2. Search for the XCM message hash
3. Check execution status and events
4. Verify Omnipool swap execution

**Using Polkadot.js Apps:**
1. Connect to Rococo relay chain
2. Navigate to: Network → Explorer
3. Search for XCM messages by block or extrinsic
4. View detailed execution logs

### Common Issues

#### 1. "XCM Transfer Failed"

**Causes:**
- Insufficient fees in sovereign account
- HRMP channel not open
- Asset not registered

**Solutions:**
- Fund sovereign account with HDX
- Verify HRMP channel status
- Check asset registration on both chains

#### 2. "Swap Stuck in Initiated Status"

**Causes:**
- XCM message not delivered
- Omnipool execution failed
- Return message not sent

**Solutions:**
- Check XCM message on Subscan
- Verify Omnipool has liquidity
- Check return path HRMP channel

#### 3. "Slippage Exceeded"

**Causes:**
- Price moved between initiation and execution
- Insufficient liquidity in Omnipool
- `minAmountOut` set too high

**Solutions:**
- Increase slippage tolerance (lower `minAmountOut`)
- Check Omnipool liquidity for asset pair
- Split large swaps into smaller chunks

#### 4. "Not Sharia Compliant"

**Causes:**
- Target token not registered in ShariaCompliance
- Token marked as non-compliant

**Solutions:**
- Register token: `shariaCompliance.registerShariaCoin(...)`
- Verify token meets Sharia requirements
- Update compliance status if needed

## Fee Estimation

### XCM Fees

**On Moonbeam:**
- Transaction gas: ~500,000 gas (~0.0005 GLMR)
- XCM message fee: ~0.1 GLMR (configurable)

**On Hydration:**
- Execution fee: Paid from sovereign account
- Omnipool swap fee: 0.3% (standard AMM fee)

**Total estimated cost:**
- ~0.1005 GLMR + 0.3% of swap amount

### Gas Optimization

Reduce costs by:
1. Batching multiple swaps
2. Adjusting `minXcmGas` for smaller calls
3. Using optimal swap paths

## Security Considerations

### Smart Contract Risks

1. **Reentrancy:** Protected by `ReentrancyGuard`
2. **Access Control:** Admin functions restricted to owner
3. **Token Approvals:** Users approve exact amounts only
4. **Deadline Protection:** Swaps expire after deadline

### XCM Risks

1. **Message Delivery:** XCM messages may fail or timeout
2. **Execution Errors:** Remote execution may fail
3. **Asset Loss:** Failed swaps may lock tokens temporarily
4. **Fee Volatility:** XCM fees may fluctuate

### Best Practices

1. **Start Small:** Test with small amounts first
2. **Monitor Status:** Track swap status until completion
3. **Set Deadlines:** Use reasonable deadlines (1-24 hours)
4. **Verify Compliance:** Always check Sharia compliance
5. **Keep Backups:** Save swap IDs for recovery

## Advanced Configuration

### Update Omnipool Configuration

If Hydration updates their Omnipool pallet:

```typescript
await remoteSwapInitiator.updateOmnipoolConfig(
  newPalletIndex,
  newCallIndex
);
```

### Adjust XCM Gas

For complex swaps requiring more execution weight:

```typescript
await remoteSwapInitiator.updateMinXcmGas(
  2000000000 // 2 billion weight units
);
```

### Emergency Withdrawal

If tokens get stuck in the contract:

```typescript
await remoteSwapInitiator.emergencyWithdraw(
  tokenAddress,
  amount
);
```

**Note:** Only callable by contract owner.

## Testing

### Local Testing

Test XCM encoding without actual cross-chain calls:

```bash
npx hardhat test test/RemoteSwapInitiator.test.ts
```

### Fork / Test Testing

1. Deploy contracts on Moonbeam mainnet (ensure Hydration prerequisites are met)
2. Fund the Hydration sovereign account with HDX
3. Execute a small test swap (1-10 tokens)
4. Monitor XCM message delivery
5. Verify swap completion
6. Check received tokens

### Integration Testing

Full end-to-end test:

```bash
# 1. Deploy or verify contracts
npm run deploy:mainnet

# 2. Fund contracts
# Send GLMR to RemoteSwapInitiator

# 3. Execute test swap
npx hardhat run scripts/xcm/initiate-remote-swap.ts --network moonbeam

# 4. Monitor status
# Check Moonscan and Hydration Subscan for XCM messages
```

## Resources

### Documentation

- [Moonbeam XCM Docs](https://docs.moonbeam.network/builders/interoperability/xcm/)
- [Hydration Docs](https://docs.hydration.net/)
- [Polkadot XCM Format](https://wiki.polkadot.network/docs/learn-xcm)
- [XCM Transactor Precompile](https://docs.moonbeam.network/builders/pallets-precompiles/precompiles/xcm-transactor/)

### Tools

- [Polkadot.js Apps](https://polkadot.js.org/apps/)
- [Moonscan](https://moonscan.io/)
- [Hydration Subscan](https://hydration.subscan.io/)
- [XCM Visualizer](https://xcm-visualizer.com/)

### Support

- Moonbeam Discord: https://discord.gg/moonbeam
- Hydration Discord: https://discord.gg/hydration
- Polkadot Forum: https://forum.polkadot.network/

## Troubleshooting Checklist

Before reporting issues, verify:

- [ ] HRMP channels exist and are open
- [ ] Assets are registered as XC-20s on both chains
- [ ] Sovereign account has sufficient HDX balance
- [ ] RemoteSwapInitiator has DEV for fees
- [ ] User has approved tokens
- [ ] Target token is Sharia compliant
- [ ] Omnipool has liquidity for the pair
- [ ] Deadline has not expired
- [ ] XCM message was sent (check Subscan)
- [ ] XCM message was received on Hydration
- [ ] Omnipool swap executed successfully
- [ ] Return XCM message was sent

## Conclusion

Cross-chain swaps via XCM enable seamless Sharia-compliant trading across Polkadot parachains. By following this guide, you can integrate Hydration's Omnipool liquidity into your Moonbeam applications while maintaining Islamic finance principles.

For questions or issues, please open a GitHub issue or contact the Tayeb team.

---

**Last Updated:** November 2025  
**Version:** 2.0.0  
**Networks:** Moonbeam Mainnet & Hydration



