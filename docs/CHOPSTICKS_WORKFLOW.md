# Chopsticks Workflow for Moonbeam ↔ Hydration XCM Testing

This guide explains how to use [Chopsticks](https://github.com/AcalaNetwork/chopsticks) to spin up local forks of Moonbeam and Hydration mainnets so you can test the Tayeb cross-chain swap flow without real tokens.

---

## 1. Prerequisites
- Node.js 18+
- `npm` 9+
- Project dependencies installed (`npm install`)
- Optional: `direnv` or similar for environment management

Install Chopsticks globally (or use `npx` for ad-hoc runs):

```bash
npm install -g @acala-network/chopsticks@latest
# or per project
npm install --save-dev @acala-network/chopsticks
```

Create a cache directory so chain state persists between runs:

```bash
mkdir -p .chopsticks-cache
```

---

## 2. Choose Fork Heights
Pick recent but finalized block numbers for each chain. Use platform explorers or RPC calls:

```bash
# Moonbeam latest finalized block
curl https://wss.api.moonbeam.network -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"chain_getFinalizedHead","id":1}'

# Hydration latest finalized block
curl https://rpc.hydradx.cloud -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","method":"chain_getFinalizedHead","id":1}'
```

Update `config/chopsticks/polkadot-moonbeam-hydration.yaml` with your chosen heights under `forkBlockNumber` for both the relay chain and each parachain before starting.

---

## 3. Start the Forked Network
Run Chopsticks with the provided configuration:

```bash
npx @acala-network/chopsticks@latest xcm \
  --config config/chopsticks/polkadot-moonbeam-hydration.yaml \
  --block-interval 6000 \
  --tmp
```

Key flags:
- `xcm` mode spins up the relay chain and the listed parachains and wires XCM/HRMP automatically.
- `--block-interval 6000` advances blocks every 6 seconds (adjust as needed).
- Remove `--tmp` if you want to reuse the on-disk database between sessions (see `db` paths in the config).

Once running, the RPC endpoints are exposed locally:
- Moonbeam fork: `http://127.0.0.1:9946`
- Hydration fork: `http://127.0.0.1:9947`
- Relay chain fork: `http://127.0.0.1:9945`

Use `Ctrl+C` to stop the network.

---

## 4. Interacting with the Forked Chains
### Moonbeam (EVM)
Update `.env`:
```bash
MOONBEAM_LOCAL_RPC_URL=http://127.0.0.1:9946
PRIVATE_KEY=<fork account private key>
```

Common commands:
```bash
# Compile and deploy Tayeb contracts to the fork
npx hardhat run scripts/deploy/deploy-all.ts --network moonbeamLocal

# Deploy XCM initiator contract
npx hardhat run scripts/xcm/deploy-remote-swap.ts --network moonbeamLocal

# Trigger remote swap (uses mocked XCM payload for now)
npx hardhat run scripts/xcm/initiate-remote-swap.ts --network moonbeamLocal
```

> ⚠️  Forked balances mirror whatever exists on mainnet at the fork block. Fund the forked account by forking the account with assets, or use Chopsticks state overrides (see Section 5).

### Hydration (Substrate)
Use Polkadot.js Apps with custom endpoint `ws://127.0.0.1:9947` to inspect the Omnipool state and XCM events.

Automate XCM helper scripts (e.g., HRMP channel checks) by pointing `WsProvider` to `ws://127.0.0.1:9947`.

---

## 5. Adjusting State on the Fork
Chopsticks lets you inject state changes for testing:

```bash
# Set balance for Moonbeam account (example)
npx chopsticks rpc \
  --endpoint http://127.0.0.1:9946 \
  --method "dev_setBalance" \
  --params '["0xYourAddress", "0x3635C9ADC5DEA00000", "0x0"]'
```

You can also create a JSON file with custom storage overrides and pass it via `--initial-runtime` to preload balances or assets.

---

## 6. Block Control and Debugging
- `--block-interval` controls automatic block production. Set to `0` for manual control and call `dev_newBlock` via RPC when needed.
- Use `--verbose` to see detailed logs.
- Relay chain RPC is useful for monitoring XCM queue status and HRMP messages.

---

## 7. Integrating with Existing Scripts
Update Hardhat and TypeScript scripts to use the fork endpoints:

```ts
// Example: scripts/xcm/open-hrmp.ts
const relayWs = process.env.RELAY_WS_ENDPOINT || 'ws://127.0.0.1:9945';
```

Update `config/xcmConfig.json` to include a `chopsticks` profile with the local ports so `encode-hydration-swap.ts` can connect to `ws://127.0.0.1:9947` when encoding Omnipool calls.

---

## 8. Tear Down & Cleanup
Stop Chopsticks with `Ctrl+C`. Remove cached state if you want a fresh fork next time:

```bash
rm -rf .chopsticks-cache
```

---

## Troubleshooting
- **`Failed to create pending inherent data`**: ensure block production is active (`--block-interval` > 0).
- **`already known`** transaction errors: increase the nonce (`hardhat --show-stack-traces`).
- **Slow startup**: use slightly older finalized blocks to reduce state snapshot size.
- **Hydration metadata mismatch**: clear cache and fork from a newer block.

---

With this setup you can iterate on the full Moonbeam → Hydration → Moonbeam swap flow locally, using real XCM logic and liquidity from the Omnipool without risking mainnet funds.
