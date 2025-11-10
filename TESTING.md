# Testing Guide

The repository now relies on Hardhat for Solidity testing. Use the following workflows to keep the contracts healthy and to validate new swap/DCA integrations.

## 1. Unit Tests (Hardhat)

```bash
npm test               # runs hardhat test
```

Hardhat outputs gas usage and revert reasons. Focus areas:
- `ShariaCompliance.test.ts` exercises the registry and permissioned functions.
- Add additional tests under `test/` for new behaviours (e.g. swap path validation, automation edge cases).

### Run a single test file
```bash
npx hardhat test test/ShariaCompliance.test.ts
```

### Run with stack traces
```bash
HARDHAT_DEBUG=true npx hardhat test
```

## 2. Static Analysis

```bash
npx hardhat compile --force    # Rebuild TypeChain types
npx hardhat check              # Solidity built-in static analysis (via hardhat-gas-reporter / solhint if configured)
```

Consider enabling Slither or MythX in CI for additional coverage if required.

## 3. Manual Swap Testing

1. **Select a router path**  
   Use your preferred routing SDK (e.g. StellaSwap API, 1inch, Uniswap SDK) to compute a path array. Example:
   ```typescript
   const path = [USDC_ADDRESS, WGLMR_ADDRESS, TARGET_ADDRESS];
   ```

2. **Execute a dry-run on a fork**  
   ```bash
   npx hardhat run scripts/decode-failed-tx.ts --network moonbeam
   ```
   Use the returned calldata to inspect revert reasons if the router path is invalid.

3. **Simulate on a forked network** (optional)  
   With Chopsticks running, point Hardhat to the fork RPC and execute swaps/DCA functions against cloned state.

## 4. DCA Automation Loop

Use the helper scripts to stress-test order execution:

```bash
npx hardhat run scripts/automation/auto-execute-dca.ts --network moonbeam    # interval polling
npx hardhat run scripts/automation/execute-ready-orders.ts --network moonbeam # one-shot catch up
```

Before running, create sample orders (see `USAGE_EXAMPLES.md`) and ensure each includes a valid swap path. Watch for:
- `InvalidPath` → path not anchored to source/destination
- `InsufficientDeposit` → not enough DEV/ERC20 locked for remaining intervals
- Router execution failures (`SwapFailed`) → path lacks liquidity, deadline expired, or approval missing

## 5. XCM Flow Checks

For cross-chain regression tests:
1. Deploy the contracts on Moonbeam (or fork using Chopsticks).
2. Use `scripts/xcm/initiate-remote-swap.ts` to trigger a round-trip swap.
3. Monitor `logs/chopsticks.log` or Subscan to ensure the XCM message sequence succeeds.

## 6. CI Recommendations

- `npm run compile`
- `npm test`
- `npx hardhat coverage` (optional; configure `solidity-coverage`)
- Lint TypeScript with `npx tsc --noEmit`

Automating these steps ensures regressions are caught before deployment. Adjust gas reporters or coverage thresholds as needed for your environment.
