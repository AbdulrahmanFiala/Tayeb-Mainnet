import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import halaCoinsConfig from "../../config/halaCoins.json";
import deployedContractsConfig from "../../config/deployedContracts.json";
import {
  HalaCoinsConfig,
  DeployedContracts,
  HalaCoin,
  HalaCoinVariant,
} from "../../config/types";

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
 * Usage: npx hardhat run scripts/automation/sync-coins-from-contract.ts --network moonbeam
 */
async function main() {
  const config = halaCoinsConfig as HalaCoinsConfig;
  const clonedCoins: HalaCoin[] = config.coins.map((coin) => ({
    ...coin,
    addresses: {
      ...coin.addresses,
    },
    variants: coin.variants
      ? coin.variants.map((variant) => ({
          ...variant,
          addresses: {
            ...variant.addresses,
          },
        }))
      : undefined,
  }));
  const contractsConfig = deployedContractsConfig as DeployedContracts;

  console.log("🔄 Syncing coins from contract to JSON config...\n");

  // Check if contract is deployed
  const shariaComplianceAddress = contractsConfig.main.shariaCompliance;
  if (!shariaComplianceAddress) {
    console.error("❌ Error: ShariaCompliance contract not found in deployedContracts.json!");
    console.log("\n📝 Please deploy contracts first:");
    console.log("   npx hardhat run scripts/deploy/deploy-sharia-compliance.ts --network moonbeam\n");
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

  // Create map from symbol to coin/variant reference
  const symbolIndexMap = new Map<
    string,
    { coinIndex: number; variantIndex?: number }
  >();
  clonedCoins.forEach((coin, coinIndex) => {
    symbolIndexMap.set(coin.symbol, { coinIndex });
    coin.variants?.forEach((variant, variantIndex) => {
      symbolIndexMap.set(variant.symbol, { coinIndex, variantIndex });
    });
  });

  // Update existing entries and track contract symbols
  const contractSymbols = new Set<string>();

  console.log("📝 Processing coins and variants from JSON...");

  for (const [symbol, ref] of symbolIndexMap.entries()) {
    const contractCoin = contractCoinsMap.get(symbol);
    const coin = clonedCoins[ref.coinIndex];
    const variant =
      ref.variantIndex !== undefined && coin.variants
        ? coin.variants[ref.variantIndex]
        : undefined;
    const label =
      ref.variantIndex !== undefined && coin.variants
        ? `${symbol} (variant of ${coin.symbol})`
        : symbol;

    if (contractCoin) {
      contractSymbols.add(symbol);

      if (variant) {
        variant.permissible = contractCoin.verified;
        variant.complianceReason =
          contractCoin.complianceReason ?? variant.complianceReason;
      } else {
        coin.permissible = contractCoin.verified;
        coin.complianceReason =
          contractCoin.complianceReason ?? coin.complianceReason;
      }

      console.log(
        `✅ Updated ${label} - permissible: ${contractCoin.verified}`
      );
    } else {
      if (variant) {
        variant.permissible = false;
      } else {
        coin.permissible = false;
      }
      console.log(`⚠️  ${label} not in contract - set permissible: false`);
    }
  }

  console.log();

  // Add new coins from contract that aren't in JSON
  console.log("📝 Checking for new coins in contract...");
  let newCoinsCount = 0;
  
  for (const contractCoin of contractCoins) {
    if (!symbolIndexMap.has(contractCoin.id)) {
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
      clonedCoins.push(newCoin);
      symbolIndexMap.set(contractCoin.id, {
        coinIndex: clonedCoins.length - 1,
      });
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
    coins: clonedCoins,
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
  const variantCount = clonedCoins.reduce(
    (acc, coin) => acc + (coin.variants?.length ?? 0),
    0
  );
  console.log(`Total coins in JSON: ${clonedCoins.length}`);
  console.log(`Total variants in JSON: ${variantCount}`);
  console.log(`Coins in contract: ${contractCoins.length}`);
  console.log(`New coins added: ${newCoinsCount}`);
  const permissibleCoins = clonedCoins.filter((c) => c.permissible).length;
  const permissibleVariants = clonedCoins.reduce(
    (acc, coin) => acc + (coin.variants?.filter((v) => v.permissible).length ?? 0),
    0
  );
  console.log(`Permissible base coins: ${permissibleCoins}`);
  console.log(`Permissible variants: ${permissibleVariants}`);
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

