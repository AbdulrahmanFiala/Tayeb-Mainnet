import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { DeployedContracts } from "../../config/types";

const { ethers } = hre;

/**
 * Interactive script to initiate a remote swap from Moonbeam to Hydration.
 * Monitors XCM message status and provides troubleshooting guidance.
 */

interface XcmConfig {
  hydration: {
    assetRegistry: Record<string, number>;
  };
}

/**
 * Load deployed contracts
 */
function loadDeployedContracts(): DeployedContracts {
  const configPath = path.join(__dirname, "../../config/deployedContracts.json");
  if (!fs.existsSync(configPath)) {
    throw new Error("No deployed contracts found. Deploy CrosschainSwapInitiator first.");
  }
  const configData = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(configData);
}

/**
 * Load XCM config
 */
function loadXcmConfig(): XcmConfig {
  const configPath = path.join(__dirname, "../../config/xcmConfig.json");
  const configData = fs.readFileSync(configPath, "utf-8");
  return JSON.parse(configData);
}

/**
 * Create readline interface for user input
 */
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompt user for input
 */
function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

/**
 * Display available assets
 */
function displayAvailableAssets(xcmConfig: XcmConfig) {
  console.log("\n📋 Available Assets on Hydration:");
  const assets = xcmConfig.hydration.assetRegistry;
  Object.entries(assets).forEach(([symbol, id]) => {
    console.log(`   ${symbol.padEnd(8)} (ID: ${id})`);
  });
  console.log("");
}

/**
 * Monitor swap status
 */
