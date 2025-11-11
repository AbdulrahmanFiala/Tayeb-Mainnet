import { execSync } from "child_process";
import * as dotenv from "dotenv";

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

async function main() {
  console.log("🚀 Tayeb Mainnet Deployment\n");
  console.log("This script will deploy:\n");
  console.log("1. ShariaCompliance");
  console.log("2. CrosschainSwapInitiator");
  console.log("3. ShariaLocalSwap");
  console.log("4. ShariaDCA\n");

  const network = process.env.HARDHAT_NETWORK || "moonbeam";
  console.log(`📡 Target Network: ${network}\n`);

  if (network === "moonbeam") {
    console.log("⚠️  WARNING: Deploying to MAINNET!");
    console.log("⚠️  This will cost real GLMR (~2 GLMR ≈ $0.40)");
    console.log("⚠️  Make sure you have sufficient balance\n");
  }

  runSubScript("ShariaCompliance", "deploy/deploy-sharia-compliance.ts", network);
  runSubScript("CrosschainSwapInitiator", "deploy/deploy-crosschain-initiator.ts", network);
  runSubScript("ShariaLocalSwap", "deploy/deploy-sharia-local-swap.ts", network);
  runSubScript("ShariaDCA", "deploy/deploy-sharia-dca.ts", network);

  console.log("=".repeat(60));
  console.log("🎉 All deployments complete!");
  console.log("=".repeat(60));
  console.log("\n📝 Contract addresses saved to config/deployedContracts.json");
  console.log("\n💡 Next steps:");
  console.log("1. Verify contracts on Moonscan");
  console.log("2. Record deployment block and update internal runbooks");
  console.log("3. Execute a small XCM swap on mainnet to validate the flow");
  console.log("\nSee MAINNET_DEPLOYMENT_CHECKLIST.md for details");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
