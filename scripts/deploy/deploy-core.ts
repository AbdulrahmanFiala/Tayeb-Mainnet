import hre from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import halaCoinsConfig from "../../config/halaCoins.json";
import deployedContractsConfig from "../../config/deployedContracts.json";
import xcmRawConfig from "../../config/xcmConfig.json";
import { HalaCoinsConfig, DeployedContracts } from "../../config/types";
import { buildTxOverrides, deployOrVerifyContract } from "../utils/deployHelpers";

const { ethers } = hre;

interface XcmConfig {
  moonbeam: {
    xcmTransactorPrecompile: string;
  };
  hydration: {
    parachainId: number;
    omnipoolPalletIndex: number;
    sellCallIndex: number;
  };
}

/**
 * Deploy core contracts to Moonbeam
 *
 * This script deploys:
 * 1. ShariaCompliance
 * 2. RemoteSwapInitiator
 *
 * Reads token config from JSON files and XCM settings for the bridge.
 */
async function main() {
  // Load environment variables and config
  dotenv.config();
  const config = halaCoinsConfig as HalaCoinsConfig;
  const xcmConfig = xcmRawConfig as XcmConfig;

  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying Sharia core contracts...\n");
  console.log("Account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "GLMR\n");

  // ============================================================================
  // Read DEX configuration from deployedContracts.json
  // ============================================================================
  const contractsConfig = deployedContractsConfig as DeployedContracts;

  if (!xcmConfig?.moonbeam?.xcmTransactorPrecompile || !xcmConfig?.hydration) {
    console.error("❌ Error: Missing XCM configuration in config/xcmConfig.json");
    process.exit(1);
  }

  console.log("📖 Loaded XCM configuration:");
  console.log("   XCM Transactor:", xcmConfig.moonbeam.xcmTransactorPrecompile);
  console.log("   Hydration Parachain ID:", xcmConfig.hydration.parachainId);
  console.log("   Omnipool Pallet Index:", xcmConfig.hydration.omnipoolPalletIndex);
  console.log("   Sell Call Index:", xcmConfig.hydration.sellCallIndex);
  console.log();

  const txOverrides = await buildTxOverrides();

  // ============================================================================
  // Deploy ShariaCompliance (Idempotent)
  // ============================================================================
  console.log("📝 Deploying ShariaCompliance...");
  const shariaComplianceAddress = await deployOrVerifyContract(
    "ShariaCompliance",
    contractsConfig.main.shariaCompliance,
    async () => {
      const ShariaCompliance = await ethers.getContractFactory("ShariaCompliance");
      return await ShariaCompliance.deploy(txOverrides);
    }
  );
  const shariaCompliance = await ethers.getContractAt("ShariaCompliance", shariaComplianceAddress);
  console.log();

  // ============================================================================
  // Deploy RemoteSwapInitiator (Idempotent)
  // ============================================================================
  console.log("🌉 Deploying RemoteSwapInitiator...");
  const remoteSwapInitiatorAddress = await deployOrVerifyContract(
    "RemoteSwapInitiator",
    contractsConfig.main.remoteSwapInitiator,
    async () => {
      const RemoteSwapInitiator = await ethers.getContractFactory("RemoteSwapInitiator");
      return await RemoteSwapInitiator.deploy(
        shariaComplianceAddress,
        xcmConfig.moonbeam.xcmTransactorPrecompile,
        xcmConfig.hydration.parachainId,
        xcmConfig.hydration.omnipoolPalletIndex,
        xcmConfig.hydration.sellCallIndex,
        txOverrides
      );
    }
  );
  const remoteSwapInitiator = await ethers.getContractAt("RemoteSwapInitiator", remoteSwapInitiatorAddress);
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
      shariaSwap: contractsConfig.main.shariaSwap ?? null,
      shariaDCA: contractsConfig.main.shariaDCA ?? null,
      remoteSwapInitiator: remoteSwapInitiatorAddress,
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
            const registrationOverrides = await buildTxOverrides();
            const tx = await shariaCompliance.registerShariaCoin(
                coin.symbol,
                coin.name,
                coin.symbol,
                tokenAddressToUse,
                coin.complianceReason,
                registrationOverrides
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

  console.log("✅ Token addresses are now stored in ShariaCompliance");
  console.log("   RemoteSwapInitiator pulls compliance data on-chain automatically");
  console.log();

  // ============================================================================
  // Summary
  // ============================================================================
  console.log();
  console.log("=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("ShariaCompliance:", shariaComplianceAddress);
  console.log("RemoteSwapInit:  ", remoteSwapInitiatorAddress);
  console.log("=".repeat(60));
  console.log();
  console.log("🔧 Next Steps:");
  console.log("1. Configure RemoteSwapInitiator (fund GLMR, ensure XC-20 registrations).");
  console.log("2. Register more Sharia-compliant tokens via registerShariaCoin() or npm run sync:coins.");
  console.log("3. (Optional) Deploy ShariaSwap and ShariaDCA via npm run deploy:mainnet");
  console.log();
  console.log("🔍 Verify contracts on Moonscan (optional) - requires ETHERSCAN_API_KEY");
  console.log("Get API key from: https://moonscan.io/myapikey");
  console.log(`npx hardhat verify --network moonbeam ${shariaComplianceAddress}`);
  console.log(`npx hardhat verify --network moonbeam ${remoteSwapInitiatorAddress} ${shariaComplianceAddress} ${xcmConfig.moonbeam.xcmTransactorPrecompile} ${xcmConfig.hydration.parachainId} ${xcmConfig.hydration.omnipoolPalletIndex} ${xcmConfig.hydration.sellCallIndex}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

