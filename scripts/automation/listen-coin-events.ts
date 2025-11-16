import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import tayebCoinsConfig from "../../config/tayebCoins.json";
import deployedContractsConfig from "../../config/deployedContracts.json";
import { TayebCoinsConfig, DeployedContracts, TayebCoin } from "../../config/types";

const { ethers } = hre;

/**
 * Event Listener for ShariaCompliance Contract
 * 
 * Continuously listens to CoinRegistered, CoinRemoved, and CoinUpdated events
 * and automatically syncs JSON config when events occur.
 * 
 * Usage: npx hardhat run scripts/automation/listen-coin-events.ts --network moonbeam
 * 
 * This script runs continuously. Press Ctrl+C to stop.
 */
async function main() {
  const contractsConfig = deployedContractsConfig as DeployedContracts;

  console.log("👂 Starting event listener for ShariaCompliance...\n");

  // Check if contract is deployed
  const shariaComplianceAddress = contractsConfig.main.shariaCompliance;
  if (!shariaComplianceAddress) {
    console.error("❌ Error: ShariaCompliance contract not found in deployedContracts.json!");
    console.log("\n📝 Please deploy contracts first:");
    console.log("   npx hardhat run scripts/deploy/deploy-sharia-compliance.ts --network moonbeam\n");
    process.exit(1);
  }

  console.log("📖 Listening to contract:", shariaComplianceAddress);
  console.log("🔄 Waiting for events... (Press Ctrl+C to stop)\n");

  // Connect to contract
  const shariaCompliance = await ethers.getContractAt("ShariaCompliance", shariaComplianceAddress);

  // Get current block for event filtering
  const currentBlock = await ethers.provider.getBlockNumber();
  console.log(`📦 Starting from block: ${currentBlock}\n`);

  // Function to sync JSON after event
  const syncJSON = async () => {
    console.log("🔄 Syncing JSON from contract...");
    
    try {
      // Import and run sync script logic
      const config = tayebCoinsConfig as TayebCoinsConfig;
      const contractCoins = await shariaCompliance.getAllShariaCoins();
      
      const contractCoinsMap = new Map<string, any>();
      for (const coin of contractCoins) {
        contractCoinsMap.set(coin.id, coin);
      }

      const jsonCoinsMap = new Map<string, TayebCoin>();
      for (const coin of config.coins) {
        jsonCoinsMap.set(coin.symbol, coin);
      }

      const contractSymbols = new Set<string>();
      const updatedCoins: TayebCoin[] = [];

      // Update existing coins
      for (const jsonCoin of config.coins) {
        const contractCoin = contractCoinsMap.get(jsonCoin.symbol);
        
        if (contractCoin) {
          contractSymbols.add(jsonCoin.symbol);
          updatedCoins.push({
            ...jsonCoin,
            permissible: contractCoin.verified,
            complianceReason: contractCoin.complianceReason,
          });
        } else {
          updatedCoins.push({
            ...jsonCoin,
            permissible: false,
          });
        }
      }

      // Add new coins from contract
      for (const contractCoin of contractCoins) {
        if (!jsonCoinsMap.has(contractCoin.id)) {
          const newCoin: TayebCoin = {
            symbol: contractCoin.id,
            name: contractCoin.name,
            decimals: 18,
            complianceReason: contractCoin.complianceReason,
            description: `Auto-synced from contract`,
            permissible: contractCoin.verified,
            addresses: {
              moonbeam: null,
            },
          };
          updatedCoins.push(newCoin);
        }
      }

      const updatedConfig: TayebCoinsConfig = {
        ...config,
        coins: updatedCoins,
        metadata: {
          ...config.metadata,
          lastUpdated: new Date().toISOString(),
        },
      };

      const configPath = path.join(__dirname, "..", "..", "config", "tayebCoins.json");
      fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2) + "\n");
      
      console.log("✅ JSON config updated successfully!\n");
    } catch (error: any) {
      console.error("❌ Error syncing JSON:", error.message);
    }
  };

  const compliance = shariaCompliance as any;

  // Listen to CoinRegistered event
  compliance.on(
    "CoinRegistered",
    async (
      coinId: string,
      name: string,
      symbol: string,
      complianceReason: string
    ) => {
    console.log("🔔 CoinRegistered event detected!");
    console.log(`   Coin: ${symbol} (${name})`);
    console.log(`   ID: ${coinId}`);
    console.log();
    await syncJSON();
    }
  );

  // Listen to CoinRemoved event
  compliance.on("CoinRemoved", async (coinId: string) => {
    console.log("🔔 CoinRemoved event detected!");
    console.log(`   Coin ID: ${coinId}`);
    console.log();
    await syncJSON();
  });

  // Listen to CoinUpdated event
  compliance.on(
    "CoinUpdated",
    async (coinId: string, verified: boolean, complianceReason: string) => {
    console.log("🔔 CoinUpdated event detected!");
    console.log(`   Coin ID: ${coinId}`);
    console.log(`   Verified: ${verified}`);
    console.log();
    await syncJSON();
    }
  );

  // Handle errors
  compliance.on("error", (error: unknown) => {
    console.error("❌ Event listener error:", error);
  });

  // Keep process alive
  process.on("SIGINT", () => {
    console.log("\n\n🛑 Stopping event listener...");
    process.exit(0);
  });

  // Initial sync
  await syncJSON();
}

main()
  .then(() => {
    // Keep process running
    return new Promise(() => {});
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

