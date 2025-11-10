import hre from "hardhat";
import { execSync } from "child_process";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { DeployedContracts } from "../../config/types";
import { buildTxOverrides, deployOrVerifyContract } from "../utils/deployHelpers";

const { ethers } = hre;

dotenv.config();

function runSubScript(name: string, script: string, network: string, timeout = 120000) {
  console.log(`📦 Deploying ${name}...`);
  console.log("=".repeat(60));
  try {
    execSync(`npx hardhat run scripts/${script} --network ${network}`, {
      stdio: "inherit",
      timeout,
    });
    console.log(`\n✅ ${name} deployment complete!\n`);
  } catch (error: any) {
    console.error(`\n❌ ${name} deployment failed!`);
    if (error.message?.includes("ETIMEDOUT") || error.message?.includes("ENETUNREACH")) {
      console.error("\n💡 Network connection issue detected.");
      console.error("Try again or check your RPC endpoint.");
    } else if (error.message?.includes("insufficient funds")) {
      console.error("\n💡 Insufficient GLMR balance.");
      console.error("Get GLMR from an exchange or bridge.");
    }
    process.exit(1);
  }
}

function loadContractsConfig(): DeployedContracts {
  const configPath = path.join(__dirname, "..", "..", "config", "deployedContracts.json");
  const raw = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(raw);
}

async function deployShariaSwap(network: string) {
  console.log("💱 Deploying ShariaSwap...");

  const configPath = path.join(__dirname, "..", "..", "config", "deployedContracts.json");
  const contractsConfig = loadContractsConfig();
  const txOverrides = await buildTxOverrides();

  if (!contractsConfig.main.shariaCompliance) {
    throw new Error("ShariaCompliance address not found. Run deploy-core first.");
  }

  const router = contractsConfig.amm.router;
  const weth =
    contractsConfig.amm.weth ||
    "0xAcc15dC74880C9944775448304B263D191c6077F";

  if (!router) {
    throw new Error("DEX router address missing in config/deployedContracts.json.");
  }

  const shariaSwapAddress = await deployOrVerifyContract(
    "ShariaSwap",
    contractsConfig.main.shariaSwap,
    async () => {
      const ShariaSwap = await ethers.getContractFactory("ShariaSwap");
      return await ShariaSwap.deploy(
        contractsConfig.main.shariaCompliance!,
        router,
        weth,
        txOverrides
      );
    }
  );

  const [deployer] = await ethers.getSigners();

  const updatedContracts: DeployedContracts = {
    ...contractsConfig,
    network,
    lastDeployed: new Date().toISOString(),
    main: {
      ...contractsConfig.main,
      shariaSwap: shariaSwapAddress,
    },
    metadata: {
      ...contractsConfig.metadata,
      deploymentDate: new Date().toISOString(),
      deployer: deployer.address,
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(updatedContracts, null, 2) + "\n");
  console.log("✅ ShariaSwap deployed at:", shariaSwapAddress);
  console.log("✅ Updated deployedContracts.json with ShariaSwap address\n");
}

async function deployShariaDCA(network: string) {
  console.log("📅 Deploying ShariaDCA...");

  const configPath = path.join(__dirname, "..", "..", "config", "deployedContracts.json");
  const contractsConfig = loadContractsConfig();
  const txOverrides = await buildTxOverrides();

  if (!contractsConfig.main.shariaCompliance) {
    throw new Error("ShariaCompliance address not found. Run deploy-core first.");
  }

  const router = contractsConfig.amm.router;
  const weth =
    contractsConfig.amm.weth ||
    "0xAcc15dC74880C9944775448304B263D191c6077F";

  if (!router) {
    throw new Error("DEX router address missing in config/deployedContracts.json.");
  }

  const shariaDCAAddress = await deployOrVerifyContract(
    "ShariaDCA",
    contractsConfig.main.shariaDCA,
    async () => {
      const ShariaDCA = await ethers.getContractFactory("ShariaDCA");
      return await ShariaDCA.deploy(
        contractsConfig.main.shariaCompliance!,
        router,
        weth,
        txOverrides
      );
    }
  );

  const [deployer] = await ethers.getSigners();

  const updatedContracts: DeployedContracts = {
    ...contractsConfig,
    network,
    lastDeployed: new Date().toISOString(),
    main: {
      ...contractsConfig.main,
      shariaDCA: shariaDCAAddress,
    },
    metadata: {
      ...contractsConfig.metadata,
      deploymentDate: new Date().toISOString(),
      deployer: deployer.address,
    },
  };

  fs.writeFileSync(configPath, JSON.stringify(updatedContracts, null, 2) + "\n");
  console.log("✅ ShariaDCA deployed at:", shariaDCAAddress);
  console.log("✅ Updated deployedContracts.json with ShariaDCA address\n");
}

async function main() {
  console.log("🚀 Tayeb Mainnet Deployment\n");
  console.log("This script will deploy:\n");
  console.log("1. ShariaCompliance & RemoteSwapInitiator (via deploy-core)");
  console.log("2. ShariaSwap");
  console.log("3. ShariaDCA\n");

  const network = process.env.HARDHAT_NETWORK || "moonbeam";
  console.log(`📡 Target Network: ${network}\n`);

  if (network === "moonbeam") {
    console.log("⚠️  WARNING: Deploying to MAINNET!");
    console.log("⚠️  This will cost real GLMR (~2 GLMR ≈ $0.40)");
    console.log("⚠️  Make sure you have sufficient balance\n");
  }

  runSubScript("Core Contracts (ShariaCompliance & RemoteSwapInitiator)", "deploy/deploy-core.ts", network);
  await deployShariaSwap(network);
  await deployShariaDCA(network);

  console.log("=".repeat(60));
  console.log("🎉 All deployments complete!");
  console.log("=".repeat(60));
  console.log("\n📝 Contract addresses saved to config/deployedContracts.json");
  console.log("\n💡 Next steps:");
  console.log("1. Verify contracts on Moonscan");
  console.log("2. Update Chopsticks config with deployment block");
  console.log("3. Test XCM flow on Chopsticks fork");
  console.log("\nSee MAINNET_DEPLOYMENT_CHECKLIST.md for details");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
