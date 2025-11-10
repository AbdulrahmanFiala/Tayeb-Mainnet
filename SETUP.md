# Tayeb Setup Guide – Moonbeam Mainnet

This guide targets Moonbeam mainnet deployments. Legacy testnet flows are no longer supported.

## 1. Install Dependencies

```bash
npm install
```

## 2. Configure Environment

```bash
cp .env.example .env
```

Populate the following variables:

```
PRIVATE_KEY=0xYourPrivateKey
MOONBEAM_RPC_URL=https://rpc.api.moonbeam.network
```

⚠️ **Never commit `.env`** – it contains your private key.

## 3. Pick a Router + WETH

ShariaSwap and ShariaDCA act as adapters for any Uniswap V2-compatible router. Update `config/deployedContracts.json` with the router and WETH addresses you intend to use.

Example (Moonbeam mainnet / StellaSwap):

```json
"amm": {
  "router": "0xb473d688B45ac4655c136c90c7d8934FBCb45D49",
  "weth": "0xD909178CC99d318e4D46e7E66a972955859670E1"
}
```

## 4. Compile & Test

```bash
npm run compile
npm test
```

Running the Hardhat tests ensures the core registry logic still passes.

## 5. Deploy Core Contracts

Deploy to Moonbeam using the preconfigured script:

```bash
# Moonbeam mainnet (GLMR, real funds)
npm run deploy:mainnet
```

`npm run deploy:mainnet` runs the full `deploy-all` workflow (core + ShariaSwap + ShariaDCA).  
`deploy-core` deploys `ShariaCompliance` and `RemoteSwapInitiator`.

All contract addresses and metadata are written back to `config/deployedContracts.json` for frontend consumption.

## 6. Register Tokens

`scripts/deploy/deploy-core.ts` syncs `config/halaCoins.json` with the on-chain registry. To register additional assets later:

1. Add the symbol + metadata to `halaCoins.json`
2. Run `npm run sync:coins`

## 7. Provide Swap Paths

With the AMM removed, **routes are now provided by the caller**:
- For swaps, compute an address array (e.g. `[USDC, WGLMR, TARGET]`) via your favourite off-chain router SDK.
- For DCA orders, pass the same path when creating the order; the contract stores it for subsequent executions.

## 8. (Optional) Contract Verification

```bash
# Requires ETHERSCAN_API_KEY in .env (Etherscan V2 key for Moonbeam)
npm run verify:all -- --network moonbeam
```

Verification currently covers the deployed Tayeb contracts and any tokens listed in `config/deployedContracts.json`.

## 9. Troubleshooting

- **`InvalidPath` errors** → ensure the first hop matches the source asset (`WETH` for DEV orders) and the last hop matches the destination token.
- **`TokenNotRegistered`** → add the asset to `halaCoins.json`, sync, then re-try.
- **Router pathing** → use router SDK helpers (StellaSwap, Uniswap, etc.) to compute optimal paths, then pass the address array directly.

For advanced workflows (Moonbeam mainnet and XCM), see the docs in `docs/` and `MAINNET_DEPLOYMENT_CHECKLIST.md`.