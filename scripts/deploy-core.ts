import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import halaCoinsConfig from "../config/halaCoins.json";
import deployedContractsConfig from "../config/deployedContracts.json";
import { HalaCoinsConfig, DeployedContracts } from "../config/types";
import { deployOrVerifyContract } from "./utils/deployHelpers";

/**
 * Deploy Main Contracts to Moonbase Alpha Testnet
 * 
 * This script deploys:
 * 1. ShariaCompliance
 * 2. ShariaSwap
 * 3. ShariaDCA
 * 
 * Reads AMM addresses and token config from JSON files
 */
async function main() {
  // Load environment variables and config
  dotenv.config();
  const config = halaCoinsConfig as HalaCoinsConfig;

  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying Main Contracts to Moonbase Alpha Testnet...\n");
  console.log("Account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "DEV\n");

  // ============================================================================
  // Read AMM addresses from deployedContracts.json
  // ============================================================================
  const contractsConfig = deployedContractsConfig as DeployedContracts;
  const WETH_ADDRESS = contractsConfig.amm.weth || ethers.getAddress("0xD909178CC99d318e4D46e7E66a972955859670E1".toLowerCase());
  const DEX_ROUTER = contractsConfig.amm.router;
  const FACTORY_ADDRESS = contractsConfig.amm.factory;

  if (!DEX_ROUTER || !FACTORY_ADDRESS) {
    console.error("❌ Error: AMM addresses not found in deployedContracts.json!");
    console.log("\n📝 Please run deploy-amm-core.ts first:");
    console.log("   npx hardhat run scripts/deploy-amm-core.ts --network moonbase\n");
    process.exit(1);
  }

  console.log("📖 Using AMM addresses from deployedContracts.json:");
  console.log("   Factory:", FACTORY_ADDRESS);
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
      return await ShariaSwap.deploy(
        shariaComplianceAddress,
        DEX_ROUTER,
        WETH_ADDRESS,
        FACTORY_ADDRESS
      );
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
      return await ShariaDCA.deploy(
        shariaComplianceAddress,
        DEX_ROUTER,
        FACTORY_ADDRESS,
        WETH_ADDRESS
      );
    }
  );
  const shariaDCA = await ethers.getContractAt("ShariaDCA", shariaDCAAddress);
  console.log();

  // ============================================================================
  // Update deployedContracts.json with main contract addresses
  // ============================================================================
  console.log("📝 Updating deployedContracts.json with main contract addresses...");
  const contractsPath = path.join(__dirname, "..", "config", "deployedContracts.json");

  const updatedContracts = {
    ...contractsConfig,
    network: "moonbase",
    lastDeployed: new Date().toISOString(),
    amm: contractsConfig.amm, // Preserve AMM addresses if already deployed
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
    const tokenAddress = coin.addresses.moonbase;
    
    if (!tokenAddress) {
        console.warn(`⚠️  Warning: ${coin.symbol} address not found, registering without address...`);
    }
    
    // Skip if already registered
    if (registeredSymbols.has(coin.symbol)) {
        console.log(`⏭️  ${coin.symbol} already registered, skipping...`);
        skippedCount++;
        continue;
    }
    
    try {
        const tx = await shariaCompliance.registerShariaCoin(
            coin.symbol,
            coin.name,
            coin.symbol,
            tokenAddress,
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
  console.log("1. Add liquidity: npx hardhat run scripts/addLiquidity.ts --network moonbase");
  console.log("2. Test swaps through ShariaSwap");
  console.log("3. Register more Sharia-compliant tokens via registerShariaCoin()");
  console.log("4. Set up Chainlink Automation for ShariaDCA");
  console.log();
  console.log("🔍 Verify contracts on Moonscan (optional) - requires ETHERSCAN_API_KEY");
  console.log("Get API key from: https://moonscan.io/myapikey");
  console.log(`npx hardhat verify --network moonbase ${shariaComplianceAddress}`);
  console.log(`npx hardhat verify --network moonbase ${shariaSwapAddress} ${shariaComplianceAddress} ${DEX_ROUTER} ${WETH_ADDRESS} ${FACTORY_ADDRESS}`);
  console.log(`npx hardhat verify --network moonbase ${shariaDCAAddress} ${shariaComplianceAddress} ${DEX_ROUTER} ${FACTORY_ADDRESS} ${WETH_ADDRESS}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