async function monitorSwapStatus(
  crosschainSwapInitiator: any,
  swapId: string,
  maxAttempts: number = 60
) {
  console.log("\n🔍 Monitoring swap status...");
  console.log(`   Swap ID: ${swapId}`);
  
  for (let i = 0; i < maxAttempts; i++) {
    const swap = await crosschainSwapInitiator.getSwap(swapId);
    const status = Number(swap.status);
    
    const statusNames = ["Pending", "Initiated", "Completed", "Failed", "Cancelled"];
    console.log(`   [${i + 1}/${maxAttempts}] Status: ${statusNames[status]}`);
    
    if (status === 2) { // Completed
      console.log("\n✅ Swap completed successfully!");
      console.log(`   User: ${swap.user}`);
      console.log(`   Source Token: ${swap.sourceToken}`);
      console.log(`   Target Token: ${swap.targetToken}`);
      console.log(`   Source Amount: ${ethers.formatUnits(swap.sourceAmount, 18)}`);
      return true;
    }
    
    if (status === 3) { // Failed
      console.log("\n❌ Swap failed!");
      return false;
    }
    
    if (status === 4) { // Cancelled
      console.log("\n⚠️  Swap cancelled");
      return false;
    }
    
    // Wait 5 seconds before next check
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  
  console.log("\n⏱️  Monitoring timeout. Check status manually:");
  console.log(`   await crosschainSwapInitiator.getSwap("${swapId}")`);
  return false;
}

/**
 * Display XCM troubleshooting tips
 */
function displayTroubleshootingTips() {
  console.log("\n🔧 Troubleshooting Tips:");
  console.log("   1. Check HRMP channel status:");
  console.log("      - Visit Polkadot.js Apps → Network → Parachains → HRMP");
  console.log("      - Verify Moonbeam ↔ Hydration channel exists");
  console.log("");
  console.log("   2. Check XCM message on Subscan:");
  console.log("      - Moonbeam: https://moonscan.io/");
  console.log("      - Hydration: https://hydration.subscan.io/");
  console.log("");
  console.log("   3. Verify sovereign account has funds:");
  console.log("      - Moonbeam's sovereign account on Hydration must have HDX for fees");
  console.log("");
  console.log("   4. Check asset registration:");
  console.log("      - Assets must be registered as XC-20s on both chains");
  console.log("");
  console.log("   5. Verify XCM version compatibility:");
  console.log("      - Both chains must support XCM v3");
}

async function main() {
  console.log("\n🌉 Crosschain Swap Initiator - Moonbeam → Hydration\n");

  // Load configurations
  const deployedContracts = loadDeployedContracts();
  const xcmConfig = loadXcmConfig();

  if (!deployedContracts.main?.crosschainSwapInitiator) {
    throw new Error("CrosschainSwapInitiator not deployed. Run deploy-core.ts first.");
  }

  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`👤 User: ${signer.address}`);

  const balance = await ethers.provider.getBalance(signer.address);
  console.log(`   Balance: ${ethers.formatEther(balance)} DEV`);

  // Get contract instances
  const crosschainSwapInitiator = await ethers.getContractAt(
    "CrosschainSwapInitiator",
    deployedContracts.main.crosschainSwapInitiator!
  );

  const shariaCompliance = await ethers.getContractAt(
    "ShariaCompliance",
    deployedContracts.main.shariaCompliance!
  );

  console.log(`\n📍 CrosschainSwapInitiator: ${deployedContracts.main.crosschainSwapInitiator}`);

  // Display available assets
  displayAvailableAssets(xcmConfig);

  // Interactive mode
  const rl = createReadlineInterface();

  try {
    // Get source token
    const sourceTokenAddr = await prompt(rl, "Enter source token address (on Moonbeam): ");
    
    // Get target token
    const targetTokenAddr = await prompt(rl, "Enter target token address (on Hydration): ");
    
    // Validate Sharia compliance
    console.log("\n🔍 Validating Sharia compliance...");
    const targetSymbol = await shariaCompliance.getSymbolByAddress(targetTokenAddr);
    const isCompliant = await shariaCompliance.isShariaCompliant(targetSymbol);
    
    if (!isCompliant) {
      console.log(`❌ Target token ${targetSymbol} is not Sharia compliant!`);
      rl.close();
      return;
    }
    console.log(`✅ Target token ${targetSymbol} is Sharia compliant`);
    
    // Get amount
    const amountStr = await prompt(rl, "Enter amount to swap (in token units): ");
    const amount = ethers.parseEther(amountStr);
    
    // Get min output
    const minOutStr = await prompt(rl, "Enter minimum output amount: ");
    const minOut = ethers.parseEther(minOutStr);
    
    // Get deadline (default: 1 hour from now)
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    
    console.log("\n📋 Swap Details:");
    console.log(`   Source Token: ${sourceTokenAddr}`);
    console.log(`   Target Token: ${targetTokenAddr} (${targetSymbol})`);
    console.log(`   Amount: ${amountStr}`);
    console.log(`   Min Output: ${minOutStr}`);
    console.log(`   Deadline: ${new Date(deadline * 1000).toLocaleString()}`);
    
    const confirm = await prompt(rl, "\nProceed with swap? (yes/no): ");
    if (confirm.toLowerCase() !== "yes") {
      console.log("❌ Swap cancelled");
      rl.close();
      return;
    }
    
    // Approve tokens
    console.log("\n📝 Approving tokens...");
    const sourceToken = await ethers.getContractAt("IERC20", sourceTokenAddr);
    const approveTx = await sourceToken.approve(deployedContracts.main.crosschainSwapInitiator!, amount);
    await approveTx.wait();
    console.log("✅ Tokens approved");
    
    // Initiate swap
    console.log("\n🚀 Initiating remote swap...");
    const tx = await crosschainSwapInitiator.initiateRemoteSwap(
      sourceTokenAddr,
      targetTokenAddr,
      amount,
      minOut,
      deadline
    );
    
    console.log(`   Transaction hash: ${tx.hash}`);
    console.log("   Waiting for confirmation...");
    
    const receipt = await tx.wait();
    if (!receipt) {
      throw new Error("Remote swap transaction failed to produce a receipt");
    }
    console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`);
    
    // Parse events to get swap ID
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = crosschainSwapInitiator.interface.parseLog(log);
        return parsed?.name === "RemoteSwapInitiated";
      } catch {
        return false;
      }
    });
    
    if (event) {
      const parsed = crosschainSwapInitiator.interface.parseLog(event);
      const swapId = parsed?.args[0];
      
      console.log(`\n✅ Remote swap initiated!`);
      console.log(`   Swap ID: ${swapId}`);
      console.log(`   XCM Message Hash: ${parsed?.args[6]}`);
      
      // Monitor status
      const monitorChoice = await prompt(rl, "\nMonitor swap status? (yes/no): ");
      if (monitorChoice.toLowerCase() === "yes") {
        await monitorSwapStatus(crosschainSwapInitiator, swapId);
      }
    }
    
    // Display troubleshooting tips
    displayTroubleshootingTips();
    
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    displayTroubleshootingTips();
  } finally {
    rl.close();
  }
  
  console.log("\n✅ Done!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });



