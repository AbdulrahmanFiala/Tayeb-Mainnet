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
- [ ] Review `contracts/xcm/RemoteSwapInitiator.sol` - verify constructor params
- [ ] Review `contracts/xcm/IXcmTransactor.sol` - interface only, no changes
- [ ] Run linter: `npx hardhat compile`
- [ ] Check for compiler warnings
- [ ] Verify OpenZeppelin version: `npm list @openzeppelin/contracts`

### 4. Configuration Verification
- [ ] Check `config/xcmConfig.json` - Hydration mainnet settings correct
- [ ] Verify XCM Transactor precompile address: `0x0000000000000000000000000000000000000806`
- [ ] Confirm Hydration parachain ID: `2034`
- [ ] Verify Omnipool pallet index: `75`

---

## Deployment Steps

### Phase 1: Deploy ShariaCompliance

```bash
# 1. Update .env
PRIVATE_KEY=0xYourMainnetPrivateKey
MOONBEAM_RPC_URL=https://rpc.api.moonbeam.network

# 2. Compile contracts
npx hardhat compile

# 3. Deploy ShariaCompliance
npx hardhat run scripts/deploy/deploy-core.ts --network moonbeam
```

**Expected Output**:
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
- [ ] Save deployment block number: `_______`
- [ ] Verify on Moonscan: `https://moonscan.io/address/0xABC123...`
- [ ] Update `.env`: `SHARIA_COMPLIANCE_ADDRESS=0xABC123...`

### Phase 2: Deploy RemoteSwapInitiator

```bash
# Deploy RemoteSwapInitiator
npx hardhat run scripts/xcm/deploy-remote-swap.ts --network moonbeam
```

**Expected Output**:
```
🚀 Deploying RemoteSwapInitiator...
Account: 0xYourAddress
Balance: X.XX GLMR

XCM Transactor: 0x0000000000000000000000000000000000000806
ShariaCompliance: 0xABC123...
Hydration Parachain ID: 2034

✅ RemoteSwapInitiator deployed at: 0xDEF456...
```

**Checklist**:
- [ ] Deployment successful
- [ ] Copy `RemoteSwapInitiator` address: `0x_______________`
- [ ] Save deployment block number: `_______`
- [ ] Verify on Moonscan: `https://moonscan.io/address/0xDEF456...`
- [ ] Update `.env`: `REMOTE_SWAP_INITIATOR_ADDRESS=0xDEF456...`

### Phase 3: Contract Verification

```bash
# Verify ShariaCompliance
npx hardhat verify --network moonbeam 0xABC123...

# Verify RemoteSwapInitiator
npx hardhat verify --network moonbeam 0xDEF456... \
  "0x0000000000000000000000000000000000000806" \
  "0xABC123..."
```

**Checklist**:
- [ ] ShariaCompliance verified on Moonscan
- [ ] RemoteSwapInitiator verified on Moonscan
- [ ] Source code visible on explorer
- [ ] Contract ABI available

---

## Post-Deployment Configuration

### 1. Update Configuration Files

**Update `config/deployedContracts.json`**:
```json
{
  "ShariaCompliance": "0xABC123...",
  "RemoteSwapInitiator": "0xDEF456...",
  "deploymentBlock": 5750500,
  "network": "moonbeam-mainnet",
  "timestamp": "2025-11-09T10:00:00Z"
}
```

**Update `config/chopsticks/moonbeam.yaml`**:
```yaml
endpoint: wss://wss.api.moonbeam.network
block: 5750500  # ← Use block AFTER your deployment
port: 9949
db: ./.chopsticks-cache/moonbeam.db
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

  // Test RemoteSwapInitiator
  const initiator = await ethers.getContractAt("RemoteSwapInitiator", initiatorAddress!);
  const shariaRef = await initiator.shariaCompliance();
  const hydrationId = await initiator.hydrationParachainId();
  
  console.log(`✅ RemoteSwapInitiator.shariaCompliance(): ${shariaRef}`);
  console.log(`✅ RemoteSwapInitiator.hydrationParachainId(): ${hydrationId}`);
  
  console.log("\n🎉 All contract reads successful!");
}

main().catch(console.error);
EOF

# Run test
npx hardhat run scripts/test-mainnet-deployment.ts --network moonbeam
```

