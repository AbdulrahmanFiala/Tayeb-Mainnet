import hre from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import deployedContractsConfig from "../../config/deployedContracts.json";
import { DeployedContracts } from "../../config/types";
import { buildTxOverrides, deployOrVerifyContract } from "../utils/deployHelpers";

dotenv.config();

const { ethers } = hre;

async function main() {
  const contractsConfig = deployedContractsConfig as DeployedContracts;

  if (!contractsConfig.main.shariaCompliance) {
    throw new Error("ShariaCompliance address not found. Deploy it first.");
  }

  const router = contractsConfig.amm.router;
  const weth =
    contractsConfig.amm.weth ||
    "0xAcc15dC74880C9944775448304B263D191c6077F";

  if (!router) {
    throw new Error("DEX router address missing in config/deployedContracts.json.");
  }

  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying ShariaLocalSwap...\n");
  console.log("Account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "GLMR\n");

  const txOverrides = await buildTxOverrides();

  const shariaLocalSwapAddress = await deployOrVerifyContract(
    "ShariaLocalSwap",
    contractsConfig.main.shariaLocalSwap,
    async () => {
      const ShariaLocalSwap = await ethers.getContractFactory("ShariaLocalSwap");
      return await ShariaLocalSwap.deploy(
        contractsConfig.main.shariaCompliance!,
        router,
        weth,
        txOverrides
      );
    }
  );

  const configPath = path.join(__dirname, "..", "..", "config", "deployedContracts.json");
  const updatedContracts: DeployedContracts = {
    ...contractsConfig,
    network: "moonbeam",
    lastDeployed: new Date().toISOString(),
    main: {
      ...contractsConfig.main,
      shariaLocalSwap: shariaLocalSwapAddress,
    },
    metadata: {
      ...contractsConfig.metadata,
      deploymentDate: new Date().toISOString(),
      deployer: deployer.address,
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(updatedContracts, null, 2) + "\n");

  console.log("=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("ShariaLocalSwap:", shariaLocalSwapAddress);
  console.log("Router:", router);
  console.log("WGLMR:", weth);
  console.log("=".repeat(60));
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


