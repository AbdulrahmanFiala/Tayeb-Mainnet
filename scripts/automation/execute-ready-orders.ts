import hre from "hardhat";
import * as dotenv from "dotenv";
import deployedContracts from "../../config/deployedContracts.json";

dotenv.config();

const { ethers } = hre;

/**
 * Helper function to check if a specific order is ready for execution
 */
async function isOrderReady(shariaDCA: any, orderId: bigint): Promise<boolean> {
  try {
    const order = await shariaDCA.getDCAOrder(orderId);
    const currentTime = Math.floor(Date.now() / 1000);
    
    return (
      order.exists &&
      order.isActive &&
      currentTime >= Number(order.nextExecutionTime) &&
      order.intervalsCompleted < order.totalIntervals
    );
  } catch {
    return false;
  }
}

/**
 * One-time execution script for ready DCA orders
 * Useful for cron jobs, GitHub Actions, or manual execution
 * Automatically catches up on multiple missed intervals per order
 */
async function main() {
  const startTime = Date.now();
  const maxCatchUpPerOrder = 10; // Prevent infinite loops
  
  const shariaDCAAddress = deployedContracts.main.shariaDCA;
  if (!shariaDCAAddress) {
    throw new Error(
      "ShariaDCA address not found in config/deployedContracts.json. Deploy the contract first."
    );
  }

  const shariaDCA = await ethers.getContractAt("ShariaDCA", shariaDCAAddress);

  console.log("🔍 Checking for ready DCA orders...");
  console.log("Contract:", shariaDCAAddress);
  console.log("Max catch-up per order:", maxCatchUpPerOrder);
  console.log();

  try {
    const [upkeepNeeded, performData] = await shariaDCA.checkUpkeep("0x");
    
    if (!upkeepNeeded) {
      console.log("✅ No orders ready for execution");
      process.exit(0);
    }

    const orderIds = ethers.AbiCoder.defaultAbiCoder().decode(
      ["uint256[]"],
      performData
    )[0];

    console.log(`✅ Found ${orderIds.length} order(s) ready for execution:\n`);
    orderIds.forEach((id: bigint) => console.log(`  - Order #${id}`));
    console.log();

    // Execute all ready orders with catch-up logic
    const results = [];
    let totalIntervalsCaughtUp = 0;
    
    for (const orderId of orderIds) {
      let catchUpCount = 0;
      let orderSuccess = true;
      let lastError = null;
      const orderStartTime = Date.now();
      
      console.log(`🔄 Processing Order #${orderId}...`);
      
      // Keep executing until order is no longer ready or max retries reached
      while (catchUpCount < maxCatchUpPerOrder) {
        try {
          // Check if order is still ready
          const isReady = await isOrderReady(shariaDCA, orderId);
          if (!isReady) {
            break;
          }
          
          const tx = await shariaDCA.executeDCAOrder(orderId);
          const receipt = await tx.wait();
          if (!receipt) {
            throw new Error("Transaction receipt unavailable");
          }
          catchUpCount++;
          totalIntervalsCaughtUp++;
          
          console.log(`   ✅ Interval ${catchUpCount} executed (tx: ${receipt.hash.slice(0, 10)}...)`);
          
        } catch (error: any) {
          console.error(`   ❌ Failed on interval ${catchUpCount + 1}: ${error.message}`);
          orderSuccess = false;
          lastError = error.message;
          break;
        }
      }
      
      const orderDuration = ((Date.now() - orderStartTime) / 1000).toFixed(1);
      
      // Log order completion
      if (catchUpCount === 0) {
        console.log(`   ⚠️  No intervals executed (order may not be ready)\n`);
      } else if (catchUpCount >= maxCatchUpPerOrder) {
        console.log(`   ⚠️  Max catch-up limit reached (${maxCatchUpPerOrder})`);
        console.log(`   📊 Caught up ${catchUpCount} intervals in ${orderDuration}s`);
        console.log(`   ⚠️  Order may have more intervals pending\n`);
      } else if (orderSuccess) {
        if (catchUpCount === 1) {
          console.log(`   ✅ Order executed (1 interval, ${orderDuration}s)\n`);
        } else {
          console.log(`   ✅ Order caught up (${catchUpCount} intervals, ${orderDuration}s)\n`);
        }
      } else {
        console.log(`   ❌ Order failed after ${catchUpCount} successful intervals\n`);
      }
      
      results.push({
        orderId: orderId.toString(),
        success: orderSuccess,
        intervalsCaughtUp: catchUpCount,
        duration: orderDuration,
        error: lastError,
        hitMaxLimit: catchUpCount >= maxCatchUpPerOrder
      });
    }

    // Summary
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    const successful = results.filter(r => r.success && r.intervalsCaughtUp > 0).length;
    const failed = results.filter(r => !r.success).length;
    const hitLimit = results.filter(r => r.hitMaxLimit).length;
    
    console.log("=".repeat(60));
    console.log("📊 Execution Summary:");
    console.log(`   Orders processed: ${orderIds.length}`);
    console.log(`   Successful: ${successful}`);
    console.log(`   Failed: ${failed}`);
    if (hitLimit > 0) {
      console.log(`   ⚠️  Hit catch-up limit: ${hitLimit}`);
    }
    console.log(`   Total intervals executed: ${totalIntervalsCaughtUp}`);
    console.log(`   Total duration: ${totalDuration}s`);
    console.log("=".repeat(60));

    // Detailed per-order results
    if (results.length > 1 || results.some(r => r.intervalsCaughtUp > 1)) {
      console.log("\n📋 Per-Order Details:");
      results.forEach(r => {
        const status = r.success ? "✅" : "❌";
        const limit = r.hitMaxLimit ? " (limit reached)" : "";
        console.log(`   ${status} Order #${r.orderId}: ${r.intervalsCaughtUp} interval(s) in ${r.duration}s${limit}`);
      });
    }

    // Exit with error code if any failed (useful for CI/CD)
    if (failed > 0) {
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ Fatal error:", error.message);
    if (error.reason) {
      console.error("   Reason:", error.reason);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Unhandled error:", error);
  process.exit(1);
});

