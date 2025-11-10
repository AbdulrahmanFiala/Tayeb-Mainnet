import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import halaCoinsConfig from "../../config/halaCoins.json";
import deployedContractsConfig from "../../config/deployedContracts.json";
import { HalaCoinsConfig, DeployedContracts, HalaCoin } from "../../config/types";

const { ethers } = hre;

/**
 * Sync coins from ShariaCompliance contract to JSON config
 * 
 * This script:
 * 1. Reads all coins from contract
 * 2. Compares with JSON config
 * 3. Updates JSON to match contract state:
 *    - Adds new coins from contract
 *    - Sets permissible: false for removed coins (keeps them in JSON)
 *    - Updates permissible flag based on contract's verified field
 *    - Updates complianceReason from contract
 *    - Preserves addresses and other metadata
 * 
 * Usage: npx hardhat run scripts/deploy/sync-coins-from-contract.ts --network moonbeam
 */
async function main() {
  const config = halaCoinsConfig as HalaCoinsConfig;
  const contractsConfig = deployedContractsConfig as DeployedContracts;

  console.log("🔄 Syncing coins from contract to JSON config...\n");

  // Check if contract is deployed
  const shariaComplianceAddress = contractsConfig.main.shariaCompliance;
  if (!shariaComplianceAddress) {
    console.error("❌ Error: ShariaCompliance contract not found in deployedContracts.json!");
    console.log("\n📝 Please deploy contracts first:");
    console.log("   npx hardhat run scripts/deploy/deploy-core.ts --network moonbeam\n");
    process.exit(1);
  }

  console.log("📖 Reading from contract:", shariaComplianceAddress);
  console.log();

  // Connect to contract
  const shariaCompliance = await ethers.getContractAt("ShariaCompliance", shariaComplianceAddress);

  // Get all coins from contract
  const contractCoins = await shariaCompliance.getAllShariaCoins();
  console.log(`📊 Found ${contractCoins.length} coins in contract`);
  console.log();

  // Create map of contract coins by symbol
  const contractCoinsMap = new Map<string, any>();
  for (const coin of contractCoins) {
    contractCoinsMap.set(coin.id, coin);
  }

  // Create map of JSON coins by symbol
  const jsonCoinsMap = new Map<string, HalaCoin>();
  for (const coin of config.coins) {
    jsonCoinsMap.set(coin.symbol, coin);
  }

  // Update existing coins and track what's in contract
  const contractSymbols = new Set<string>();
  const updatedCoins: HalaCoin[] = [];

  console.log("📝 Processing coins from JSON...");
  
  for (const jsonCoin of config.coins) {
    const contractCoin = contractCoinsMap.get(jsonCoin.symbol);
    
    if (contractCoin) {
      // Coin exists in contract - update from contract
      contractSymbols.add(jsonCoin.symbol);
      updatedCoins.push({
        ...jsonCoin,
        permissible: contractCoin.verified,
        complianceReason: contractCoin.complianceReason,
        // Preserve addresses and other metadata
      });
      console.log(`✅ Updated ${jsonCoin.symbol} - permissible: ${contractCoin.verified}`);
    } else {
      // Coin not in contract - mark as not permissible but keep in JSON
      updatedCoins.push({
        ...jsonCoin,
        permissible: false,
      });
      console.log(`⚠️  ${jsonCoin.symbol} not in contract - set permissible: false`);
    }
  }

  console.log();

  // Add new coins from contract that aren't in JSON
  console.log("📝 Checking for new coins in contract...");
  let newCoinsCount = 0;
  
  for (const contractCoin of contractCoins) {
    if (!jsonCoinsMap.has(contractCoin.id)) {
      // New coin from contract - add to JSON
      const newCoin: HalaCoin = {
        symbol: contractCoin.id,
        name: contractCoin.name,
        decimals: 18, // Default, will need manual update
        complianceReason: contractCoin.complianceReason,
        description: `Auto-synced from contract`,
        permissible: contractCoin.verified,
        addresses: {
          moonbeam: null,
        },
      };
      updatedCoins.push(newCoin);
      newCoinsCount++;
      console.log(`➕ Added new coin: ${contractCoin.id} (${contractCoin.name})`);
    }
  }

  if (newCoinsCount === 0) {
    console.log("✅ No new coins found in contract");
  }
  console.log();

  // Update JSON
  const updatedConfig: HalaCoinsConfig = {
    ...config,
    coins: updatedCoins,
    metadata: {
      ...config.metadata,
      lastUpdated: new Date().toISOString(),
    },
  };

  const configPath = path.join(__dirname, "..", "..", "config", "halaCoins.json");
  fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2) + "\n");

  console.log("=".repeat(60));
  console.log("📋 SYNC SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total coins in JSON: ${updatedCoins.length}`);
  console.log(`Coins in contract: ${contractCoins.length}`);
  console.log(`New coins added: ${newCoinsCount}`);
  console.log(`Permissible coins: ${updatedCoins.filter(c => c.permissible).length}`);
  console.log(`Non-permissible coins: ${updatedCoins.filter(c => !c.permissible).length}`);
  console.log("=".repeat(60));
  console.log();
  console.log("✅ JSON config updated successfully!");
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

