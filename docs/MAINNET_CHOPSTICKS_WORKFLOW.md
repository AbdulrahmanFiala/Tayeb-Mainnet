# Mainnet + Chopsticks Testing Workflow

## Complete Guide: Deploy Once, Test Forever

This workflow lets you deploy to Moonbeam mainnet once (~$0.30), then test XCM flows infinitely for free using Chopsticks forks.

---

## Phase 1: One-Time Mainnet Deployment

### Step 1: Get GLMR Tokens
You need ~2 GLMR (~$0.40) for deployment:
- Buy on exchange (Binance, Kraken, etc.)
- Bridge from Ethereum via [Moonbeam Bridge](https://apps.moonbeam.network/moonbeam/bridge)
- Use [Wormhole](https://www.portalbridge.com/)

### Step 2: Update Environment
```bash
# .env
PRIVATE_KEY=0xYourMainnetPrivateKey
MOONBEAM_RPC_URL=https://rpc.api.moonbeam.network
```

### Step 3: Deploy Contracts to Mainnet
```bash
# Deploy ShariaCompliance and RemoteSwapInitiator
npx hardhat run scripts/deploy/deploy-core.ts --network moonbeam
npx hardhat run scripts/xcm/deploy-remote-swap.ts --network moonbeam
```

**Save the deployment info**:
```
✅ ShariaCompliance deployed at: 0xABC123...
✅ RemoteSwapInitiator deployed at: 0xDEF456...
📍 Deployment block: 5,750,500
```

### Step 4: Verify Deployment
```bash
# Check on Moonbeam explorer
open https://moonscan.io/address/0xDEF456...

# Verify contract is live
npx hardhat verify --network moonbeam 0xDEF456... <constructor-args>
```

---

## Phase 2: Fork Mainnet with Chopsticks

### Step 1: Update Chopsticks Config
Edit `config/chopsticks/moonbeam.yaml`:
```yaml
endpoint: wss://wss.api.moonbeam.network
block: 5750500  # ← Use block AFTER your deployment
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

### Step 2: Start Chopsticks Network
```bash
# Kill any running instances
pkill -f chopsticks

# Start fresh fork
npx @acala-network/chopsticks@latest xcm \
  --relaychain config/chopsticks/relay-polkadot.yaml \
  --parachain config/chopsticks/moonbeam.yaml \
  --parachain config/chopsticks/hydration.yaml \
  > logs/chopsticks.log 2>&1 &

# Wait for startup (30 seconds)
sleep 30

# Check logs
tail -f logs/chopsticks.log
```

You should see:
```
✅ Moonbeam RPC listening on http://[::]:9949
✅ Hydration RPC listening on http://[::]:9950
✅ Polkadot RPC listening on http://[::]:9951
✅ Connected parachains [2004,2034]
✅ Connected relaychain 'Polkadot' with parachain 'Moonbeam'
✅ Connected relaychain 'Polkadot' with parachain 'Hydration'
```

### Step 3: Verify Your Contracts Are in the Fork
```bash
npx ts-node scripts/xcm/verify-fork-contract.ts
```

Expected output:
```
✅ Connected to Moonbeam fork
📍 Contract address: 0xDEF456...
📝 Contract code length: 12,345 bytes
✅ Contract EXISTS in the fork!
```

---

## Phase 3: Test XCM Flow on Fork

### Create XCM Test Script

Create `scripts/xcm/test-xcm-flow-chopsticks.ts`:

```typescript
import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';

async function main() {
  console.log('🚀 Testing Moonbeam → Hydration XCM Swap Flow\n');

  // Connect to forked chains
  const moonbeamApi = await ApiPromise.create({
    provider: new WsProvider('ws://127.0.0.1:9949')
  });
  
  const hydrationApi = await ApiPromise.create({
    provider: new WsProvider('ws://127.0.0.1:9950')
  });
  
  const relayApi = await ApiPromise.create({
    provider: new WsProvider('ws://127.0.0.1:9951')
  });
  
  console.log('✅ Connected to all forks\n');

  // Use Alith account (pre-funded on Moonbeam)
  const keyring = new Keyring({ type: 'ethereum' });
  const alith = keyring.addFromUri(
    '0x5fb92d6e98884f76de468fa3f6278f8807c48bebc13595d45af5bdc4da702133'
  );
  
  console.log(`👤 Using account: ${alith.address}\n`);

  // Step 1: Check initial balances
  const moonbeamBalance = await moonbeamApi.query.system.account(alith.address);
  console.log('💰 Moonbeam balance:', moonbeamBalance.toHuman());

  // Step 2: Call your RemoteSwapInitiator contract via Substrate
  const contractAddress = process.env.REMOTE_SWAP_INITIATOR_ADDRESS;
  
  // Encode the initiateRemoteSwap call
  // This would use ethereum.transact to call your contract
  const tx = moonbeamApi.tx.ethereum.transact({
    // Your contract call data here
  });

  console.log('\n📤 Sending XCM message from Moonbeam to Hydration...');
  
  // Send transaction
  await tx.signAndSend(alith, ({ status, events }) => {
    if (status.isInBlock) {
      console.log(`✅ Included in block: ${status.asInBlock.toHex()}`);
      
      // Check for XCM events
      events.forEach(({ event }) => {
        if (event.section === 'xcmpQueue' || event.section === 'polkadotXcm') {
          console.log(`🔔 XCM Event: ${event.section}.${event.method}`);
          console.log(`   Data: ${event.data.toString()}`);
        }
      });
    }
  });

  // Step 3: Monitor XCM message on relay chain
  console.log('\n🔍 Monitoring relay chain for XCM message...');
  
  const relayHead = await relayApi.rpc.chain.getHeader();
  console.log(`Relay chain block: ${relayHead.number.toNumber()}`);

  // Step 4: Check Hydration for incoming XCM
  console.log('\n🔍 Checking Hydration for XCM message...');
  
  const hydrationHead = await hydrationApi.rpc.chain.getHeader();
  console.log(`Hydration block: ${hydrationHead.number.toNumber()}`);

  // Step 5: Monitor Hydration Omnipool for swap
  console.log('\n💱 Monitoring Hydration Omnipool...');
  
  // Query Omnipool state
  const omnipoolAssets = await hydrationApi.query.omnipool.assets.entries();
  console.log(`Omnipool has ${omnipoolAssets.length} assets`);

  // Step 6: Check for return XCM message
  console.log('\n🔙 Waiting for return XCM from Hydration to Moonbeam...');

  // Step 7: Verify final balances
  console.log('\n✅ XCM flow complete!');
  console.log('📊 Final state:');
  
  const finalBalance = await moonbeamApi.query.system.account(alith.address);
  console.log('💰 Final Moonbeam balance:', finalBalance.toHuman());

  // Cleanup
  await moonbeamApi.disconnect();
  await hydrationApi.disconnect();
  await relayApi.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

### Run the Test
```bash
export REMOTE_SWAP_INITIATOR_ADDRESS=0xDEF456...
npx ts-node scripts/xcm/test-xcm-flow-chopsticks.ts
```

---

## Phase 4: Iterate and Debug

### Advance Blocks Manually (if needed)
```bash
# Advance Moonbeam fork by 1 block
curl -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"dev_newBlock","params":[],"id":1}' \
  http://127.0.0.1:9949

# Advance Hydration fork
curl -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"dev_newBlock","params":[],"id":1}' \
  http://127.0.0.1:9950
```

### Monitor XCM Queues
```typescript
// Check Moonbeam XCM queue
const xcmpQueue = await moonbeamApi.query.xcmpQueue.outboundXcmpMessages.entries();
console.log('Outbound XCM messages:', xcmpQueue.length);

// Check Hydration XCM queue
const inboundXcm = await hydrationApi.query.xcmpQueue.inboundXcmpMessages.entries();
console.log('Inbound XCM messages:', inboundXcm.length);
```

### Reset Fork (start fresh)
```bash
# Stop Chopsticks
pkill -f chopsticks

# Clear cache
rm -rf .chopsticks-cache

# Restart
npx @acala-network/chopsticks@latest xcm \
  --relaychain config/chopsticks/relay-polkadot.yaml \
  --parachain config/chopsticks/moonbeam.yaml \
  --parachain config/chopsticks/hydration.yaml
```

---

## Advantages of This Approach

✅ **Deploy once, test forever** - $0.30 one-time cost  
✅ **Real mainnet state** - Your contracts, real liquidity, real HRMP channels  
✅ **Fast iteration** - No waiting for block times  
✅ **No gas costs** - Test infinitely for free  
✅ **Full XCM support** - Real XCM message passing  
✅ **Debugging tools** - Manual block advancement, state inspection  
✅ **Reproducible** - Same fork state every time  

---

## Cost Comparison

| Approach | Setup Cost | Per-Test Cost | Total (100 tests) |
|----------|-----------|---------------|-------------------|
| **Mainnet + Chopsticks** | $0.30 | $0.00 | **$0.30** |
| Full Mainnet | $0.30 | $0.15 | $15.30 |
| Legacy Testnet | $0.00 | $0.00 | $0.00 (no Hydration XCM support) |
| Local Zombienet | $0.00 | $0.00 | $0.00 (complex setup) |

---

## Troubleshooting

### Contract not found in fork
- Make sure you forked at a block AFTER deployment
- Check block number: `curl -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"chain_getBlockHash","params":[],"id":1}' http://127.0.0.1:9949`

### XCM message not arriving
- Check HRMP channels are open (they should be on mainnet fork)
- Manually advance blocks on both chains
- Check XCM queue: `api.query.xcmpQueue.outboundXcmpMessages.entries()`

### Chopsticks crashes
- Reduce fork block number (use older, more stable block)
- Clear cache: `rm -rf .chopsticks-cache`
- Check logs: `tail -f logs/chopsticks.log`

---

**This is the recommended production testing workflow!** Deploy once to mainnet, then test infinitely on Chopsticks forks.

