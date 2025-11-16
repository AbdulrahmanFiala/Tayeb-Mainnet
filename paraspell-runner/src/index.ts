import 'dotenv/config';
import { createWalletClient, http, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ethers } from 'ethers';

// NOTE: ParaSpell API is inferred. Adjust imports to their documented API if different.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { XcmSdk } from '@paraspell/xcm-tools';

async function main() {
  const MOONBEAM_RPC = process.env.MOONBEAM_RPC_URL || 'https://rpc.api.moonbeam.network';
  const PRIVATE_KEY = process.env.PRIVATE_KEY as Address | undefined;
  if (!PRIVATE_KEY) throw new Error('Set PRIVATE_KEY in .env');

  const account = privateKeyToAccount(PRIVATE_KEY);
  const evmSigner = createWalletClient({
    account,
    // fallback viem config; ParaSpell should set chain internally
    transport: http(MOONBEAM_RPC),
  });

  console.log('\n🔗 ParaSpell XCM runner - Moonbeam → Hydration');
  console.log('   Source:', account.address);

  // Initialize ParaSpell SDK (adjust per official docs)
  const sdk = new XcmSdk({ evmSigner });

  // Example: transfer small GLMR or DOT route (adjust to actual supported route)
  const sourceChain = 'moonbeam';
  const destinationChain = 'hydration';
  const asset = process.env.PARASPELL_ASSET || 'dot';
  const destinationAddress = account.address;

  console.log('   Route:', `${sourceChain} -> ${destinationChain}`, 'Asset:', asset);

  // Build transfer data and submit
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const transferData = await sdk.getTransferData({
    sourceKeyOrChain: sourceChain,
    destinationKeyOrChain: destinationChain,
    keyOrAsset: asset,
    sourceAddress: account.address,
    destinationAddress,
  });

  console.log('\n💰 Fees / limits');
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  console.log('   Min:', transferData.min?.toDecimal?.() ?? String(transferData.min?.amount ?? 'n/a'));
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const amount = Number(transferData.min?.toDecimal?.() ?? '0.0') * 2 || 0.1;
  console.log('   Sending amount:', amount);

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const hash = await transferData.transfer({
    amount,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    signers: { evmSigner },
  });
  console.log('   Tx hash:', hash);
  console.log('   ✅ Submitted');
}

main().catch((e) => {
  console.error('❌ ParaSpell runner failed:', e);
  process.exit(1);
});


