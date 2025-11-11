import hre from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import deployedContractsConfig from "../../config/deployedContracts.json";
import xcmRawConfig from "../../config/xcmConfig.json";
import { DeployedContracts } from "../../config/types";
import { buildTxOverrides, deployOrVerifyContract } from "../utils/deployHelpers";

dotenv.config();

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

async function main() {
  const contractsConfig = deployedContractsConfig as DeployedContracts;
  const xcmConfig = xcmRawConfig as XcmConfig;

  const shariaComplianceAddress = contractsConfig.main.shariaCompliance;
  if (!shariaComplianceAddress) {
    throw new Error("ShariaCompliance address not found. Deploy it first.");
  }

  if (!xcmConfig?.moonbeam?.xcmTransactorPrecompile || !xcmConfig?.hydration) {
    throw new Error("Missing XCM configuration. Check config/xcmConfig.json.");
  }

  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying CrosschainSwapInitiator...\n");
  console.log("Account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "GLMR\n");

  console.log("📖 XCM configuration:");
  console.log("   XCM Transactor:", xcmConfig.moonbeam.xcmTransactorPrecompile);
  console.log("   Hydration Parachain ID:", xcmConfig.hydration.parachainId);
  console.log("   Omnipool Pallet Index:", xcmConfig.hydration.omnipoolPalletIndex);
  console.log("   Sell Call Index:", xcmConfig.hydration.sellCallIndex);
  console.log();

  const txOverrides = await buildTxOverrides();

  const crosschainSwapInitiatorAddress = await deployOrVerifyContract(
    "CrosschainSwapInitiator",
    contractsConfig.main.crosschainSwapInitiator,
    async () => {
      const CrosschainSwapInitiator = await ethers.getContractFactory("CrosschainSwapInitiator");
      return await CrosschainSwapInitiator.deploy(
        shariaComplianceAddress,
        xcmConfig.moonbeam.xcmTransactorPrecompile,
        xcmConfig.hydration.parachainId,
        xcmConfig.hydration.omnipoolPalletIndex,
        xcmConfig.hydration.sellCallIndex,
        txOverrides
      );
    }
  );

  console.log("\n📝 Updating deployedContracts.json...");
  const contractsPath = path.join(__dirname, "..", "..", "config", "deployedContracts.json");

  const updatedContracts: DeployedContracts = {
    ...contractsConfig,
    network: "moonbeam",
    lastDeployed: new Date().toISOString(),
    main: {
      ...contractsConfig.main,
      shariaCompliance: shariaComplianceAddress,
      crosschainSwapInitiator: crosschainSwapInitiatorAddress,
    },
    metadata: {
      ...contractsConfig.metadata,
      deploymentDate: new Date().toISOString(),
      deployer: deployer.address,
    },
  };

  fs.writeFileSync(contractsPath, JSON.stringify(updatedContracts, null, 2) + "\n");
  console.log("✅ deployedContracts.json updated\n");

  console.log("=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("ShariaCompliance:", shariaComplianceAddress);
  console.log("CrosschainSwapInitiator:", crosschainSwapInitiatorAddress);
  console.log("=".repeat(60));
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


