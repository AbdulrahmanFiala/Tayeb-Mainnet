import stellaSwap from "@stellaswap/swap-sdk";
import { ethers } from "ethers";

/**
 * Helper function to execute a swap using StellaSwap SDK
 * Works around the ethers v5/v6 compatibility issue with executeSwap()
 * 
 * @param tokenIn - Input token address (use "ETH" or native token address for native swaps)
 * @param tokenOut - Output token address
 * @param amountIn - Amount in smallest units (wei for native tokens)
 * @param signer - Ethers v6 signer
 * @param slippageBps - Slippage in basis points (e.g., 100 = 1%)
 * @param sendTransaction - If true, actually sends the transaction. If false, just encodes it.
 * @returns Transaction hash if sent, or encoded transaction data if not sent
 */
export async function executeStellaSwap(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  signer: ethers.Signer,
  slippageBps: string | number,
  sendTransaction: boolean = false
): Promise<{ txHash?: string; encodedData: string; quote: any }> {
  const account = await signer.getAddress();
  const slippage = slippageBps.toString();

  // Check if it's a native token swap
  // For StellaSwap SDK, native tokens should be passed as "ETH" not the actual address
  const isNative = tokenIn.toLowerCase() === "eth" || 
                   tokenIn.toLowerCase() === "0xacc15dc74880c9944775448304b263d191c6077f"; // GLMR

  // Step 1: Get quote
  // Use "ETH" for native tokens to match what executeNativeSwap will use internally
  const quoteTokenIn = isNative ? "ETH" : tokenIn;
  const quote = await stellaSwap.getQuote(
    quoteTokenIn, // Use "ETH" for native tokens
    tokenOut,
    amountIn,
    account,
    slippage
  );

  if (!quote?.result || quote?.isSuccess === false) {
    throw new Error(`Quote failed: ${quote?.message ?? "Unknown error"}`);
  }

  // Step 2: Get aggregator address
  const addresses = await stellaSwap.getAddresses();
  const aggregatorAddress = addresses.aggregator;

  // Step 3: Encode transaction
  const aggregatorAbi = [
    "function execute(tuple(uint8 instruction)[] commands, bytes[] inputs) payable"
  ];
  const aggregatorContract = new ethers.Contract(aggregatorAddress, aggregatorAbi, signer);

  let encodedTxData: string;
  let value: bigint = 0n;

  if (isNative) {
    // Use executeNativeSwap for native token swaps
    // SDK expects "ETH" for native tokens, not the actual token address
    encodedTxData = await stellaSwap.executeNativeSwap(
      "ETH", // Use "ETH" instead of actual GLMR address
      tokenOut,
      amountIn,
      account,
      slippage,
      aggregatorContract
    );
    value = BigInt(amountIn);
  } else {
    // For ERC20 swaps, we need permit2 signature
    // This is more complex and requires permit2 setup
    throw new Error("ERC20 to ERC20 swaps require permit2 signature. Use executeERC20Swap() directly.");
  }

  // Step 4: Send transaction if requested
  if (sendTransaction) {
    // Get current gas price
    const feeData = await signer.provider.getFeeData();
    const gasPrice = feeData.gasPrice || await signer.provider.getFeeData().then(f => f.gasPrice) || 1000000000n; // 1 gwei fallback
    
    // Estimate gas first
    let gasLimit = 2_000_000n; // Default higher limit
    try {
      const estimatedGas = await signer.provider.estimateGas({
        to: aggregatorAddress,
        from: account,
        value: value,
        data: encodedTxData
      });
      gasLimit = estimatedGas * 120n / 100n; // Add 20% buffer
      console.log(`   Estimated gas: ${estimatedGas.toString()}, using: ${gasLimit.toString()}`);
    } catch (error: any) {
      console.log(`   ⚠️  Gas estimation failed, using default: ${gasLimit.toString()}`);
      // If estimation fails, use higher default
      gasLimit = 2_500_000n;
    }
    
    const tx = await signer.sendTransaction({
      to: aggregatorAddress,
      value: value,
      data: encodedTxData,
      gasLimit: gasLimit,
      gasPrice: gasPrice
    });

    return {
      txHash: tx.hash,
      encodedData: encodedTxData,
      quote: quote.result
    };
  }

  return {
    encodedData: encodedTxData,
    quote: quote.result
  };
}

/**
 * Helper function to execute ERC20 to ERC20 swap
 * Requires permit2 signature setup
 */
export async function executeStellaSwapERC20(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  signer: ethers.Signer,
  slippageBps: string | number,
  permit: any,
  signature: string,
  sendTransaction: boolean = false
): Promise<{ txHash?: string; encodedData: string; quote: any }> {
  const account = await signer.getAddress();
  const slippage = slippageBps.toString();

  // Step 1: Get quote
  const quote = await stellaSwap.getQuote(
    tokenIn,
    tokenOut,
    amountIn,
    account,
    slippage
  );

  if (!quote?.result || quote?.isSuccess === false) {
    throw new Error(`Quote failed: ${quote?.message ?? "Unknown error"}`);
  }

  // Step 2: Get aggregator address
  const addresses = await stellaSwap.getAddresses();
  const aggregatorAddress = addresses.aggregator;

  // Step 3: Encode transaction
  const aggregatorAbi = [
    "function execute(tuple(uint8 instruction)[] commands, bytes[] inputs) payable"
  ];
  const aggregatorContract = new ethers.Contract(aggregatorAddress, aggregatorAbi, signer);

  const encodedTxData = await stellaSwap.executeERC20Swap(
    tokenIn,
    tokenOut,
    amountIn,
    account,
    slippage,
    aggregatorContract,
    permit,
    signature
  );

  // Step 4: Send transaction if requested
  if (sendTransaction) {
    const tx = await signer.sendTransaction({
      to: aggregatorAddress,
      data: encodedTxData,
      gasLimit: 1_500_000n
    });

    return {
      txHash: tx.hash,
      encodedData: encodedTxData,
      quote: quote.result
    };
  }

  return {
    encodedData: encodedTxData,
    quote: quote.result
  };
}

