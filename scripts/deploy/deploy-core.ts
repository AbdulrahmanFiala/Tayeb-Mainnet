import hre from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import halaCoinsConfig from "../../config/halaCoins.json";
import deployedContractsConfig from "../../config/deployedContracts.json";
import { HalaCoinsConfig, DeployedContracts } from "../../config/types";
import { deployOrVerifyContract } from "../utils/deployHelpers";

const { ethers } = hre;

/**
 * Deploy main contracts to Moonbeam (or Chopsticks fork)
 * 
 * This script deploys:
 * 1. ShariaCompliance
 * 2. ShariaSwap
 * 3. ShariaDCA
 * 
 * Reads DEX configuration and token config from JSON files
 */
async function main() {
  // Load environment variables and config
  dotenv.config();
  const config = halaCoinsConfig as HalaCoinsConfig;

  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying Sharia core contracts...\n");
  console.log("Account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "GLMR\n");

  // ============================================================================
  // Read DEX configuration from deployedContracts.json
  // ============================================================================
  const contractsConfig = deployedContractsConfig as DeployedContracts;
  const WETH_ADDRESS =
    contractsConfig.amm.weth ||
    ethers.getAddress("0xAcc15dC74880C9944775448304B263D191c6077F");
  const DEX_ROUTER = contractsConfig.amm.router;

  if (!DEX_ROUTER) {
    console.error("❌ Error: DEX router address not found in deployedContracts.json!");
    console.log("\n📝 Please update config/deployedContracts.json with your preferred router address.");
    console.log('   Example: "amm": { "router": "0x...", "weth": "0xAcc1..." }\n');
    process.exit(1);
  }

  console.log("📖 Using DEX configuration from deployedContracts.json:");
  console.log("   Router:", DEX_ROUTER);
  console.log("   WETH:", WETH_ADDRESS);
  console.log();

  // ============================================================================
  // Deploy ShariaCompliance (Idempotent)
  // ============================================================================
  console.log("📝 Deploying ShariaCompliance...");
  const shariaComplianceAddress = await deployOrVerifyContract(
    "ShariaCompliance",
    contractsConfig.main.shariaCompliance,
    async () => {
      const ShariaCompliance = await ethers.getContractFactory("ShariaCompliance");
      return await ShariaCompliance.deploy();
    }
  );
  const shariaCompliance = await ethers.getContractAt("ShariaCompliance", shariaComplianceAddress);
  console.log();

  // ============================================================================
  // Deploy ShariaSwap (Idempotent)
  // ============================================================================
  console.log("💱 Deploying ShariaSwap...");
  const shariaSwapAddress = await deployOrVerifyContract(
    "ShariaSwap",
    contractsConfig.main.shariaSwap,
    async () => {
      const ShariaSwap = await ethers.getContractFactory("ShariaSwap");
      return await ShariaSwap.deploy(shariaComplianceAddress, DEX_ROUTER, WETH_ADDRESS);
    }
  );
  const shariaSwap = await ethers.getContractAt("ShariaSwap", shariaSwapAddress);
  console.log();

  // ============================================================================
  // Deploy ShariaDCA (Idempotent)
  // ============================================================================
  console.log("📅 Deploying ShariaDCA...");
  const shariaDCAAddress = await deployOrVerifyContract(
    "ShariaDCA",
    contractsConfig.main.shariaDCA,
    async () => {
      const ShariaDCA = await ethers.getContractFactory("ShariaDCA");
      return await ShariaDCA.deploy(shariaComplianceAddress, DEX_ROUTER, WETH_ADDRESS);
    }
  );
  const shariaDCA = await ethers.getContractAt("ShariaDCA", shariaDCAAddress);
  console.log();

  // ============================================================================
  // Update deployedContracts.json with main contract addresses
  // ============================================================================
  console.log("📝 Updating deployedContracts.json with main contract addresses...");
  const contractsPath = path.join(__dirname, "..", "..", "config", "deployedContracts.json");

  const updatedContracts = {
    ...contractsConfig,
    network: "moonbeam",
    lastDeployed: new Date().toISOString(),
    amm: contractsConfig.amm, // Preserve DEX configuration if already set
    main: {
      shariaCompliance: shariaComplianceAddress,
      shariaSwap: shariaSwapAddress,
      shariaDCA: shariaDCAAddress,
    },
    metadata: {
      ...contractsConfig.metadata,
      deploymentDate: new Date().toISOString(),
      deployer: deployer.address,
    },
  };

  fs.writeFileSync(contractsPath, JSON.stringify(updatedContracts, null, 2) + "\n");
  console.log("✅ Updated deployedContracts.json with main contract addresses");
  console.log();

  // ============================================================================
  // Post-deployment setup
  // ============================================================================
  console.log("⚙️  Setting up initial configuration...\n");

  console.log("Registering all Initial Hala Coins from config...");
  console.log(`📊 Total coins to register: ${config.coins.length}`);
  console.log();

  // ============================================================================
  // Register all coins in ShariaCompliance (from config) - Idempotent
  // ============================================================================
  console.log("📝 Registering coins in ShariaCompliance (idempotent)...");
  
  // Get all currently registered coins
  const registeredCoins = await shariaCompliance.getAllShariaCoins();
  const registeredSymbols = new Set(registeredCoins.map((c: any) => c.id));
  
  let registeredCount = 0;
  let skippedCount = 0;
  
  for (const coin of config.coins) {
    // Update coin registration to include address
    const tokenAddress = coin.addresses.moonbeam;

    if (!tokenAddress) {
        console.warn(`⚠️  Warning: ${coin.symbol} moonbeam address not set, registering without address...`);
    }
    
    // Skip if already registered
    if (registeredSymbols.has(coin.symbol)) {
        console.log(`⏭️  ${coin.symbol} already registered, skipping...`);
        skippedCount++;
        continue;
    }
    
    try {
        const tokenAddressToUse = tokenAddress ?? ethers.ZeroAddress;
        const tx = await shariaCompliance.registerShariaCoin(
            coin.symbol,
            coin.name,
            coin.symbol,
            tokenAddressToUse,
            coin.complianceReason
        );
        await tx.wait();
        console.log(`✅ Registered ${coin.symbol} (${coin.name}) in ShariaCompliance`);
        registeredCount++;
    } catch (error: any) {
        if (error.message?.includes("CoinAlreadyExists") || error.reason?.includes("CoinAlreadyExists")) {
            console.log(`⏭️  ${coin.symbol} already exists in ShariaCompliance, skipping...`);
            skippedCount++;
        } else {
            console.warn(`⚠️  Failed to register ${coin.symbol} in ShariaCompliance:`, error.message);
        }
    }
  }
  
  console.log(`\n📊 Registration summary: ${registeredCount} new, ${skippedCount} already registered`);
  console.log();

  // Note: ShariaSwap and ShariaDCA now query ShariaCompliance directly
  // No separate registration needed - addresses are stored in ShariaCompliance
  console.log("✅ Token addresses are now stored in ShariaCompliance");
  console.log("   ShariaSwap and ShariaDCA will query ShariaCompliance automatically");
  console.log();

  // ============================================================================
  // Summary
  // ============================================================================
  console.log();
  console.log("=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("ShariaCompliance:", shariaComplianceAddress);
  console.log("ShariaSwap:      ", shariaSwapAddress);
  console.log("ShariaDCA:       ", shariaDCAAddress);
  console.log("=".repeat(60));
  console.log();
  console.log("🔧 Next Steps:");
  console.log("1. Confirm your chosen router has liquidity for the intended trading pairs.");
  console.log("2. Test swaps through ShariaSwap using explicit paths.");
  console.log("3. Register more Sharia-compliant tokens via registerShariaCoin() or npm run sync:coins.");
  console.log("4. Run automation script: npx hardhat run scripts/automation/auto-execute-dca.ts --network moonbeam");
  console.log();
  console.log("🔍 Verify contracts on Moonscan (optional) - requires ETHERSCAN_API_KEY");
  console.log("Get API key from: https://moonscan.io/myapikey");
  console.log(`npx hardhat verify --network moonbeam ${shariaComplianceAddress}`);
  console.log(`npx hardhat verify --network moonbeam ${shariaSwapAddress} ${shariaComplianceAddress} ${DEX_ROUTER} ${WETH_ADDRESS}`);
  console.log(`npx hardhat verify --network moonbeam ${shariaDCAAddress} ${shariaComplianceAddress} ${DEX_ROUTER} ${WETH_ADDRESS}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

