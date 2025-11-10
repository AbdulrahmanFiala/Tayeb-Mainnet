import { execSync } from "child_process";

/**
 * Mainnet Deployment Script
 * 
 * Deploys the core Tayeb contracts for Sharia-compliant cross-chain swaps:
 * 1. ShariaCompliance - Validates halal/haram assets
 * 2. RemoteSwapInitiator - XCM bridge to Hydration Omnipool
 * 
 * For mainnet deployment, use: --network moonbeam
 * For Moonbeam mainnet or a Chopsticks fork, use: --network moonbeam
 */
async function main() {
  console.log("🚀 Tayeb Mainnet Deployment\n");
  console.log("This script will deploy:\n");
  console.log("1. ShariaCompliance Contract");
  console.log("2. RemoteSwapInitiator Contract (XCM Bridge)\n");

  const network = process.env.HARDHAT_NETWORK || "moonbeam";
  console.log(`📡 Target Network: ${network}\n`);

  if (network === "moonbeam") {
    console.log("⚠️  WARNING: Deploying to MAINNET!");
    console.log("⚠️  This will cost real GLMR (~2 GLMR ≈ $0.40)");
    console.log("⚠️  Make sure you have sufficient balance\n");
  }

  const scripts = [
    {
      name: "Core Contracts (ShariaCompliance)",
      script: "deploy/deploy-core.ts",
      timeout: 120000
    },
    { 
      name: "XCM Bridge (RemoteSwapInitiator)", 
      script: "xcm/deploy-remote-swap.ts", 
      timeout: 120000 
    },
  ];

  for (const { name, script, timeout } of scripts) {
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
