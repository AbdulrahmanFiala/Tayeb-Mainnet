import { ethers } from "ethers";
import hre from "hardhat";
import { executeStellaSwap } from "./stellaswap-swap-helper";

/**
 * Example: Execute a swap using StellaSwap
 * This demonstrates the working solution for executeSwap() compatibility issue
 */
async function exampleSwap() {
  // Get signer
  const [signer] = await hre.ethers.getSigners();
  const account = await signer.getAddress();
  console.log(`👤 Using wallet: ${account}\n`);

  // Swap parameters
  const tokenIn = "0xacc15dc74880c9944775448304b263d191c6077f"; // GLMR
  const tokenOut = "0x931715fee2d06333043d11f658c8ce934ac61d0c"; // USDC_WH
  const amountIn = "1000000000000000000"; // 1 GLMR
  const slippageBps = 100; // 1% slippage

  try {
    console.log("🔄 Executing swap...");
    console.log(`   From: ${tokenIn} (GLMR)`);
    console.log(`   To: ${tokenOut} (USDC_WH)`);
    console.log(`   Amount: ${ethers.formatEther(amountIn)} GLMR`);
    console.log(`   Slippage: ${slippageBps} bps (${slippageBps / 100}%)\n`);

    // Execute swap (set sendTransaction: true to actually send)
    const result = await executeStellaSwap(
      tokenIn,
      tokenOut,
      amountIn,
      signer,
      slippageBps,
      true // Actually send the transaction
    );

    console.log("✅ Swap transaction encoded successfully!");
    console.log(`   Expected output: ${result.quote.amountOut}`);
    console.log(`   Encoded data length: ${result.encodedData.length}`);
    
    if (result.txHash) {
      console.log(`\n📤 Transaction sent!`);
      console.log(`   Transaction hash: ${result.txHash}`);
      console.log(`   View on Moonscan: https://moonscan.io/tx/${result.txHash}`);
      console.log("\n   ⏳ Transaction is being processed on-chain...");
      console.log("   Check the Moonscan link above to see confirmation status");
      
      // Try to get receipt (may not work with Hardhat provider)
      try {
        const receipt = await signer.provider.getTransactionReceipt(result.txHash);
        if (receipt) {
          if (receipt.status === 1) {
            console.log("✅ Transaction confirmed!");
            console.log(`   Block number: ${receipt.blockNumber}`);
            console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
          } else {
            console.log("❌ Transaction failed or reverted");
          }
        }
      } catch (e) {
        // Receipt not available yet or provider doesn't support it
        console.log("   (Receipt check not available - check Moonscan for status)");
      }
    } else {
      console.log("\n   ⚠️  Transaction encoded but not sent");
      console.log("   Set sendTransaction: true to actually execute the swap");
    }

  } catch (error: any) {
    console.error("❌ Swap failed:", error.message);
    throw error;
  }
}

// Run example
exampleSwap()
  .then(() => {
    console.log("\n✅ Example complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });

