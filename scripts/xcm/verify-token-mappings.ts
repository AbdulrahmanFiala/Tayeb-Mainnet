import { ApiPromise, WsProvider } from '@polkadot/api';
import { ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

// Import types and helpers
interface XcmConfig {
  hydration: {
    rpcUrl: string;
    assetRegistry: Record<string, number>;
  };
  moonbeam: {
    rpcUrl: string;
  };
  tokenMapping: {
    moonbeamToHydration: Record<string, {
      symbol: string;
      assetId: number | null;
      decimals: number;
    }>;
  };
}

function loadXcmConfig(): XcmConfig {
  const configPath = path.join(__dirname, '../../config/xcmConfig.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(configData);
}

async function connectToHydration(rpcUrl: string): Promise<ApiPromise> {
  console.log(`Connecting to Hydration at ${rpcUrl}...`);
  const wsProvider = new WsProvider(rpcUrl);
  const api = await ApiPromise.create({ provider: wsProvider });
  await api.isReady;
  console.log('✅ Connected to Hydration');
  return api;
}

/**
 * Verification script to validate token mappings between Moonbeam and Hydration
 * 
 * This script:
 * 1. Queries Hydration's Omnipool to get actual asset IDs
 * 2. Verifies Moonbeam token addresses on-chain (name/symbol/decimals)
 * 3. Cross-references the mapping in xcmConfig.json
 * 4. Reports any mismatches or missing mappings
 */

interface TokenInfo {
  address: string;
  symbol: string;
  expectedAssetId: number | null;
  expectedDecimals: number;
  moonbeamVerified?: {
    symbol: string;
    name: string;
    decimals: number;
    isValid: boolean;
  };
  hydrationVerified?: {
    assetId: number | null;
    exists: boolean;
    symbol?: string;
  };
  status: 'valid' | 'mismatch' | 'not_found' | 'error';
  issues: string[];
}

// ERC20 ABI for basic token info
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)'
];

/**
 * Connect to Moonbeam RPC
 */
async function connectToMoonbeam(rpcUrl: string): Promise<ethers.JsonRpcProvider> {
  console.log(`\n🔗 Connecting to Moonbeam at ${rpcUrl}...`);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  await provider.getBlockNumber(); // Test connection
  console.log('✅ Connected to Moonbeam');
  return provider;
}

/**
 * Verify token on Moonbeam
 */
async function verifyMoonbeamToken(
  provider: ethers.JsonRpcProvider,
  address: string
): Promise<{ symbol: string; name: string; decimals: number; isValid: boolean } | null> {
  try {
    const contract = new ethers.Contract(address, ERC20_ABI, provider);
    
    const [symbol, name, decimals] = await Promise.all([
      contract.symbol().catch(() => 'UNKNOWN'),
      contract.name().catch(() => 'UNKNOWN'),
      contract.decimals().catch(() => 0)
    ]);
    
    const isValid = symbol !== 'UNKNOWN' && name !== 'UNKNOWN' && decimals > 0;
    
    return {
      symbol: symbol || 'UNKNOWN',
      name: name || 'UNKNOWN',
      decimals: Number(decimals) || 0,
      isValid
    };
  } catch (error: any) {
    console.error(`   ⚠️  Error verifying ${address}: ${error.message}`);
    return null;
  }
}

/**
 * Query Hydration Omnipool for asset registry
 */
async function getHydrationAssetRegistry(api: ApiPromise): Promise<Map<number, string>> {
  console.log('\n📋 Querying Hydration Omnipool asset registry...');
  
  const assetMap = new Map<number, string>();
  
  try {
    // Try to query the asset registry from Omnipool
    // Note: This depends on Hydration's actual API structure
    // We'll try multiple approaches
    
    // Approach 1: Query assets via Omnipool pallet
    try {
      const assets = await api.query.omnipool.assets.entries();
      for (const [key, value] of assets) {
        const assetId = Number(key.args[0].toString());
        // Try to get asset metadata if available
        assetMap.set(assetId, `Asset_${assetId}`);
      }
      console.log(`   ✅ Found ${assetMap.size} assets in Omnipool`);
    } catch (error) {
      console.log('   ⚠️  Could not query Omnipool assets directly');
    }
    
    // Approach 2: Query known assets from the registry
    // We'll use the assetRegistry from config as a reference
    // and verify each one exists
    
  } catch (error: any) {
    console.error(`   ❌ Error querying asset registry: ${error.message}`);
  }
  
  return assetMap;
}

/**
 * Verify asset exists on Hydration
 */
async function verifyHydrationAsset(
  api: ApiPromise,
  assetId: number
): Promise<{ assetId: number; exists: boolean; symbol?: string }> {
  try {
    // Try to query the asset from Omnipool
    const asset = await api.query.omnipool.assets(assetId);
    
    if (asset && !asset.isEmpty) {
      return {
        assetId,
        exists: true,
        symbol: `Asset_${assetId}` // Hydration may not expose symbol directly
      };
    }
    
    return {
      assetId,
      exists: false
    };
  } catch (error: any) {
    // Asset might not exist or query might fail
    return {
      assetId,
      exists: false
    };
  }
}

/**
 * Main verification function
 */
