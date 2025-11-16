import { ApiPromise, WsProvider } from '@polkadot/api';
import { u8aToHex } from '@polkadot/util';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Encode Hydration Omnipool swap calls using Polkadot API
 * This script connects to Hydration and generates properly SCALE-encoded call data
 */

interface XcmConfig {
  hydration: {
    rpcUrl: string;
    omnipoolPalletName: string;
    assetRegistry: Record<string, number>;
  };
  tokenMapping: {
    moonbeamToHydration: Record<string, {
      symbol: string;
      assetId: number | null;
      decimals: number;
    }>;
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
  const endpoints = [
    rpcUrl,
    'wss://hydradx-rpc.play.hydration.cloud/',
    'wss://hydradx-parachain.api.onfinality.io/public-ws',
    'wss://hydration-rpc.dwellir.com',
  ].filter(Boolean);

  const connectWithTimeout = async (endpoint: string, timeoutMs = 15000) => {
    console.log(`Connecting to Hydration at ${endpoint}...`);
    const ws = new WsProvider(endpoint);
    const apiPromise = ApiPromise.create({ provider: ws }).then(async (api) => {
      await api.isReady;
      return api;
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout connecting to ${endpoint}`)), timeoutMs)
    );
    return Promise.race([apiPromise, timeout]) as Promise<ApiPromise>;
  };

  let lastError: unknown = null;
  for (const ep of endpoints) {
    try {
      const api = await connectWithTimeout(ep);
      console.log('✅ Connected to Hydration');
      return api;
    } catch (e) {
      console.warn(`⚠️  Failed to connect via ${ep}:`, (e as Error)?.message || e);
      lastError = e;
    }
  }
  throw new Error(`All Hydration RPC endpoints failed. Last error: ${(lastError as Error)?.message || lastError}`);
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
async function encodeOmnipoolSell(
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
async function encodeOmnipoolBuy(
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
  const assetId = config.hydration.assetRegistry[symbol];
  if (assetId === undefined) {
    throw new Error(`Asset ${symbol} not found in registry`);
  }
  return assetId;
}

/**
 * Get asset ID from Moonbeam token address
 */
function getAssetIdFromAddress(config: XcmConfig, address: string): number {
  const normalizedAddress = address.toLowerCase();
  const mapping = config.tokenMapping.moonbeamToHydration[normalizedAddress];
  
  if (!mapping) {
    throw new Error(`Token address ${address} not found in Moonbeam to Hydration mapping`);
  }
  
  if (mapping.assetId === null) {
    throw new Error(`Token ${mapping.symbol} at ${address} is not available on Hydration Omnipool`);
  }
  
  return mapping.assetId;
}

/**
 * Get token info from Moonbeam address
 */
function getTokenInfo(config: XcmConfig, address: string): { symbol: string; assetId: number; decimals: number } {
  const normalizedAddress = address.toLowerCase();
  const mapping = config.tokenMapping.moonbeamToHydration[normalizedAddress];
  
  if (!mapping) {
    throw new Error(`Token address ${address} not found in Moonbeam to Hydration mapping`);
  }
  
  if (mapping.assetId === null) {
    throw new Error(`Token ${mapping.symbol} at ${address} is not available on Hydration Omnipool`);
  }
  
  return {
    symbol: mapping.symbol,
    assetId: mapping.assetId,
    decimals: mapping.decimals
  };
}

/**
 * Main function for testing
 */
async function main() {
  try {
    // Load configuration
    const config = loadXcmConfig();
    
    // Connect to Hydration
    const api = await connectToHydration(config.hydration.rpcUrl);
    
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
    console.log('\nℹ️  Use these encoded calls in CrosschainSwapInitiator contract');
    
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
export { 
  connectToHydration, 
  loadXcmConfig, 
  getAssetId, 
  getAssetIdFromAddress,
  getTokenInfo,
  encodeOmnipoolSell,
  encodeOmnipoolBuy
};



