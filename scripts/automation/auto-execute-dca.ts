import hre from "hardhat";
import * as dotenv from "dotenv";
import deployedContracts from "../../config/deployedContracts.json";

dotenv.config();

const { ethers } = hre;

async function main() {
  const shariaDCAAddress = deployedContracts.main.shariaDCA;
  if (!shariaDCAAddress) {
    throw new Error(
      "ShariaDCA address not found in config/deployedContracts.json. Deploy the contract first."
    );
  }

  const shariaDCA = await ethers.getContractAt("ShariaDCA", shariaDCAAddress);

  console.log("🤖 DCA Auto-Executor Started");
  console.log("Contract:", shariaDCAAddress);
  console.log("Network: Moonbeam");
  console.log("Mode: Local Automation Script");

  const checkInterval = 60000; // Check every 60 seconds
  
  // Track orders currently being processed to prevent duplicate executions
  const pendingOrders = new Set<string>();
  let isProcessing = false;

  const checkAndExecute = async () => {
    // Prevent overlapping executions
    if (isProcessing) {
      return;
    }
    
    isProcessing = true;
    
    try {
      // Check for ready orders using contract's checkUpkeep function
      const [upkeepNeeded, performData] = await shariaDCA.checkUpkeep("0x");
      
      if (upkeepNeeded) {
        const orderIds = ethers.AbiCoder.defaultAbiCoder().decode(
          ["uint256[]"],
          performData
        )[0];
        
        // Filter out orders that are already being processed
        const ordersToExecute = orderIds.filter((id: bigint) => {
          const orderIdStr = id.toString();
          return !pendingOrders.has(orderIdStr);
        });
        
        if (ordersToExecute.length === 0) {
          isProcessing = false;
          return;
        }
        
        // Fetch order details to show interval progress
        const orderDetails = await Promise.all(
          ordersToExecute.map(async (id: bigint) => {
            try {
              const order = await shariaDCA.getDCAOrder(id);
              return {
                id,
                intervalsCompleted: Number(order.intervalsCompleted),
                totalIntervals: Number(order.totalIntervals)
              };
            } catch {
              return {
                id,
                intervalsCompleted: 0,
                totalIntervals: 0
              };
            }
          })
        );
        
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ✅ Found ${ordersToExecute.length} order(s) ready for execution:`);
        orderDetails.forEach((order: { id: bigint; intervalsCompleted: number; totalIntervals: number }) => {
          const currentInterval = order.intervalsCompleted + 1;
          console.log(`  - Order #${order.id} (Interval ${currentInterval}/${order.totalIntervals})`);
        });
        
        // Execute each order
        const executionPromises = ordersToExecute.map(async (orderId: bigint) => {
          const orderIdStr = orderId.toString();
          
          // Get order details for this specific order
          let orderInfo = orderDetails.find((o: { id: bigint; intervalsCompleted: number; totalIntervals: number }) => o.id === orderId);
          if (!orderInfo) {
            try {
              const order = await shariaDCA.getDCAOrder(orderId);
              orderInfo = {
                id: orderId,
                intervalsCompleted: Number(order.intervalsCompleted),
                totalIntervals: Number(order.totalIntervals)
              };
            } catch {
              orderInfo = { id: orderId, intervalsCompleted: 0, totalIntervals: 0 };
            }
          }
          
          // Mark as pending
          pendingOrders.add(orderIdStr);
          
          try {
            const currentInterval = orderInfo.intervalsCompleted + 1;
            console.log(`\n🔄 Executing Order #${orderId} (Interval ${currentInterval}/${orderInfo.totalIntervals})...`);
            const tx = await shariaDCA.executeDCAOrder(orderId);
            console.log(`   Transaction sent: ${tx.hash}`);
            
            const receipt = await tx.wait();
            if (!receipt) {
              throw new Error("Transaction receipt unavailable");
            }
            console.log(`✅ Order #${orderId} executed successfully! (Interval ${currentInterval}/${orderInfo.totalIntervals})`);
            console.log(`   Block: ${receipt.blockNumber}`);
            console.log(`   Gas used: ${receipt.gasUsed.toString()}\n`);
            
            // Remove from pending after successful execution
            pendingOrders.delete(orderIdStr);
          } catch (error: any) {
            console.error(`❌ Failed to execute Order #${orderId}:`);
            console.error(`   Error: ${error.message}`);
            
            // Don't crash on individual order failures
            if (error.reason) {
              console.error(`   Reason: ${error.reason}`);
            }
            console.log();
            
            // Remove from pending after failure (order may have been executed by another tx)
            pendingOrders.delete(orderIdStr);
          }
        });
        
        // Wait for all executions to complete
        await Promise.all(executionPromises);
      }
    } catch (error: any) {
      const timestamp = new Date().toLocaleTimeString();
      console.error(`[${timestamp}] ❌ Error checking upkeep:`, error.message);
      
      // Continue running even if there's an error
      if (error.reason) {
        console.error(`   Reason: ${error.reason}`);
      }
    } finally {
      isProcessing = false;
    }
  };

  // Initial check
  console.log("🔍 Performing initial check...\n");
  await checkAndExecute();

  // Set up periodic checking
  console.log(`⏰ Will check every ${checkInterval / 1000} seconds`);
  console.log("Press Ctrl+C to stop\n");
  console.log("=".repeat(60));
  console.log();

  setInterval(checkAndExecute, checkInterval);

  // Keep process alive
  process.on('SIGINT', () => {
    console.log("\n\n👋 Shutting down DCA Auto-Executor...");
    process.exit(0);
  });
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});

