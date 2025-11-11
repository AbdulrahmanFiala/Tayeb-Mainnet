# Moonbeam Mainnet Deployment Checklist

## Pre-Deployment Preparation

### 1. Environment Setup
- [ ] Create new `.env` file for mainnet (backup testnet `.env` first)
- [ ] Add mainnet private key to `.env`
- [ ] Verify private key has ~2-3 GLMR for deployment gas
- [ ] Test RPC connection: `curl https://rpc.api.moonbeam.network`
- [ ] Backup existing `config/deployedContracts.json` (if any)

### 2. Get GLMR Tokens
Estimated need: **2-3 GLMR** (~$0.40-$0.60)

**Options**:
- Buy on centralized exchange (Binance, Kraken, Coinbase)
- Bridge from Ethereum via [Moonbeam Bridge](https://apps.moonbeam.network/moonbeam/bridge)
- Use [Wormhole Bridge](https://www.portalbridge.com/)
- Swap on [StellaSwap](https://app.stellaswap.com/)

### 3. Code Review
- [ ] Review `contracts/ShariaCompliance.sol` - no changes needed
- [ ] Review `contracts/CrosschainSwapInitiator.sol` - verify constructor params
- [ ] Review `contracts/xcm/IXcmTransactor.sol` - interface only, no changes
- [ ] Run linter: `npx hardhat compile`
- [ ] Check for compiler warnings
- [ ] Verify OpenZeppelin version: `npm list @openzeppelin/contracts`

### 4. Configuration Verification
- [ ] Check `config/xcmConfig.json` - Hydration mainnet settings correct
- [ ] Verify XCM Transactor precompile address: `0x0000000000000000000000000000000000000806`
- [ ] Confirm Hydration parachain ID: `2034`
- [ ] Verify Omnipool pallet index: `75`
- [ ] Run `npm run plan:local-swap -- --token-in GLMR --token-out USDC_WH --amount 1` to confirm the router hint matches `config/deployedContracts.json`. If the command fails, pause and contact the external DEX; Tayeb will not operate without an SDK-provided route.

---

## Deployment Steps

### Phase 1: Deploy ShariaCompliance

```bash
# 1. Update .env
PRIVATE_KEY=0xYourMainnetPrivateKey
MOONBEAM_RPC_URL=https://rpc.api.moonbeam.network

# 2. Compile contracts
npx hardhat compile

# 3. Deploy core contracts (ShariaCompliance + CrosschainSwapInitiator)
npx hardhat run scripts/deploy/deploy-sharia-compliance.ts --network moonbeam
npx hardhat run scripts/deploy/deploy-crosschain-initiator.ts --network moonbeam
```

**Expected Output** (per script):
```
🚀 Deploying Main Contracts to Moonbeam...
Account: 0xYourAddress
Balance: X.XX GLMR

📝 Deploying ShariaCompliance...
✅ ShariaCompliance deployed at: 0xABC123...
```

**Checklist**:
- [ ] Deployment successful
- [ ] Copy `ShariaCompliance` address: `0x_______________`
- [ ] Copy `CrosschainSwapInitiator` address: `0x_______________`
- [ ] Save deployment block number(s): `_______`
- [ ] Verify on Moonscan: `https://moonscan.io/address/0xABC123...`
- [ ] Update `.env`: `SHARIA_COMPLIANCE_ADDRESS=0xABC123...`

### Phase 2: Deploy ShariaLocalSwap & ShariaDCA (optional)

> Easiest path: rerun the full deployer (idempotent)  
> `npm run deploy:mainnet`

```bash
# Deploy ShariaLocalSwap + ShariaDCA only (idempotent)
npx hardhat run scripts/deploy/deploy-all.ts --network moonbeam
```

**Checklist**:
- [ ] Deployment successful
- [ ] Save deployment block number: `_______`
- [ ] `deployedContracts.json` updated with `shariaSwap` / `shariaDCA`

### Phase 3: Contract Verification

```bash
# Verify ShariaCompliance
npx hardhat verify --network moonbeam 0xABC123...

# Verify CrosschainSwapInitiator
npx hardhat verify --network moonbeam 0xDEF456... \
  "0x0000000000000000000000000000000000000806" \
  "0xABC123..."

# (Optional) Verify ShariaDCA
npx hardhat verify --network moonbeam 0x_____________ \
  0xABC123... \
  0xRouterAddress... \
  0xWGLMRAddress...
```

**Checklist**:
- [ ] ShariaCompliance verified on Moonscan
- [ ] ShariaLocalSwap verified on Moonscan (if deployed)
- [ ] CrosschainSwapInitiator verified on Moonscan
- [ ] ShariaDCA verified on Moonscan (if deployed)
- [ ] Source code visible on explorer
- [ ] Contract ABI available

---

## Post-Deployment Configuration

### 1. Update Configuration Files

**Update `config/deployedContracts.json`**:
```json
{
  "ShariaCompliance": "0xABC123...",
  "CrosschainSwapInitiator": "0xDEF456...",
  "ShariaDCA": "0x_____________",
  "deploymentBlock": 5750500,
  "network": "moonbeam-mainnet",
  "timestamp": "2025-11-09T10:00:00Z"
}
```

### 2. Test Contract Reads (No Gas Cost)

```bash
# Create test script
cat > scripts/test-mainnet-deployment.ts << 'EOF'
import { ethers } from "hardhat";

async function main() {
  const shariaAddress = process.env.SHARIA_COMPLIANCE_ADDRESS;
  const initiatorAddress = process.env.REMOTE_SWAP_INITIATOR_ADDRESS;

  console.log("Testing mainnet deployment...\n");

  // Test ShariaCompliance
  const sharia = await ethers.getContractAt("ShariaCompliance", shariaAddress!);
  const btcCompliant = await sharia.isShariaCompliant("BTC");
  console.log(`✅ ShariaCompliance.isShariaCompliant("BTC"): ${btcCompliant}`);

  // Test CrosschainSwapInitiator
  const initiator = await ethers.getContractAt("CrosschainSwapInitiator", initiatorAddress!);
  const shariaRef = await initiator.shariaCompliance();
  const hydrationId = await initiator.hydrationParachainId();
  
  console.log(`✅ CrosschainSwapInitiator.shariaCompliance(): ${shariaRef}`);
  console.log(`✅ CrosschainSwapInitiator.hydrationParachainId(): ${hydrationId}`);
  
  console.log("\n🎉 All contract reads successful!");
}

main().catch(console.error);
EOF

# Run test
npx hardhat run scripts/test-mainnet-deployment.ts --network moonbeam
```

**Checklist**:
- [ ] ShariaCompliance reads work
- [ ] CrosschainSwapInitiator reads work
- [ ] All addresses match expected values

### 3. Initialize Sharia Compliance Data

```bash
# Add halal coins to ShariaCompliance
npx hardhat run scripts/automation/sync-coins-from-contract.ts --network moonbeam

# Plan a mainnet swap route (off-chain)
npm run plan:local-swap -- --token-in GLMR --token-out USDC_WH --amount 1
```

**Checklist**:
- [ ] Halal coins added to ShariaCompliance
- [ ] Verify on Moonscan: check contract state
- [ ] Test `isShariaCompliant("BTC")` returns `true`
- [ ] Route planner returns the expected router/path for target swaps (if it fails, escalate to the DEX instead of crafting manual paths)

## Testing Checklist

### 1. Mainnet Smoke Test (Costs Gas)

```bash
# Test small XCM message (will cost ~0.1 GLMR)
# TODO: Create test script for minimal XCM message
```

**Checklist**:
- [ ] XCM message sent successfully
- [ ] Transaction confirmed on Moonscan
- [ ] XCM event emitted
- [ ] Check Hydration explorer for message arrival

## Security Checklist

- [ ] Private keys stored securely (not in git)
- [ ] `.env` file in `.gitignore`
- [ ] Contract ownership transferred (if needed)
- [ ] Pause mechanism tested (if implemented)
- [ ] Access controls verified
- [ ] No hardcoded sensitive data in contracts

---

## Documentation Checklist

- [ ] Update `README.md` with mainnet addresses
- [ ] Document deployment in `DEPLOYMENT.md`
- [ ] Add contract addresses to documentation
- [ ] Update `docs/XCM_INTEGRATION.md` with mainnet info
- [ ] Create user guide for cross-chain swaps

---

## Rollback Plan

If deployment fails or issues found:

1. **DO NOT** send funds to contracts
2. Deploy new versions with fixes
3. Update addresses in config files
4. Previous contracts can be abandoned (no funds at risk)

---

## Cost Summary

| Item | Estimated Cost (GLMR) | USD Equivalent |
|------|----------------------|----------------|
| ShariaCompliance deployment | 0.5 | $0.10 |
| CrosschainSwapInitiator deployment | 1.0 | $0.20 |
| Contract verification | 0.0 | $0.00 |
| Sharia data initialization | 0.2 | $0.04 |
| Test transactions | 0.3 | $0.06 |
| **Total** | **2.0 GLMR** | **~$0.40** |

---

## Success Criteria

✅ All contracts deployed successfully  
✅ Contracts verified on Moonscan  
✅ Contract reads work correctly  
✅ Test XCM message sent successfully  
✅ Documentation updated  

---

## Next Steps After Deployment

1. **Create user interface** - Build frontend for swap initiation
2. **Monitor XCM messages** - Set up event listeners
3. **Add more assets** - Expand Sharia compliance list
4. **Optimize gas costs** - Profile and optimize contract calls
5. **Security audit** - Consider professional audit before handling large volumes

---

## Support Resources

- **Moonbeam Docs**: https://docs.moonbeam.network/
- **Hydration Docs**: https://docs.hydration.net/
- **XCM Guide**: https://wiki.polkadot.network/docs/learn-xcm
- **Moonscan Explorer**: https://moonscan.io/
- **Hydration Explorer**: https://hydration.subscan.io/

---

**Deployment Date**: _______________  
**Deployed By**: _______________  
**Network**: Moonbeam Mainnet (Polkadot)  
**Deployment Block**: _______________

