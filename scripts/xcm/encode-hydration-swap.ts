import { ApiPromise, WsProvider } from '@polkadot/api';
import { u8aToHex } from '@polkadot/util';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Encode Hydration Omnipool swap calls using Polkadot API
 * This script connects to Hydration and generates properly SCALE-encoded call data
 */

interface XcmConfig {
  hydrationTestnet: {
    rpcUrl: string;
    omnipoolPalletName: string;
    assetRegistry: Record<string, number>;
  };
}

/**
 * Load XCM configuration
 */
function loadXcmConfig(): XcmConfig {
  const configPath = path.join(__dirname, '../../config/xcmConfig.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(configData);
}

/**
 * Connect to Hydration parachain
 */
async function connectToHydration(rpcUrl: string): Promise<ApiPromise> {
  console.log(`Connecting to Hydration at ${rpcUrl}...`);
  const wsProvider = new WsProvider(rpcUrl);
  const api = await ApiPromise.create({ provider: wsProvider });
  await api.isReady;
  console.log('✅ Connected to Hydration');
  return api;
}

/**
 * Encode Omnipool sell call
 * @param api Polkadot API instance
 * @param assetIn Input asset ID
 * @param assetOut Output asset ID
 * @param amount Amount to sell (in smallest unit)
 * @param minBuyAmount Minimum amount to receive
 * @returns Encoded call data as hex string
 */
export async function encodeOmnipoolSell(
  api: ApiPromise,
  assetIn: number,
  assetOut: number,
  amount: string,
  minBuyAmount: string
): Promise<string> {
  // Create the Omnipool sell call
  const call = api.tx.omnipool.sell(assetIn, assetOut, amount, minBuyAmount);
  
  // Get the encoded call data
  const encodedCall = call.method.toHex();
  
  console.log('\n📦 Encoded Omnipool Sell Call:');
  console.log(`   Asset In: ${assetIn}`);
  console.log(`   Asset Out: ${assetOut}`);
  console.log(`   Amount: ${amount}`);
  console.log(`   Min Buy Amount: ${minBuyAmount}`);
  console.log(`   Encoded: ${encodedCall}`);
  
  return encodedCall;
}

/**
 * Encode Omnipool buy call
 * @param api Polkadot API instance
 * @param assetOut Output asset ID
 * @param assetIn Input asset ID
 * @param amount Amount to buy
 * @param maxSellAmount Maximum amount to spend
 * @returns Encoded call data as hex string
 */
export async function encodeOmnipoolBuy(
  api: ApiPromise,
  assetOut: number,
  assetIn: number,
  amount: string,
  maxSellAmount: string
): Promise<string> {
  // Create the Omnipool buy call
  const call = api.tx.omnipool.buy(assetOut, assetIn, amount, maxSellAmount);
  
  // Get the encoded call data
  const encodedCall = call.method.toHex();
  
  console.log('\n📦 Encoded Omnipool Buy Call:');
  console.log(`   Asset Out: ${assetOut}`);
  console.log(`   Asset In: ${assetIn}`);
  console.log(`   Amount: ${amount}`);
  console.log(`   Max Sell Amount: ${maxSellAmount}`);
  console.log(`   Encoded: ${encodedCall}`);
  
  return encodedCall;
}

/**
 * Get asset ID from symbol
 */
function getAssetId(config: XcmConfig, symbol: string): number {
  const assetId = config.hydrationTestnet.assetRegistry[symbol];
  if (assetId === undefined) {
    throw new Error(`Asset ${symbol} not found in registry`);
  }
  return assetId;
}

/**
 * Main function for testing
 */
async function main() {
  try {
    // Load configuration
    const config = loadXcmConfig();
    
    // Connect to Hydration
    const api = await connectToHydration(config.hydrationTestnet.rpcUrl);
    
    // Example: Encode a swap from USDT to HDX
    console.log('\n🔄 Example: Swap 100 USDT for HDX');
    const usdtId = getAssetId(config, 'USDT');
    const hdxId = getAssetId(config, 'HDX');
    
    // Amount in smallest unit (assuming 6 decimals for USDT)
    const amountIn = (100 * 1e6).toString(); // 100 USDT
    const minAmountOut = (1 * 1e12).toString(); // Minimum 1 HDX (12 decimals)
    
    const encodedSell = await encodeOmnipoolSell(
      api,
      usdtId,
      hdxId,
      amountIn,
      minAmountOut
    );
    
    // Example: Encode a swap from DOT to USDC
    console.log('\n🔄 Example: Swap DOT for 50 USDC');
    const dotId = getAssetId(config, 'DOT');
    const usdcId = getAssetId(config, 'USDC');
    
    const amountOut = (50 * 1e6).toString(); // 50 USDC
    const maxAmountIn = (10 * 1e10).toString(); // Max 10 DOT (10 decimals)
    
    const encodedBuy = await encodeOmnipoolBuy(
      api,
      usdcId,
      dotId,
      amountOut,
      maxAmountIn
    );
    
    console.log('\n✅ Encoding complete!');
    console.log('\nℹ️  Use these encoded calls in RemoteSwapInitiator contract');
    
    // Disconnect
    await api.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

// Export functions for use in other scripts
export { connectToHydration, loadXcmConfig, getAssetId };



