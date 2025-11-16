import { ApiPromise, WsProvider } from '@polkadot/api';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Query Hydration Omnipool to get actual asset IDs
 * This helps verify and update the asset registry in xcmConfig.json
 */

interface XcmConfig {
  hydration: {
    rpcUrl: string;
    assetRegistry: Record<string, number>;
  };
}

function loadXcmConfig(): XcmConfig {
  const configPath = path.join(__dirname, '../../config/xcmConfig.json');
  const configData = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(configData);
}

async function main() {
  console.log('\n🔍 Querying Hydration Omnipool Asset Registry\n');
  
  const config = loadXcmConfig();
  const api = await ApiPromise.create({ 
    provider: new WsProvider(config.hydration.rpcUrl) 
  });
  
  await api.isReady;
  console.log('✅ Connected to Hydration\n');
  
  try {
    // Query all assets in Omnipool
    console.log('📋 Querying Omnipool assets...\n');
    const assets = await api.query.omnipool.assets.entries();
    
    console.log(`Found ${assets.length} assets in Omnipool:\n`);
    
    const assetMap = new Map<number, any>();
    
    for (const [key, value] of assets) {
      const assetId = Number(key.args[0].toString());
      const assetData = value.toHuman();
      assetMap.set(assetId, assetData);
      
      console.log(`Asset ID ${assetId}:`);
      console.log(`  Data: ${JSON.stringify(assetData, null, 2)}`);
      console.log('');
    }
    
    // Compare with expected asset IDs
    console.log('\n📊 Comparison with Expected Asset IDs:\n');
    console.log('Expected (from config) | Found in Omnipool | Status');
    console.log('-' .repeat(60));
    
    for (const [symbol, expectedId] of Object.entries(config.hydration.assetRegistry)) {
      const found = assetMap.has(expectedId);
      const status = found ? '✅' : '❌ NOT FOUND';
      console.log(`${symbol.padEnd(20)} | ${String(expectedId).padEnd(18)} | ${status}`);
    }
    
    // List all found asset IDs
    console.log('\n\n📋 All Asset IDs Found in Omnipool:\n');
    const sortedIds = Array.from(assetMap.keys()).sort((a, b) => a - b);
    for (const id of sortedIds) {
      console.log(`  Asset ID ${id}`);
    }
    
    // Save to file
    const reportPath = path.join(__dirname, '../../hydration-asset-registry.json');
    const report = {
      timestamp: new Date().toISOString(),
      totalAssets: assets.length,
      assets: Object.fromEntries(
        Array.from(assetMap.entries()).map(([id, data]) => [id, data])
      ),
      assetIds: sortedIds
    };
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Full registry saved to: ${reportPath}\n`);
    
  } catch (error: any) {
    console.error('❌ Error querying assets:', error.message);
    console.error('\n💡 Try querying via Polkadot.js Apps:');
    console.error('   1. Go to https://polkadot.js.org/apps');
    console.error('   2. Connect to Hydration (wss://rpc.hydradx.cloud)');
    console.error('   3. Navigate to: Developer → Chain State');
    console.error('   4. Query: omnipool.assets\n');
  } finally {
    await api.disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

