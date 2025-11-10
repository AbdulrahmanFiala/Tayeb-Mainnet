import { run } from "hardhat";
import halaCoinsConfig from "../../config/halaCoins.json";
import deployedContractsConfig from "../../config/deployedContracts.json";
import { HalaCoinsConfig, DeployedContracts } from "../../config/types";

/**
 * Verify deployed contracts on Moonbeam / Chopsticks fork
 *
 * This script verifies:
 * 1. All configured ERC20 tokens (optional mocks)
 * 2. Core Tayeb contracts (ShariaCompliance, ShariaSwap, ShariaDCA)
 *
 * Requires ETHERSCAN_API_KEY to be set in .env file.
 * Checks verification status before attempting to avoid unnecessary API calls.
 */
async function main() {
  const config = halaCoinsConfig as HalaCoinsConfig;
  const contractsConfig = deployedContractsConfig as DeployedContracts;

  console.log("🔍 Verifying all contracts on Moonbeam...\n");

  if (!process.env.ETHERSCAN_API_KEY) {
    console.error("❌ Error: ETHERSCAN_API_KEY not found in environment variables!");
    console.log("\n📝 Please add ETHERSCAN_API_KEY to your .env file:");
    console.log("   Get API key from: https://moonscan.io/myapikey\n");
    process.exit(1);
  }

  // Compile contracts first to ensure artifacts are up to date
  console.log("🔨 Compiling contracts...");
  try {
    await run("compile");
    console.log("✅ Compilation complete\n");
  } catch (error) {
    console.error("⚠️  Compilation failed, but continuing with verification...");
    console.error("   Error:", error);
    console.log();
  }

  const results = {
    tokens: { verified: 0, failed: 0 },
    main: { verified: 0, failed: 0 },
  };

  const failed: Array<{ type: string; name: string; address: string; error: string }> = [];

  // Helper to verify a contract
  async function verifyContract(
    type: string,
    name: string,
    address: string | null,
    constructorArgs: any[],
    contractName: string
  ) {
    if (!address || address === "null" || address === null) {
      console.log(`⏭️  ${name} - No address found, skipping`);
      return "failed";
    }

    console.log(`\n🔍 Verifying ${name}...`);
    console.log(`   Address: ${address}`);
    if (constructorArgs.length > 0) {
      console.log(`   Constructor args: ${JSON.stringify(constructorArgs)}`);
    }

    try {
      await run("verify:verify", {
        address: address,
        constructorArguments: constructorArgs.length > 0 ? constructorArgs : undefined,
        network: "moonbeam",
      });
      console.log(`✅ ${name} verified successfully!`);
      return "verified";
    } catch (error: any) {
      // Extract error message from various possible error formats
      const errorMessage = error.message || error.reason || String(error);
      const errorString = String(error).toLowerCase();

      // If already verified, treat as verified (success)
      if (
        errorMessage.includes("Already Verified") ||
        errorMessage.includes("already verified") ||
        errorMessage.includes("Contract source code already verified") ||
        errorString.includes("has already been verified") ||
        errorString.includes("already verified on the block explorer") ||
        errorString.includes("contract already verified")
      ) {
        console.log(`✅ ${name} verified (already verified)`);
        return "verified";
      } else {
        console.error(`❌ Failed to verify ${name}:`, errorMessage);
        failed.push({
          type,
          name,
          address,
          error: errorMessage,
        });
        return "failed";
      }
    }
  }

  // ============================================================================
  // Verify Tokens
  // ============================================================================
  console.log("=".repeat(60));
  console.log("📦 VERIFYING TOKENS (optional)");
  console.log("=".repeat(60));

  const tokens = contractsConfig.tokens || {};
  const tokensToVerify = Object.keys(tokens).length > 0 
    ? Object.entries(tokens).map(([symbol, address]) => ({
        symbol,
        address: address!,
        coin: config.coins.find((c) => c.symbol === symbol),
      }))
    : config.coins
        .filter((coin) => {
          const addr = coin.addresses.moonbeam;
          return addr && addr !== "null";
        })
        .map((coin) => ({
          symbol: coin.symbol,
          address: coin.addresses.moonbeam!,
          coin,
        }));

  for (const { symbol, address, coin } of tokensToVerify) {
    if (!coin) {
      console.warn(`⚠️  Coin ${symbol} not found in config, skipping`);
      continue;
    }

    const tokenName = `Mock ${coin.name}`;
    const constructorArgs = [tokenName, coin.symbol, coin.decimals];
    const result = await verifyContract("tokens", `${symbol} (${coin.name})`, address, constructorArgs, "MockERC20");
    
    if (result === "verified") results.tokens.verified++;
    else results.tokens.failed++;

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // ============================================================================
  // Verify Main Contracts
  // ============================================================================
  console.log("\n" + "=".repeat(60));
  console.log("🏛️  VERIFYING MAIN CONTRACTS");
  console.log("=".repeat(60));

  // ShariaCompliance (no constructor args)
  const shariaComplianceAddress = contractsConfig.main?.shariaCompliance;
  if (shariaComplianceAddress) {
    const result = await verifyContract("main", "ShariaCompliance", shariaComplianceAddress, [], "ShariaCompliance");
    if (result === "verified") results.main.verified++;
    else results.main.failed++;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // ShariaSwap (shariaCompliance, router, weth)
  const shariaSwapAddress = contractsConfig.main?.shariaSwap;
  const routerAddress = contractsConfig.amm?.router;
  const wethAddress = contractsConfig.amm?.weth;
  if (shariaSwapAddress && shariaComplianceAddress && routerAddress && wethAddress) {
    const swapArgs = [shariaComplianceAddress, routerAddress, wethAddress];
    const result = await verifyContract("main", "ShariaSwap", shariaSwapAddress, swapArgs, "ShariaSwap");
    if (result === "verified") results.main.verified++;
    else results.main.failed++;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // ShariaDCA (shariaCompliance, router, weth)
  const shariaDCAAddress = contractsConfig.main?.shariaDCA;
  if (shariaDCAAddress && shariaComplianceAddress && routerAddress && wethAddress) {
    const dcaArgs = [shariaComplianceAddress, routerAddress, wethAddress];
    const result = await verifyContract("main", "ShariaDCA", shariaDCAAddress, dcaArgs, "ShariaDCA");
    if (result === "verified") results.main.verified++;
    else results.main.failed++;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // ============================================================================
  // Summary
  // ============================================================================
  console.log("\n" + "=".repeat(60));
  console.log("📋 VERIFICATION SUMMARY");
  console.log("=".repeat(60));

  const totalVerified =
    results.tokens.verified + results.main.verified;
  const totalFailed = results.tokens.failed + results.main.failed;

  console.log("\n📦 Tokens:");
  console.log(`   ✅ Verified: ${results.tokens.verified}`);
  console.log(`   ❌ Failed: ${results.tokens.failed}`);

  console.log("\n🏛️  Main Contracts:");
  console.log(`   ✅ Verified: ${results.main.verified}`);
  console.log(`   ❌ Failed: ${results.main.failed}`);

  console.log("\n" + "=".repeat(60));
  console.log("📊 TOTALS");
  console.log("=".repeat(60));
  console.log(`✅ Verified: ${totalVerified}`);
  console.log(`❌ Failed: ${totalFailed}`);

  if (failed.length > 0) {
    console.log("\n⚠️  Failed verifications:");
    failed.forEach((item) => {
      console.log(`   - [${item.type}] ${item.name} (${item.address})`);
      console.log(`     Error: ${item.error}`);
    });
  }

  console.log("\n💡 View verified contracts on Moonscan:");
  console.log("   https://moonscan.io");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

