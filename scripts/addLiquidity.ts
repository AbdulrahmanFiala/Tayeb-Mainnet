import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import halaCoinsConfig from "../config/halaCoins.json";
import deployedContractsConfig from "../config/deployedContracts.json";
import { HalaCoinsConfig, getNonStablecoins, getCoinBySymbol, DeployedContracts } from "../config/types";

/**
 * Add liquidity to AMM pairs for all Initial Hala Coins
 * Usage: npx hardhat run scripts/addLiquidity.ts --network moonbase
 * 
 * Reads addresses from config JSON files
 * Adds liquidity to all token/USDC pairs
 */
async function main() {
  dotenv.config();
  const config = halaCoinsConfig as HalaCoinsConfig;
  const contractsConfig = deployedContractsConfig as DeployedContracts;

  const [deployer] = await ethers.getSigners();
  
  console.log("💧 Adding Liquidity to All AMM Pairs\n");
  console.log("Account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "DEV\n");

  // ============================================================================
  // Read addresses from JSON configs
  // ============================================================================
  
  const ROUTER_ADDRESS = contractsConfig.amm.router;
  const USDC_COIN = config.coins.find(c => c.symbol === "USDC");
  const USDC_ADDRESS = USDC_COIN?.addresses.moonbase;

  if (!ROUTER_ADDRESS || !USDC_ADDRESS) {
    console.error("❌ Error: AMM addresses not found in config files!");
    console.log("\n📝 Please run deploy-amm-core.ts first:");
    console.log("   npx hardhat run scripts/deploy-amm-core.ts --network moonbase\n");
    process.exit(1);
  }

  // Get non-stablecoin Hala Coins from config
  const nonStablecoins = getNonStablecoins(config);
  const USDT_COIN = config.coins.find(c => c.symbol === "USDT");
  const USDT_ADDRESS = USDT_COIN?.addresses.moonbase;
  
  console.log("📖 Reading addresses from config files...");
  console.log(`📊 Total pairs to add liquidity: ${nonStablecoins.length + 1} (USDC pairs + USDC/USDT)`);
  console.log("   Router:", ROUTER_ADDRESS);
  console.log("   USDC:", USDC_ADDRESS);
  if (USDT_ADDRESS) {
    console.log("   USDT:", USDT_ADDRESS);
  }
  console.log();

  // ============================================================================
  // LIQUIDITY AMOUNTS
  // ============================================================================
  
  // Stablecoin amounts (6 decimals)
  // Need at least sqrt(MIN_LIQUIDITY^2 + MIN_LIQUIDITY) = ~1001 tokens to mint > 0 LP tokens
  // Using 10000 to ensure enough liquidity is minted
  const stablecoinAmount = ethers.parseUnits("10000", 6); // 10000 USDC per pair
  
  // Token amounts (varies by decimals - from config)
  const tokenAmounts: { [key: string]: bigint } = {};
  for (const coin of nonStablecoins) {
    // Need at least sqrt(MIN_LIQUIDITY^2 + MIN_LIQUIDITY) = ~1001 tokens to mint > 0 LP tokens
    // Using 10000 to ensure enough liquidity is minted
    tokenAmounts[coin.symbol] = ethers.parseUnits("10000", coin.decimals); // 10000 tokens per pair
  }

  const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes

  // ============================================================================
  // GET CONTRACT INSTANCES
  // ============================================================================
  
  const router = await ethers.getContractAt("SimpleRouter", ROUTER_ADDRESS);
  const factory = await ethers.getContractAt("SimpleFactory", contractsConfig.amm.factory);
  const usdc = await ethers.getContractAt("MockERC20", USDC_ADDRESS);
  const usdt = USDT_ADDRESS ? await ethers.getContractAt("MockERC20", USDT_ADDRESS) : null;

  console.log("✅ Connected to contracts");
  
  // Verify pairs exist
  console.log("🔍 Verifying pairs exist...");
  let missingPairs: string[] = [];
  
  // Check USDC/USDT pair
  if (USDT_ADDRESS) {
    const pairUSDCUSDT = await factory.getPair(USDC_ADDRESS, USDT_ADDRESS);
    if (!pairUSDCUSDT || pairUSDCUSDT === ethers.ZeroAddress) {
      missingPairs.push("USDC/USDT");
    }
  }
  
  // Check token/USDC pairs
  for (const coin of nonStablecoins) {
    const tokenAddress = coin.addresses.moonbase;
    if (!tokenAddress) continue;
    
    const pairUSDC = await factory.getPair(tokenAddress, USDC_ADDRESS);
    
    if (!pairUSDC || pairUSDC === ethers.ZeroAddress) {
      missingPairs.push(`${coin.symbol}/USDC`);
    }
  }
  
  if (missingPairs.length > 0) {
    console.error("\n❌ Error: Some pairs do not exist!");
    console.error("Missing pairs:", missingPairs.join(", "));
    console.error("\n📝 Please create pairs first:");
    console.error("   npm run deploy:pairs");
    console.error("   or");
    console.error("   npx hardhat run scripts/create-pairs.ts --network moonbase\n");
    process.exit(1);
  }
  
  console.log("✅ All pairs exist");
  console.log();

  // ============================================================================
  // APPROVE TOKENS
  // ============================================================================
  
  console.log("✅ Approving tokens...");
  
  // Calculate total amounts needed (non-stablecoins + USDC/USDT pair)
  const totalPairs = nonStablecoins.length + 1; // USDC pairs + USDC/USDT pair
  const totalUSDCNeeded = stablecoinAmount * BigInt(totalPairs);
  const totalUSDTNeeded = stablecoinAmount; // For USDC/USDT pair only
  
  // Approve USDT for USDC/USDT pair (if USDT exists)
  if (USDT_ADDRESS && usdt) {
    const usdtAllowance = await usdt.allowance(deployer.address, ROUTER_ADDRESS);
    if (usdtAllowance < totalUSDTNeeded) {
      let usdtApproved = false;
      let retries = 3;
      while (retries > 0 && !usdtApproved) {
        try {
          const usdtTx = await usdt.approve(ROUTER_ADDRESS, totalUSDTNeeded);
          await usdtTx.wait();
          console.log(`✅ Approved ${ethers.formatUnits(totalUSDTNeeded, 6)} USDT`);
          usdtApproved = true;
        } catch (error: any) {
          retries--;
          const errorMsg = error.message || error.toString();
          if (errorMsg.includes('already known') || errorMsg.includes('replacement transaction underpriced')) {
            if (retries > 0) {
              console.log(`⚠️  Nonce conflict for USDT, waiting and retrying... (${retries} attempts left)`);
              await new Promise(resolve => setTimeout(resolve, 3000));
            } else {
              const checkAllowance = await usdt.allowance(deployer.address, ROUTER_ADDRESS);
              if (checkAllowance >= totalUSDTNeeded) {
                console.log(`✅ USDT approval succeeded (allowance: ${ethers.formatUnits(checkAllowance, 6)})`);
                usdtApproved = true;
              } else {
                console.error(`❌ Failed to approve USDT after retries`);
              }
            }
          } else {
            console.error(`❌ Failed to approve USDT:`, errorMsg);
            retries = 0;
          }
        }
      }
    } else {
      console.log(`⏭️  USDT already approved (${ethers.formatUnits(usdtAllowance, 6)})`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500)); // Delay between approvals
  }
  
  // Approve USDC (check existing approvals first, with retry logic)
  const usdcAllowance = await usdc.allowance(deployer.address, ROUTER_ADDRESS);
  if (usdcAllowance < totalUSDCNeeded) {
    let usdcApproved = false;
    let retries = 3;
    while (retries > 0 && !usdcApproved) {
      try {
        const usdcTx = await usdc.approve(ROUTER_ADDRESS, totalUSDCNeeded);
        await usdcTx.wait();
        console.log(`✅ Approved ${ethers.formatUnits(totalUSDCNeeded, 6)} USDC`);
        usdcApproved = true;
      } catch (error: any) {
        retries--;
        const errorMsg = error.message || error.toString();
        if (errorMsg.includes('already known') || errorMsg.includes('replacement transaction underpriced')) {
          if (retries > 0) {
            console.log(`⚠️  Nonce conflict for USDC, waiting and retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else {
            // Check if approval actually went through
            const checkAllowance = await usdc.allowance(deployer.address, ROUTER_ADDRESS);
            if (checkAllowance >= totalUSDCNeeded) {
              console.log(`✅ USDC approval succeeded (allowance: ${ethers.formatUnits(checkAllowance, 6)})`);
              usdcApproved = true;
            } else {
              console.error(`❌ Failed to approve USDC after retries`);
            }
          }
        } else {
          console.error(`❌ Failed to approve USDC:`, errorMsg);
          retries = 0;
        }
      }
    }
  } else {
    console.log(`⏭️  USDC already approved (${ethers.formatUnits(usdcAllowance, 6)})`);
  }

  // Approve each Hala Coin (check existing approvals first to avoid unnecessary transactions)
  const tokenApprovals: { [key: string]: bigint } = {};
  for (const coin of nonStablecoins) {
    const tokenAddress = coin.addresses.moonbase;
    if (!tokenAddress) {
      console.warn(`⚠️  Warning: ${coin.symbol} address not found in config, skipping...`);
      continue;
    }
    
    const token = await ethers.getContractAt("MockERC20", tokenAddress);
    const amountNeeded = tokenAmounts[coin.symbol]; // For USDC pair only
    tokenApprovals[coin.symbol] = amountNeeded;
    
    // Check if approval already exists
    const currentAllowance = await token.allowance(deployer.address, ROUTER_ADDRESS);
    if (currentAllowance >= amountNeeded) {
      console.log(`⏭️  ${coin.symbol} already approved (${ethers.formatUnits(currentAllowance, coin.decimals)})`);
      // Small delay even for skipped approvals to avoid nonce issues
      await new Promise(resolve => setTimeout(resolve, 200));
      continue;
    }
    
    // Retry logic for network issues and nonce conflicts
    let retries = 3;
    let approved = false;
    while (retries > 0 && !approved) {
      try {
        const tx = await token.approve(ROUTER_ADDRESS, amountNeeded);
        await tx.wait(); // Wait for each approval to complete
        console.log(`✅ Approved ${coin.symbol}`);
        approved = true;
      } catch (error: any) {
        retries--;
        const errorMsg = error.message || error.toString();
        
        // Handle "already known" nonce conflicts - wait and retry
        if (errorMsg.includes('already known') || errorMsg.includes('replacement transaction underpriced')) {
          if (retries > 0) {
            console.log(`⚠️  Nonce conflict for ${coin.symbol}, waiting and retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds for nonce to update
          } else {
            // Check if approval actually went through despite the error
            const checkAllowance = await token.allowance(deployer.address, ROUTER_ADDRESS);
            if (checkAllowance >= amountNeeded) {
              console.log(`✅ ${coin.symbol} approval succeeded (allowance: ${ethers.formatUnits(checkAllowance, coin.decimals)})`);
              approved = true;
            } else {
              console.error(`❌ Failed to approve ${coin.symbol} after retries`);
            }
          }
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH' || errorMsg.includes('timeout')) {
          if (retries > 0) {
            console.log(`⚠️  Network timeout approving ${coin.symbol}, retrying... (${retries} attempts left)`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
          } else {
            console.error(`❌ Failed to approve ${coin.symbol} after retries:`, errorMsg);
          }
        } else {
          console.error(`❌ Failed to approve ${coin.symbol}:`, errorMsg);
          retries = 0; // Don't retry for other errors
        }
      }
    }
    
    // Small delay to avoid nonce conflicts
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.log();

  // ============================================================================
  // ADD LIQUIDITY TO ALL PAIRS
  // ============================================================================
  
  console.log("💧 Adding liquidity to all pairs...");
  console.log("=".repeat(60));
  
  let successCount = 0;
  let failCount = 0;

  // First, add liquidity to USDC/USDT pair
  if (USDT_ADDRESS && usdt) {
    try {
      console.log(`\n💧 Adding liquidity to USDC/USDT pair...`);
      
      // Check balances
      const usdcBalance = await usdc.balanceOf(deployer.address);
      const usdtBalance = await usdt.balanceOf(deployer.address);
      
      console.log(`   USDC balance: ${ethers.formatUnits(usdcBalance, 6)} (need: ${ethers.formatUnits(stablecoinAmount, 6)})`);
      console.log(`   USDT balance: ${ethers.formatUnits(usdtBalance, 6)} (need: ${ethers.formatUnits(stablecoinAmount, 6)})`);
      
      if (usdcBalance < stablecoinAmount) {
        console.error(`❌ Insufficient USDC balance: ${ethers.formatUnits(usdcBalance, 6)} < ${ethers.formatUnits(stablecoinAmount, 6)}`);
        console.error(`   💡 Run: npm run deploy:mint`);
        failCount++;
      } else if (usdtBalance < stablecoinAmount) {
        console.error(`❌ Insufficient USDT balance: ${ethers.formatUnits(usdtBalance, 6)} < ${ethers.formatUnits(stablecoinAmount, 6)}`);
        console.error(`   💡 Run: npm run deploy:mint`);
        failCount++;
      } else {
        // Check approvals
        const usdcAllowance = await usdc.allowance(deployer.address, ROUTER_ADDRESS);
        const usdtAllowance = await usdt.allowance(deployer.address, ROUTER_ADDRESS);
        
        if (usdcAllowance < stablecoinAmount) {
          const approveTx = await usdc.approve(ROUTER_ADDRESS, stablecoinAmount * BigInt(2));
          await approveTx.wait();
        }
        
        if (usdtAllowance < stablecoinAmount) {
          const approveTx = await usdt.approve(ROUTER_ADDRESS, stablecoinAmount * BigInt(2));
          await approveTx.wait();
        }
        
        const tx = await router.addLiquidity(
          USDC_ADDRESS,
          USDT_ADDRESS,
          stablecoinAmount,
          stablecoinAmount,
          0,
          0,
          deployer.address,
          deadline
        );
        await tx.wait();
        console.log(`✅ Added USDC/USDT liquidity`);
        successCount++;
      }
    } catch (error: any) {
      let errorMsg = "Unknown error";
      if (error.reason) {
        errorMsg = error.reason;
      } else if (error.data) {
        try {
          const decodedError = router.interface.parseError(error.data);
          if (decodedError) {
            errorMsg = `${decodedError.name}(${decodedError.args.join(', ')})`;
          } else {
            errorMsg = error.data;
          }
        } catch {
          errorMsg = error.data;
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      console.error(`❌ Failed to add USDC/USDT liquidity:`, errorMsg);
      failCount++;
    }
  }

  // Then add liquidity to token/USDC pairs
  for (const coin of nonStablecoins) {
    const tokenAddress = coin.addresses.moonbase;
    if (!tokenAddress) {
      console.warn(`⚠️  Skipping ${coin.symbol} - address not found in config`);
      failCount++;
      continue;
    }

    const tokenAmount = tokenAmounts[coin.symbol];
    const token = await ethers.getContractAt("MockERC20", tokenAddress);

    // Add liquidity to USDC pair only
    try {
      console.log(`💧 Adding liquidity to ${coin.symbol}/USDC pair...`);
      
      // Check balances
      const tokenBalance = await token.balanceOf(deployer.address);
      const usdcBalance = await usdc.balanceOf(deployer.address);
      
      console.log(`   ${coin.symbol} balance: ${ethers.formatUnits(tokenBalance, coin.decimals)} (need: ${ethers.formatUnits(tokenAmount, coin.decimals)})`);
      console.log(`   USDC balance: ${ethers.formatUnits(usdcBalance, 6)} (need: ${ethers.formatUnits(stablecoinAmount, 6)})`);
      
      if (tokenBalance < tokenAmount) {
        console.error(`❌ Insufficient ${coin.symbol} balance: ${ethers.formatUnits(tokenBalance, coin.decimals)} < ${ethers.formatUnits(tokenAmount, coin.decimals)}`);
        console.error(`   💡 Run: npm run deploy:mint`);
        failCount++;
        continue;
      }
      if (usdcBalance < stablecoinAmount) {
        console.error(`❌ Insufficient USDC balance: ${ethers.formatUnits(usdcBalance, 6)} < ${ethers.formatUnits(stablecoinAmount, 6)}`);
        console.error(`   💡 Run: npm run deploy:mint`);
        failCount++;
        continue;
      }
      
      // Re-check and top up allowances if needed (they get consumed after first use)
      const tokenAllowanceNow = await token.allowance(deployer.address, ROUTER_ADDRESS);
      if (tokenAllowanceNow < tokenAmount) {
        const approveTx = await token.approve(ROUTER_ADDRESS, tokenAmount * BigInt(2));
        await approveTx.wait();
      }
      
      const usdcAllowanceNow = await usdc.allowance(deployer.address, ROUTER_ADDRESS);
      if (usdcAllowanceNow < stablecoinAmount) {
        const approveTx = await usdc.approve(ROUTER_ADDRESS, stablecoinAmount * BigInt(10));
        await approveTx.wait();
      }
      
      const tx = await router.addLiquidity(
        tokenAddress,
        USDC_ADDRESS,
        tokenAmount,
        stablecoinAmount,
        0, // Accept any amount (for initial liquidity)
        0,
        deployer.address,
        deadline
      );
      await tx.wait();
      console.log(`✅ Added ${coin.symbol}/USDC liquidity`);
      successCount++;
    } catch (error: any) {
      let errorMsg = "Unknown error";
      
      // Try to extract detailed error information
      let decodedError = null;
      if (error.reason) {
        errorMsg = error.reason;
      } else if (error.data) {
        // Try to decode custom error from router
        try {
          decodedError = router.interface.parseError(error.data);
          if (decodedError) {
            errorMsg = `${decodedError.name}(${decodedError.args.join(', ')})`;
          } else {
            // Try to decode from pair
            const pairAddress = await factory.getPair(tokenAddress, USDC_ADDRESS);
            if (pairAddress && pairAddress !== ethers.ZeroAddress) {
              const pair = await ethers.getContractAt("SimplePair", pairAddress);
              decodedError = pair.interface.parseError(error.data);
              if (decodedError) {
                errorMsg = `${decodedError.name}(${decodedError.args.join(', ')})`;
              }
            }
          }
        } catch {
          errorMsg = error.data;
        }
        if (!decodedError) {
          errorMsg = error.data;
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      console.error(`❌ Failed to add ${coin.symbol}/USDC liquidity:`, errorMsg);
      
      // Provide helpful hints based on error type
      if (errorMsg.includes("InvalidPath") || errorMsg.includes("pair") || errorMsg.includes("Pair")) {
        console.error(`   💡 Pair may not exist. Run: npm run deploy:pairs`);
      } else if (errorMsg.includes("InsufficientLiquidityMinted") || errorMsg.includes("0xd226f9d4")) {
        console.error(`   💡 Liquidity too low. Need more than 1000 tokens per side.`);
        console.error(`   💡 Current: 10000 per side should work. Check if amounts are correct.`);
      } else if (errorMsg.includes("Insufficient") || errorMsg.includes("balance")) {
        console.error(`   💡 Check token balances. Run: npm run deploy:mint`);
      } else if (errorMsg.includes("allowance") || errorMsg.includes("approve")) {
        console.error(`   💡 Token approval may have failed`);
      }
      
      failCount++;
    }
  }

  console.log();
  console.log("=".repeat(60));
  console.log("🎉 LIQUIDITY ADDITION COMPLETE!");
  console.log("=".repeat(60));
  console.log(`✅ Successfully added: ${successCount} pairs`);
  if (failCount > 0) {
    console.log(`❌ Failed: ${failCount} pairs`);
  }
  console.log();
  console.log("💡 All Initial Hala Coins now have liquidity pools with USDC");
  console.log("💡 You can now test swaps through the ShariaSwap contract");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
