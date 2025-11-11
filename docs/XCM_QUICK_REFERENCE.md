# XCM Cross-Chain Swaps - Quick Reference

## Quick Commands

```bash
# Deploy ShariaCompliance + CrosschainSwapInitiator (core)
npx hardhat run scripts/deploy/deploy-sharia-compliance.ts --network moonbeam
npx hardhat run scripts/deploy/deploy-crosschain-initiator.ts --network moonbeam

# Initiate swap (interactive)
npx hardhat run scripts/xcm/initiate-remote-swap.ts --network moonbeam

# Encode Omnipool calls
npx hardhat run scripts/xcm/encode-hydration-swap.ts
```

## Contract Addresses

```javascript
// Moonbeam
XCM_TRANSACTOR_PRECOMPILE = "0x0000000000000000000000000000000000000806"
REMOTE_SWAP_INITIATOR = "<check config/deployedContracts.json>"

// Hydration
PARACHAIN_ID = 2034
OMNIPOOL_PALLET_INDEX = 75
SELL_CALL_INDEX = 0
```

## Basic Usage

### Initiate Swap (JavaScript)

```javascript
const remoteSwapInitiator = await ethers.getContractAt(
  "CrosschainSwapInitiator",
  REMOTE_SWAP_INITIATOR_ADDRESS
);

// Approve tokens
await sourceToken.approve(remoteSwapInitiator.address, amount);

// Initiate swap
const tx = await remoteSwapInitiator.initiateRemoteSwap(
  sourceTokenAddress,
  targetTokenAddress,
  amount,
  minAmountOut,
  deadline
);

const receipt = await tx.wait();
console.log("Swap initiated:", receipt.hash);
```

### Check Swap Status

```javascript
const swap = await remoteSwapInitiator.getSwap(swapId);
console.log("Status:", swap.status); 
// 0=Pending, 1=Initiated, 2=Completed, 3=Failed, 4=Cancelled
```

### Cancel Swap

```javascript
await remoteSwapInitiator.cancelSwap(swapId);
```

## Hydration Asset IDs

```javascript
const ASSETS = {
  HDX: 0,
  DOT: 5,
  USDT: 10,
  USDC: 21,
  DAI: 18,
  WETH: 20,
  WBTC: 19
};
```

## Prerequisites Checklist

- [ ] HRMP channel exists (Moonbeam ↔ Hydration)
- [ ] Assets registered as XC-20s
- [ ] Sovereign account funded with HDX
- [ ] CrosschainSwapInitiator funded with GLMR
- [ ] Target token is Sharia compliant

## Monitoring

### Explorers
- Moonbeam: https://moonscan.io/
- Hydration: https://hydration.subscan.io/

### Check XCM Message
1. Find transaction on Moonscan (Moonbeam)
2. Look for "XCM Transfer" event
3. Copy message hash
4. Search on Hydration Subscan
5. Verify execution status

## Common Issues

| Issue | Solution |
|-------|----------|
| "XCM Transfer Failed" | Fund sovereign account with HDX |
| "Swap Stuck" | Check HRMP channel status |
| "Slippage Exceeded" | Increase minAmountOut tolerance |
| "Not Sharia Compliant" | Register token in ShariaCompliance |

## Fee Estimates

- Transaction gas: ~0.0005 GLMR
- XCM message fee: 0.1 GLMR
- Omnipool swap fee: 0.3% of amount
- **Total:** ~0.1005 GLMR + 0.3% of swap

## Admin Functions

```javascript
// Update Omnipool config
await remoteSwapInitiator.updateOmnipoolConfig(palletIndex, callIndex);

// Update XCM gas
await remoteSwapInitiator.updateMinXcmGas(newGas);

// Emergency withdraw
await remoteSwapInitiator.emergencyWithdraw(tokenAddress, amount);
```

## Documentation

- **Full Guide:** [XCM_INTEGRATION.md](./XCM_INTEGRATION.md)
- **Implementation Summary:** [XCM_IMPLEMENTATION_SUMMARY.md](../XCM_IMPLEMENTATION_SUMMARY.md)
- **Main README:** [README.md](../README.md#-cross-chain-swaps-via-xcm)

## Support

- Moonbeam Discord: https://discord.gg/moonbeam
- Hydration Discord: https://discord.gg/hydration
- GitHub Issues: https://github.com/yourusername/Tayeb/issues



