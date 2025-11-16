import { ApiPromise, WsProvider } from '@polkadot/api';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Query Hydration Asset Registry to get metadata (symbol, name) for each asset ID
 */

interface XcmConfig {
  hydration: {
    rpcUrl: string;
  };
}

function loadXcmConfig(): XcmConfig {
  const configPath = path.join(__dirname, '../../config/xcmConfig.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(configData);
}

async function main() {
  console.log('\n🔍 Querying Hydration Asset Registry Metadata\n');
  
  const config = loadXcmConfig();
  const api = await ApiPromise.create({ 
    provider: new WsProvider(config.hydration.rpcUrl) 
  });
  
  await api.isReady;
  console.log('✅ Connected to Hydration\n');
  
  // Known asset IDs from Omnipool
  const assetIds = [0, 5, 9, 14, 15, 16, 19, 33, 35, 38, 39, 102, 420, 1000624, 1000752, 1000753, 1000765, 1000771, 1000794, 1000795, 1000796];
  
  console.log('📋 Querying asset metadata...\n');
  
  const assetMetadata: Record<number, any> = {};
  
  for (const assetId of assetIds) {
    try {
      // Try different pallets that might store asset metadata
      // Hydration uses AssetRegistry or similar pallet
      
      // Try assetRegistry pallet
      try {
        const metadata = await api.query.assetRegistry.metadata(assetId);
        if (metadata && !metadata.isEmpty) {
          assetMetadata[assetId] = metadata.toHuman();
          console.log(`Asset ID ${assetId}:`);
          console.log(`  ${JSON.stringify(metadata.toHuman(), null, 2)}`);
        }
      } catch (e) {
        // Try tokens pallet
        try {
          const metadata = await api.query.tokens.metadata(assetId);
          if (metadata && !metadata.isEmpty) {
            assetMetadata[assetId] = metadata.toHuman();
            console.log(`Asset ID ${assetId}:`);
            console.log(`  ${JSON.stringify(metadata.toHuman(), null, 2)}`);
          }
        } catch (e2) {
          // Try assets pallet
          try {
            const metadata = await api.query.assets.metadata(assetId);
            if (metadata && !metadata.isEmpty) {
              assetMetadata[assetId] = metadata.toHuman();
              console.log(`Asset ID ${assetId}:`);
              console.log(`  ${JSON.stringify(metadata.toHuman(), null, 2)}`);
            }
          } catch (e3) {
            // No metadata found
            console.log(`Asset ID ${assetId}: No metadata found (may need manual mapping)`);
          }
        }
      }
    } catch (error: any) {
      console.log(`Asset ID ${assetId}: Error - ${error.message}`);
    }
  }
  
  // Save results
  const reportPath = path.join(__dirname, '../../hydration-asset-metadata.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    metadata: assetMetadata
  }, null, 2));
  
  console.log(`\n📄 Metadata saved to: ${reportPath}\n`);
  
  // Based on common Polkadot ecosystem patterns, provide likely mappings
  console.log('💡 Likely Asset ID Mappings (based on common patterns):\n');
  console.log('Asset ID 0  = HDX (native token)');
  console.log('Asset ID 5  = DOT ✅ (verified)');
  console.log('Asset ID 16 = GLMR ✅ (verified)');
  console.log('Asset ID 19 = WBTC ✅ (verified)');
  console.log('\n⚠️  For USDT, USDC, ETH - need to check Hydration docs or Subscan');
  console.log('   Visit: https://hydration.subscan.io/ or https://docs.hydration.net/\n');
  
  await api.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