**Checklist**:
- [ ] ShariaCompliance reads work
- [ ] RemoteSwapInitiator reads work
- [ ] All addresses match expected values

### 3. Initialize Sharia Compliance Data

```bash
# Add halal coins to ShariaCompliance
npx hardhat run scripts/deploy/sync-coins-from-contract.ts --network moonbeam
```

**Checklist**:
- [ ] Halal coins added to ShariaCompliance
- [ ] Verify on Moonscan: check contract state
- [ ] Test `isShariaCompliant("BTC")` returns `true`

---

## Chopsticks Fork Setup

### 1. Update Fork Configuration

Edit `config/chopsticks/moonbeam.yaml`:
```yaml
endpoint: wss://wss.api.moonbeam.network
block: 5750500  # ← YOUR DEPLOYMENT BLOCK + 10
port: 9949
db: ./.chopsticks-cache/moonbeam.db
```

Edit `config/chopsticks/hydration.yaml`:
```yaml
endpoint: wss://rpc.hydradx.cloud
block: 3100000  # ← Use recent finalized block
port: 9950
db: ./.chopsticks-cache/hydration.db
```

### 2. Start Chopsticks Network

```bash
# Clear old cache
rm -rf .chopsticks-cache

# Start network
npx @acala-network/chopsticks@latest xcm \
  --relaychain config/chopsticks/relay-polkadot.yaml \
  --parachain config/chopsticks/moonbeam.yaml \
  --parachain config/chopsticks/hydration.yaml \
  > logs/chopsticks.log 2>&1 &

# Wait for startup
sleep 30

# Check logs
tail -f logs/chopsticks.log
```

**Expected Output**:
```
✅ Moonbeam RPC listening on http://[::]:9949
✅ Hydration RPC listening on http://[::]:9950
✅ Polkadot RPC listening on http://[::]:9951
✅ Connected parachains [2004,2034]
```

### 3. Verify Contracts in Fork

```bash
npx ts-node scripts/xcm/verify-fork-contract.ts
```

**Expected Output**:
```
✅ Connected to Moonbeam fork
📍 Contract address: 0xDEF456...
📝 Contract code length: 12,345 bytes
✅ Contract EXISTS in the fork!
```

**Checklist**:
- [ ] Chopsticks network running
- [ ] All three chains connected
- [ ] Contracts visible in fork
- [ ] Can query contract state

---

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

### 2. Chopsticks Full Flow Test (Free)

```bash
# Run full XCM swap test on fork
# TODO: Create comprehensive test script
```

**Checklist**:
- [ ] Swap initiated on Moonbeam fork
- [ ] XCM message sent to relay
- [ ] Message forwarded to Hydration
- [ ] Omnipool swap executed
- [ ] Assets returned to Moonbeam

---

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
| RemoteSwapInitiator deployment | 1.0 | $0.20 |
| Contract verification | 0.0 | $0.00 |
| Sharia data initialization | 0.2 | $0.04 |
| Test transactions | 0.3 | $0.06 |
| **Total** | **2.0 GLMR** | **~$0.40** |

---

## Success Criteria

✅ All contracts deployed successfully  
✅ Contracts verified on Moonscan  
✅ Contract reads work correctly  
✅ Chopsticks fork includes contracts  
✅ Test XCM message sent successfully  
✅ Documentation updated  

---

## Next Steps After Deployment

1. **Test on Chopsticks fork** - Iterate on XCM flow for free
2. **Create user interface** - Build frontend for swap initiation
3. **Monitor XCM messages** - Set up event listeners
4. **Add more assets** - Expand Sharia compliance list
5. **Optimize gas costs** - Profile and optimize contract calls
6. **Security audit** - Consider professional audit before handling large volumes

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

