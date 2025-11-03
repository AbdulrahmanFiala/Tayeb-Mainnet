import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying Sharia-Compliant Platform to Moonbase Alpha (Testnet)...\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "DEV\n");

  // Moonbase Alpha testnet addresses
  // Convert to lowercase first, then getAddress() will compute proper EIP-55 checksum
  // Note: On Moonbase Alpha, native token is DEV, which wraps to WETH (ERC-20)
  // The contracts use WGLMR_ADDRESS as a variable name, but on testnet it's actually WETH wrapping DEV
  // For Moonbeam mainnet, use WGLMR: 0xAcc15dC74880C9944775448304B263D191c6077F
  const WGLMR_ADDRESS = ethers.getAddress("0xD909178CC99d318e4D46e7E66a972955859670E1".toLowerCase()); // Moonbase Alpha WETH (wraps DEV)
  const STELLASWAP_ROUTER = ethers.getAddress("0x8Ac868293D97761A1fED6d4A01E9FF17C5594Aa3".toLowerCase()); // StellaSwap Router on Moonbase Alpha

  console.log("Using Wrapped Native (WETH on testnet, WGLMR on mainnet):", WGLMR_ADDRESS);
  console.log("Using DEX Router:", STELLASWAP_ROUTER);
  console.log();

  // ============================================================================
  // Deploy ShariaCompliance
  // ============================================================================
  console.log("📝 Deploying ShariaCompliance...");
  const ShariaCompliance = await ethers.getContractFactory("ShariaCompliance");
  const shariaCompliance = await ShariaCompliance.deploy();
  await shariaCompliance.waitForDeployment();
  const shariaComplianceAddress = await shariaCompliance.getAddress();
  console.log("✅ ShariaCompliance deployed to:", shariaComplianceAddress);
  console.log();

  // ============================================================================
  // Deploy ShariaSwap
  // ============================================================================
  console.log("💱 Deploying ShariaSwap...");
  const ShariaSwap = await ethers.getContractFactory("ShariaSwap");
  const shariaSwap = await ShariaSwap.deploy(
    shariaComplianceAddress,
    STELLASWAP_ROUTER,
    WGLMR_ADDRESS
  );
  await shariaSwap.waitForDeployment();
  const shariaSwapAddress = await shariaSwap.getAddress();
  console.log("✅ ShariaSwap deployed to:", shariaSwapAddress);
  console.log();

  // ============================================================================
  // Deploy ShariaETF
  // ============================================================================
  console.log("📊 Deploying ShariaETF...");
  const ShariaETF = await ethers.getContractFactory("ShariaETF");
  const shariaETF = await ShariaETF.deploy(
    shariaComplianceAddress,
    STELLASWAP_ROUTER,
    WGLMR_ADDRESS
  );
  await shariaETF.waitForDeployment();
  const shariaETFAddress = await shariaETF.getAddress();
  console.log("✅ ShariaETF deployed to:", shariaETFAddress);
  console.log();

  // ============================================================================
  // Deploy ShariaDCA
  // ============================================================================
  console.log("📅 Deploying ShariaDCA...");
  const ShariaDCA = await ethers.getContractFactory("ShariaDCA");
  const shariaDCA = await ShariaDCA.deploy(
    shariaComplianceAddress,
    STELLASWAP_ROUTER,
    WGLMR_ADDRESS
  );
  await shariaDCA.waitForDeployment();
  const shariaDCAAddress = await shariaDCA.getAddress();
  console.log("✅ ShariaDCA deployed to:", shariaDCAAddress);
  console.log();

  // ============================================================================
  // Summary
  // ============================================================================
  console.log("=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("ShariaCompliance:", shariaComplianceAddress);
  console.log("ShariaSwap:      ", shariaSwapAddress);
  console.log("ShariaETF:       ", shariaETFAddress);
  console.log("ShariaDCA:       ", shariaDCAAddress);
  console.log("=".repeat(60));
  console.log();

  // ============================================================================
  // Post-deployment setup
  // ============================================================================
  console.log("⚙️  Setting up initial configuration...\n");

  // Register some example token addresses (Moonbase Alpha)
  // Note: These are example addresses, replace with actual Moonbase Alpha token addresses
  console.log("Registering token addresses...");
  
  // Register wrapped native token (WETH on testnet wraps DEV, WGLMR on mainnet wraps GLMR)
  const wrappedNativeSymbol = "DEV"; // On testnet, native is DEV. On mainnet, use "GLMR"
  await shariaSwap.registerAsset(WGLMR_ADDRESS, wrappedNativeSymbol);
  console.log(`✅ Registered ${wrappedNativeSymbol} (wrapped native) at ${WGLMR_ADDRESS}`);

  await shariaETF.registerTokenAddress(wrappedNativeSymbol, WGLMR_ADDRESS);
  console.log(`✅ Registered ${wrappedNativeSymbol} in ETF contract`);

  await shariaDCA.registerTokenAddress(wrappedNativeSymbol, WGLMR_ADDRESS);
  console.log(`✅ Registered ${wrappedNativeSymbol} in DCA contract`);

  console.log();
  console.log("=".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log();
  console.log("Next steps:");
  console.log("1. Register more Sharia-compliant tokens via registerShariaCoin()");
  console.log("2. Register token addresses in ShariaSwap, ShariaETF, and ShariaDCA");
  console.log("3. Create template ETFs via createTemplateETF()");
  console.log("4. Set up Chainlink Automation for ShariaDCA");
  console.log("5. Verify contracts on Moonscan (optional) - requires ETHERSCAN_API_KEY");
  console.log();
  console.log("Verification commands (requires Etherscan API V2 key):");
  console.log("Get API key from: https://etherscan.io/apidashboard");
  console.log(`npx hardhat verify --network moonbase ${shariaComplianceAddress}`);
  console.log(`npx hardhat verify --network moonbase ${shariaSwapAddress} ${shariaComplianceAddress} ${STELLASWAP_ROUTER} ${WGLMR_ADDRESS}`);
  console.log(`npx hardhat verify --network moonbase ${shariaETFAddress} ${shariaComplianceAddress} ${STELLASWAP_ROUTER} ${WGLMR_ADDRESS}`);
  console.log(`npx hardhat verify --network moonbase ${shariaDCAAddress} ${shariaComplianceAddress} ${STELLASWAP_ROUTER} ${WGLMR_ADDRESS}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