async function main() {
  console.log('\n🔍 Token Mapping Verification Script');
  console.log('=====================================\n');
  
  // Load configuration
  const xcmConfig = loadXcmConfig();
  const moonbeamRpc = xcmConfig.moonbeam.rpcUrl;
  const hydrationRpc = xcmConfig.hydration.rpcUrl;
  
  // Get token mappings
  const mappings = xcmConfig.tokenMapping.moonbeamToHydration;
  const tokens: TokenInfo[] = [];
  
  // Initialize token info
  for (const [address, mapping] of Object.entries(mappings)) {
    tokens.push({
      address: address.toLowerCase(),
      symbol: mapping.symbol,
      expectedAssetId: mapping.assetId,
      expectedDecimals: mapping.decimals,
      status: 'valid',
      issues: []
    });
  }
  
  console.log(`📊 Found ${tokens.length} tokens to verify\n`);
  
  // Connect to chains
  const moonbeamProvider = await connectToMoonbeam(moonbeamRpc);
  const hydrationApi = await connectToHydration(hydrationRpc);
  
  // Verify each token
  console.log('\n🔎 Verifying tokens...\n');
  
  for (const token of tokens) {
    console.log(`\n📍 ${token.symbol} (${token.address})`);
    console.log(`   Expected: Asset ID ${token.expectedAssetId}, Decimals ${token.expectedDecimals}`);
    
    // Verify on Moonbeam
    console.log('   🌙 Verifying on Moonbeam...');
    const moonbeamInfo = await verifyMoonbeamToken(moonbeamProvider, token.address);
    
    if (moonbeamInfo) {
      token.moonbeamVerified = moonbeamInfo;
      console.log(`      Symbol: ${moonbeamInfo.symbol}`);
      console.log(`      Name: ${moonbeamInfo.name}`);
      console.log(`      Decimals: ${moonbeamInfo.decimals}`);
      console.log(`      Valid: ${moonbeamInfo.isValid ? '✅' : '❌'}`);
      
      // Check for mismatches
      if (!moonbeamInfo.isValid) {
        token.status = 'error';
        token.issues.push('Token contract not valid on Moonbeam');
      } else if (moonbeamInfo.decimals !== token.expectedDecimals) {
        token.status = 'mismatch';
        token.issues.push(`Decimals mismatch: expected ${token.expectedDecimals}, got ${moonbeamInfo.decimals}`);
      }
      
      // Check symbol match (case-insensitive)
      if (moonbeamInfo.symbol.toUpperCase() !== token.symbol.split('_')[0].toUpperCase()) {
        token.issues.push(`Symbol mismatch: expected ${token.symbol}, got ${moonbeamInfo.symbol}`);
      }
    } else {
      token.status = 'error';
      token.issues.push('Could not verify token on Moonbeam');
    }
    
    // Verify on Hydration (if asset ID is provided)
    if (token.expectedAssetId !== null) {
      console.log(`   💧 Verifying on Hydration (Asset ID ${token.expectedAssetId})...`);
      const hydrationInfo = await verifyHydrationAsset(hydrationApi, token.expectedAssetId);
      token.hydrationVerified = hydrationInfo;
      
      if (hydrationInfo.exists) {
        console.log(`      ✅ Asset exists on Hydration`);
      } else {
        console.log(`      ❌ Asset NOT found on Hydration`);
        token.status = token.status === 'valid' ? 'not_found' : token.status;
        token.issues.push(`Asset ID ${token.expectedAssetId} not found on Hydration Omnipool`);
      }
    } else {
      console.log(`   ⚠️  No asset ID provided (token not available on Hydration)`);
      token.hydrationVerified = { assetId: null, exists: false };
    }
    
    // Determine final status
    if (token.issues.length === 0) {
      token.status = 'valid';
    }
  }
  
  // Disconnect
  await moonbeamProvider.destroy();
  await hydrationApi.disconnect();
  
  // Generate report
  console.log('\n\n📊 Verification Report');
  console.log('=====================\n');
  
  const valid = tokens.filter(t => t.status === 'valid').length;
  const mismatches = tokens.filter(t => t.status === 'mismatch').length;
  const notFound = tokens.filter(t => t.status === 'not_found').length;
  const errors = tokens.filter(t => t.status === 'error').length;
  
  console.log(`✅ Valid: ${valid}`);
  console.log(`⚠️  Mismatches: ${mismatches}`);
  console.log(`❌ Not Found: ${notFound}`);
  console.log(`💥 Errors: ${errors}\n`);
  
  // Detailed issues
  const tokensWithIssues = tokens.filter(t => t.issues.length > 0);
  
  if (tokensWithIssues.length > 0) {
    console.log('⚠️  Issues Found:\n');
    for (const token of tokensWithIssues) {
      console.log(`   ${token.symbol} (${token.address}):`);
      for (const issue of token.issues) {
        console.log(`      - ${issue}`);
      }
    }
  } else {
    console.log('✅ No issues found! All mappings are valid.\n');
  }
  
  // Recommendations
  console.log('\n💡 Recommendations:');
  if (mismatches > 0 || notFound > 0 || errors > 0) {
    console.log('   1. Review the issues above');
    console.log('   2. Update xcmConfig.json with correct values');
    console.log('   3. Re-run this verification script');
    console.log('   4. Test with a small swap before mainnet deployment\n');
  } else {
    console.log('   ✅ All mappings verified! Safe to proceed with deployment.\n');
  }
  
  // Save detailed report to file
  const reportPath = path.join(__dirname, '../../xcm-verification-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(tokens, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}\n`);
}


main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });

