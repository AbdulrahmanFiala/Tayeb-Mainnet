import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

const { ethers } = hre;

/**
 * Deploy RemoteSwapInitiator contract on Moonbeam (or Chopsticks fork).
 * Enables cross-chain swaps to Hydration via XCM.
 */

interface DeployedContracts {
  ShariaCompliance?: string;
  [key: string]: string | undefined;
}

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
 * Load deployed contracts addresses
 */
function loadDeployedContracts(): DeployedContracts {
  const configPath = path.join(__dirname, "../../config/deployedContracts.json");
  if (!fs.existsSync(configPath)) {
    console.log("⚠️  No deployed contracts found. Deploy core contracts first.");
    return {};
  }
  const configData = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(configData);
}

/**
 * Load XCM configuration
 */
function loadXcmConfig(): XcmConfig {
  const configPath = path.join(__dirname, "../../config/xcmConfig.json");
  const configData = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(configData);
}

/**
 * Save deployed contract address
 */
function saveDeployedContract(contractName: string, address: string) {
  const configPath = path.join(__dirname, "../../config/deployedContracts.json");
  
  let contracts: DeployedContracts = {};
  if (fs.existsSync(configPath)) {
    const configData = fs.readFileSync(configPath, "utf-8");
    contracts = JSON.parse(configData);
  }
  
  contracts[contractName] = address;
  
  fs.writeFileSync(configPath, JSON.stringify(contracts, null, 2));
  console.log(`✅ Saved ${contractName} address to deployedContracts.json`);
}

async function main() {
  console.log("\n🚀 Deploying RemoteSwapInitiator...\n");

  // Get network
  const network = await ethers.provider.getNetwork();
  console.log(`📡 Network: ${network.name} (Chain ID: ${network.chainId})`);

  // Load configurations
  const deployedContracts = loadDeployedContracts();
  const xcmConfig = loadXcmConfig();

  // Check if ShariaCompliance is deployed
  if (!deployedContracts.ShariaCompliance) {
    throw new Error("❌ ShariaCompliance contract not found. Deploy core contracts first.");
  }

  console.log("\n📋 Configuration:");
  console.log(`   ShariaCompliance: ${deployedContracts.ShariaCompliance}`);
  console.log(`   XCM Transactor Precompile: ${xcmConfig.moonbeam.xcmTransactorPrecompile}`);
  console.log(`   Hydration Parachain ID: ${xcmConfig.hydration.parachainId}`);
  console.log(`   Omnipool Pallet Index: ${xcmConfig.hydration.omnipoolPalletIndex}`);
  console.log(`   Sell Call Index: ${xcmConfig.hydration.sellCallIndex}`);

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`\n👤 Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`   Balance: ${ethers.formatEther(balance)} GLMR`);

  // Deploy RemoteSwapInitiator
  console.log("\n📝 Deploying RemoteSwapInitiator...");
  
  const RemoteSwapInitiator = await ethers.getContractFactory("RemoteSwapInitiator");
  const remoteSwapInitiator = await RemoteSwapInitiator.deploy(
    deployedContracts.ShariaCompliance,
    xcmConfig.moonbeam.xcmTransactorPrecompile,
    xcmConfig.hydration.parachainId,
    xcmConfig.hydration.omnipoolPalletIndex,
    xcmConfig.hydration.sellCallIndex
  );

  await remoteSwapInitiator.waitForDeployment();
  const address = await remoteSwapInitiator.getAddress();

  console.log(`✅ RemoteSwapInitiator deployed at: ${address}`);

  // Save address
  saveDeployedContract("RemoteSwapInitiator", address);

  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  const shariaComplianceAddr = await remoteSwapInitiator.shariaCompliance();
  const xcmTransactorAddr = await remoteSwapInitiator.xcmTransactor();
  const parachainId = await remoteSwapInitiator.hydrationParachainId();

  console.log(`   Sharia Compliance: ${shariaComplianceAddr}`);
  console.log(`   XCM Transactor: ${xcmTransactorAddr}`);
  console.log(`   Hydration Parachain ID: ${parachainId}`);

  // Display usage instructions
  console.log("\n📚 Next Steps:");
  console.log("   1. Fund the contract with native GLMR for XCM fees");
  console.log("   2. Ensure HRMP channel exists between Moonbeam and Hydration");
  console.log("   3. Register cross-chain assets as XC-20s");
  console.log("   4. Use initiate-remote-swap.ts to test swaps");
  console.log("\n   Run: npx hardhat run scripts/xcm/initiate-remote-swap.ts --network moonbeam");

  console.log("\n✅ Deployment complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });



