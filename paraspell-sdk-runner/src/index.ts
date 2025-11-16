import 'dotenv/config';
import { Builder } from '@paraspell/sdk';
import { createWalletClient, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

async function main() {
  const source = 'Moonbeam';
  const destination = 'Hydration';
  const destAddress = process.env.DEST_ADDRESS;
  const sourceAddress = process.env.SOURCE_ADDRESS;
  const PRIVATE_KEY = process.env.PRIVATE_KEY as Address | undefined;
  const MOONBEAM_RPC = process.env.MOONBEAM_RPC_URL || 'https://rpc.api.moonbeam.network';
  const MOONBEAM_WS = process.env.MOONBEAM_WS_URL || 'wss://wss.api.moonbeam.network';
  const HYDRATION_WS = process.env.HYDRATION_WS_URL || 'wss://rpc.hydradx.cloud';
  if (!destAddress || !sourceAddress) throw new Error('Set DEST_ADDRESS and SOURCE_ADDRESS in .env');
  if (!PRIVATE_KEY) throw new Error('Set PRIVATE_KEY in .env for signing on Moonbeam');

  // Amount with decimal abstraction enabled (per template)
  const amountInput = process.env.AMOUNT || '0.1';
  const symbol = process.env.ASSET || 'DOT';

  // Endpoint pools with fallback
  const moonbeamWsPool = [
    MOONBEAM_WS,
    'wss://moonbeam.api.onfinality.io/public-ws',
    'wss://wss.api.moonbeam.network/ws',
  ];
  const hydrationWsPool = [
    HYDRATION_WS,
    'wss://hydration-rpc.publicnode.com',
  ];

  // Retry connect/build/submit with backoff until success
  const maxAttempts = 30;
  const backoffMs = 4000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const mIx = (attempt - 1) % moonbeamWsPool.length;
    const hIx = (attempt - 1) % hydrationWsPool.length;
    try {
      const builder = await Builder({
        apiOverrides: {
          Moonbeam: [moonbeamWsPool[mIx]],
          Hydration: [hydrationWsPool[hIx]],
        },
        abstractDecimals: true,
        xcmFormatCheck: true
      })
        .from(source)
        .to(destination)
        .currency({ symbol, amount: amountInput })
        .address(destAddress)
        .senderAddress(sourceAddress);

      // Optional: dry run preview
      try {
        await builder.dryRunPreview();
      } catch {}

      // Build and submit transfer
      const tx = await builder.build();
      const account = privateKeyToAccount(PRIVATE_KEY);
      const evmSigner = createWalletClient({ account, transport: http(MOONBEAM_RPC) });
      const submitEvm = (tx as any).signAndSubmitEvm;
      const hash = await submitEvm({ evmSigner });

      await builder.disconnect();
      console.log('OK', hash);
      return;
    } catch {
      if (attempt === maxAttempts) throw new Error('All WS attempts failed');
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }

  // If we exit the loop without returning, treat as failure
  throw new Error('XCM submission did not succeed within retry window');
}

main().catch((e) => {
  console.error('❌ ParaSpell SDK run failed:', e);
  process.exit(1);
});


