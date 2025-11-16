import { useState } from "react";
import type { Address } from "viem";
import {
	useAccount,
	useChainId,
	usePublicClient,
	useReadContract,
	useWriteContract,
	useWaitForTransactionReceipt,
	useSwitchChain,
} from "wagmi";
import { moonbeam } from "wagmi/chains";
import { ERC20_ABI, ShariaSwapABI } from "../config/abis";
import deployedContracts from "../../../config/deployedContracts.json";
import type { TransactionStatus } from "../types";
import { getFriendlyErrorMessage, isUserRejection } from "../utils/errorMessages";
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from "../config/wagmi";
import stellaSwap from "@stellaswap/swap-sdk";
import type { Address } from "viem";

const SHARIA_SWAP_ADDRESS = (
	deployedContracts as unknown as { main: { shariaSwap: string } }
).main.shariaSwap as Address;

// Helper function to build swap path
function buildSwapPath(
	tokenIn: Address,
	tokenOut: Address,
	tryDirect: boolean = true
): Address[] {
	const WETH_ADDRESS = (deployedContracts as unknown as { amm: { weth: string } }).amm.weth as Address;
	
	// If one of the tokens is WETH, use direct path
	if (tokenIn.toLowerCase() === WETH_ADDRESS.toLowerCase() || 
		tokenOut.toLowerCase() === WETH_ADDRESS.toLowerCase()) {
		return [tokenIn, tokenOut];
	}
	
	// Try direct path first if requested, otherwise go through WETH
	if (tryDirect) {
		return [tokenIn, tokenOut];
	} else {
		return [tokenIn, WETH_ADDRESS, tokenOut];
	}
}

/**
 * Refactored swap hook using Wagmi v2 + Viem with transaction tracking
 */
export function useShariaSwap() {
	const { address: userAddress, chainId: accountChainId } = useAccount();
	const chainId = useChainId();
	const publicClient = usePublicClient();
	const { switchChain } = useSwitchChain();
	const { 
		writeContract, 
		isPending: isWriting,
		data: txHash,
		error: writeError,
		reset: resetWrite,
	} = useWriteContract();

	// Validate network before any transaction and prompt to switch if needed
	// Use accountChainId if available (more reliable), fallback to chainId
	const validateNetwork = async () => {
		const currentChainId = accountChainId || chainId;
		if (!currentChainId || currentChainId !== REQUIRED_CHAIN_ID) {
			// Try to automatically switch to the correct network
			if (switchChain) {
				try {
					await switchChain({ chainId: moonbeam.id });
					// Wait a moment for the switch to complete
					await new Promise(resolve => setTimeout(resolve, 500));
					// Re-check after switch attempt
					const newChainId = accountChainId || chainId;
					if (newChainId !== REQUIRED_CHAIN_ID) {
						throw new Error(
							`Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) in your wallet. If the network is not added, MetaMask will prompt you to add it.`
						);
					}
				} catch (error: any) {
					// If user rejects or switch fails, throw a helpful error
					if (error?.code === 4902 || error?.message?.includes('4902')) {
						// Chain not added - MetaMask should prompt to add it
						throw new Error(
							`Please add ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) to your wallet. MetaMask should prompt you to add it.`
						);
					} else if (error?.code === 4001 || error?.message?.includes('rejected')) {
						// User rejected the switch
						throw new Error(
							`Network switch was rejected. Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) manually in your wallet.`
						);
					} else {
						throw new Error(
							`Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) in your wallet. If the network is not added, MetaMask will prompt you to add it.`
						);
					}
				}
			} else {
				throw new Error(
					`Wrong network! You're connected to chain ID ${currentChainId || 'unknown'}, but this app requires ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}). Please switch networks in your wallet.`
				);
			}
		}
	};

	// Wait for transaction confirmation
	const {
		isLoading: isConfirming,
		isSuccess: isConfirmed,
		isError: isConfirmError,
		error: confirmError,
	} = useWaitForTransactionReceipt({
		hash: txHash,
	});

	// Calculate transaction status
	const getTransactionStatus = (): TransactionStatus => {
		if (isWriting || isConfirming) return "pending";
		if (isConfirmed) return "success";
		if (writeError || isConfirmError) return "error";
		return "idle";
	};

	// Estimate gas for transaction
	const estimateSwapGas = async (
		tokenIn: Address,
		tokenOut: Address,
		amountIn: bigint,
		minAmountOut: bigint,
		path?: Address[]
	): Promise<bigint | null> => {
		if (!publicClient || !userAddress) return null;

		try {
			const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 15);
			const swapPath = path || buildSwapPath(tokenIn, tokenOut, true);
			
			const gasEstimate = await publicClient.estimateContractGas({
				address: SHARIA_SWAP_ADDRESS,
				abi: ShariaSwapABI,
				functionName: "swapShariaCompliant",
				args: [swapPath, amountIn, minAmountOut, deadline],
				account: userAddress,
			});

			return gasEstimate;
		} catch (err) {
			console.error("Failed to estimate gas:", err);
			return null;
		}
	};

	// Approve token spending
	const approveToken = async (tokenAddress: Address, amount: bigint) => {
		if (!userAddress) throw new Error("Wallet not connected");
		await validateNetwork(); // Check network before transaction (will prompt to switch if needed)

		return writeContract({
			address: tokenAddress,
			abi: ERC20_ABI,
			functionName: "approve",
			args: [SHARIA_SWAP_ADDRESS, amount],
		});
	};

	// Execute swap token for token
	const swapTokenForToken = async (
		tokenIn: Address,
		tokenOut: Address,
		amountIn: bigint,
		minAmountOut: bigint,
		path?: Address[] // Optional path, will be built if not provided
	) => {
		await validateNetwork(); // Check network before transaction (will prompt to switch if needed)
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 15);
		
		// Build path if not provided (try direct first)
		const swapPath = path || buildSwapPath(tokenIn, tokenOut, true);

		return writeContract({
			address: SHARIA_SWAP_ADDRESS,
			abi: ShariaSwapABI,
			functionName: "swapShariaCompliant",
			args: [swapPath, amountIn, minAmountOut, deadline],
		});
	};

	// Swap GLMR for token
	const swapGLMRForToken = async (
		tokenOut: Address,
		minAmountOut: bigint,
		amountIn: bigint,
		path?: Address[] // Optional path, will be built if not provided
	) => {
		await validateNetwork(); // Check network before transaction (will prompt to switch if needed)
		const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 15);
		
		const WETH_ADDRESS = (deployedContracts as unknown as { amm: { weth: string } }).amm.weth as Address;
		// Build path: [WETH, tokenOut] or use provided path
		const swapPath = path || [WETH_ADDRESS, tokenOut];

		return writeContract({
			address: SHARIA_SWAP_ADDRESS,
			abi: ShariaSwapABI,
			functionName: "swapGLMRForToken",
			args: [swapPath, minAmountOut, deadline],
			value: amountIn,
		});
	};

	// Get friendly error message
	const rawError = writeError || confirmError;
	const friendlyErrorMessage = rawError ? getFriendlyErrorMessage(rawError) : null;
	const isRejection = rawError ? isUserRejection(rawError) : false;

	return {
		approveToken,
		swapTokenForToken,
		swapGLMRForToken,
		estimateSwapGas,
		isApproving: isWriting,
		isSwapping: isWriting,
		isSwappingGLMR: isWriting,
		isConfirming,
		isConfirmed,
		txHash,
		transactionStatus: getTransactionStatus(),
		error: rawError,
		errorMessage: friendlyErrorMessage,
		isUserRejection: isRejection,
		reset: resetWrite,
		SHARIA_SWAP_ADDRESS,
	};
}

/**
 * Custom hook for reading swap quote (Wagmi v2)
 * Note: This hook is deprecated in favor of useManualSwapQuote which handles path building
 */
export function useSwapQuote(
	tokenIn: Address | `0x${string}` | undefined,
	tokenOut: Address | `0x${string}` | undefined,
	amountIn: bigint | undefined
) {
	const WETH_ADDRESS = (deployedContracts as unknown as { amm: { weth: string } }).amm.weth as Address;
	
	// Build path (try direct first)
	const path = tokenIn && tokenOut 
		? buildSwapPath(tokenIn as Address, tokenOut as Address, true)
		: undefined;
	
	const { data: quote, isLoading } = useReadContract({
		address: SHARIA_SWAP_ADDRESS,
		abi: ShariaSwapABI,
		functionName: "getSwapQuote",
		args: path && amountIn ? [path, amountIn] : undefined,
		query: {
			enabled: !!(tokenIn && tokenOut && amountIn && path),
		},
	});

	return { quote: quote as bigint | undefined, isLoading };
}

/**
 * Manual quote fetching hook - Fixed version
 */
export function useManualSwapQuote() {
	const publicClient = usePublicClient();
	const [isLoading, setIsLoading] = useState(false);

	const fetchQuote = async (
		tokenIn: Address | `0x${string}`,
		tokenOut: Address | `0x${string}`,
		amountIn: bigint,
		tokenInSymbol?: string,
		tokenOutSymbol?: string
	): Promise<{ quote: bigint; path: Address[] } | null> => {
		if (!tokenIn || !tokenOut || !amountIn || amountIn === 0n) {
			console.warn("⚠️ Invalid quote parameters", {
				tokenIn,
				tokenOut,
				amountIn: amountIn?.toString(),
			});
			return null;
		}

		// ✅ Check if tokenIn and tokenOut are the same
		if (tokenIn.toLowerCase() === tokenOut.toLowerCase()) {
			console.error("❌ tokenIn and tokenOut cannot be the same");
			return null;
		}

		try {
			setIsLoading(true);

			// According to StellaSwap docs: For native asset pass "ETH" as token0Addr or token1Addr
			// Also, account can be null if user is not connected
			const WETH_ADDRESS = (deployedContracts as unknown as { amm: { weth: string } }).amm.weth as Address;
			
			// Convert native GLMR (WETH) to "ETH" for StellaSwap API
			const tokenInForAPI = tokenIn.toLowerCase() === WETH_ADDRESS.toLowerCase() ? "ETH" : tokenIn;
			const tokenOutForAPI = tokenOut.toLowerCase() === WETH_ADDRESS.toLowerCase() ? "ETH" : tokenOut;

			console.log("📝 Fetching quote from StellaSwap SDK:", {
				tokenIn,
				tokenOut,
				tokenInForAPI,
				tokenOutForAPI,
				amountIn: amountIn.toString(),
				tokenInSymbol,
				tokenOutSymbol,
			});

			// Use StellaSwap SDK to get the optimal route
			const slippageBps = 100; // 1% slippage for quote
			const account = null; // According to docs: can be null if user is not connected
			
			let quoteResult: any;
			try {
				quoteResult = await stellaSwap.getQuote(
					tokenInForAPI,
					tokenOutForAPI,
					amountIn.toString(),
					account,
					slippageBps.toString()
				);
			} catch (sdkError: any) {
				// Handle SDK errors (network errors, API errors, etc.)
				const statusCode = sdkError?.response?.status || sdkError?.status;
				const errorMessage = sdkError?.message || sdkError?.response?.data?.message || "Unknown error";
				
				if (statusCode === 500) {
					throw new Error("StellaSwap API is currently unavailable (HTTP 500). Please try again in a few moments.");
				} else if (statusCode === 404) {
					throw new Error("No route found for this token pair. The pair may not have sufficient liquidity.");
				} else if (statusCode) {
					throw new Error(`StellaSwap API error (HTTP ${statusCode}): ${errorMessage}`);
				} else {
					throw new Error(`Failed to fetch quote from StellaSwap: ${errorMessage}`);
				}
			}

			// IMPORTANT: The SDK returns AxiosError objects instead of throwing
			// Check if the SDK returned an error object
			if (quoteResult && typeof quoteResult === 'object' && quoteResult.name === 'AxiosError') {
				const statusCode = quoteResult.response?.status ?? quoteResult.status;
				const responseData = quoteResult.response?.data;
				const errorMessage = responseData?.message || quoteResult.message || "Request failed";
				
				if (statusCode === 500) {
					// Check if it's a 404 inside the 500 response (StellaSwap API issue)
					if (errorMessage.includes("404") || responseData?.message?.includes("404")) {
						throw new Error("StellaSwap API is experiencing issues. The token pair may not be recognized or the API is temporarily unavailable. Please try again later.");
					}
					throw new Error("StellaSwap API is currently unavailable (HTTP 500). Please try again in a few moments.");
				} else if (statusCode === 404) {
					throw new Error("No route found for this token pair. The pair may not have sufficient liquidity.");
				}
				
				throw new Error(`StellaSwap API error: ${errorMessage}${statusCode ? ` (HTTP ${statusCode})` : ''}`);
			}

			const payload = quoteResult?.result ?? quoteResult;

			// Check if the quote indicates failure
			if (!payload || quoteResult?.isSuccess === false) {
				const errorMessage = quoteResult?.message ?? quoteResult?.error ?? "Unknown error from StellaSwap router API";
				throw new Error(errorMessage);
			}

			// Extract path from the quote result
			const extractPath = (result: any): Address[] | null => {
				if (!result) return null;

				// New format: path from trades array
				if (Array.isArray(result?.trades) && result.trades.length > 0) {
					const path: Address[] = [];
					const fromToken = result.fromToken;
					const toToken = result.toToken;
					
					// Start with the fromToken if available
					if (fromToken) {
						path.push(typeof fromToken === "string" ? fromToken : fromToken.address);
					}
					
					// Build path from trades sequentially
					for (const trade of result.trades) {
						if (Array.isArray(trade?.path) && trade.path.length > 0) {
							// Determine start index: skip first token if it matches the last token in our path
							let startIdx = 0;
							if (path.length > 0) {
								const lastPathToken = path[path.length - 1].toLowerCase();
								const firstTradeToken = typeof trade.path[0] === "string" 
									? trade.path[0].toLowerCase() 
									: (trade.path[0]?.address?.toLowerCase() ?? "");
								if (firstTradeToken === lastPathToken) {
									startIdx = 1;
								}
							}
							
							// Add tokens from this trade's path
							for (let i = startIdx; i < trade.path.length; i++) {
								const token = trade.path[i];
								const address = typeof token === "string" ? token : token?.address;
								if (address && typeof address === "string" && address.startsWith("0x")) {
									const addrLower = address.toLowerCase();
									// Avoid duplicates (case-insensitive check)
									if (!path.some(p => p.toLowerCase() === addrLower)) {
										path.push(address as Address);
									}
								}
							}
						}
					}
					
					// Ensure we end with the toToken
					if (toToken) {
						const toTokenAddress = typeof toToken === "string" ? toToken : toToken.address;
						const toTokenLower = toTokenAddress.toLowerCase();
						const lastToken = path.length > 0 ? path[path.length - 1].toLowerCase() : null;
						
						if (lastToken !== toTokenLower) {
							// Remove toToken if it exists elsewhere in path
							const filtered = path.filter(p => p.toLowerCase() !== toTokenLower);
							filtered.push(toTokenAddress as Address);
							if (filtered.length > 1) {
								return filtered;
							}
						} else if (path.length > 1) {
							return path;
						}
					}
					
					if (path.length > 1) {
						return path;
					}
				}

				// Fallback to other path formats
				const candidates = [result.path, result?.route?.path, result?.bestRoute?.path];
				for (const candidate of candidates) {
					if (Array.isArray(candidate) && candidate.length > 1) {
						if (typeof candidate[0] === "string") {
							return candidate as Address[];
						}
						if (candidate[0] && typeof candidate[0].address === "string") {
							return candidate.map((node: any) => node.address) as Address[];
						}
					}
				}

				return null;
			};

			// Extract amountOut
			const extractAmountOut = (result: any): string | null => {
				if (!result) return null;
				const candidates = [
					result.amountOut,
					result?.route?.amountOut,
					result?.bestRoute?.amountOut,
					result?.routes?.[0]?.amountOut,
					result?.execution?.amountOut,
				];

				for (const candidate of candidates) {
					if (candidate !== null && candidate !== undefined) {
						if (typeof candidate === "string") return candidate;
						if (typeof candidate === "number") return candidate.toString();
						if (typeof candidate === "bigint") return candidate.toString();
					}
				}

				return null;
			};

			let path = extractPath(payload);
			const amountOutStr = extractAmountOut(payload);

			if (!path || path.length < 2) {
				throw new Error("StellaSwap SDK did not return a valid path");
			}

			// Convert "ETH" back to WETH address in the path
			// StellaSwap API returns "ETH" for native tokens, but we need the actual WETH address for our contract
			path = path.map((addr) => {
				if (typeof addr === "string" && addr.toUpperCase() === "ETH") {
					return WETH_ADDRESS;
				}
				return addr;
			}) as Address[];

			if (!amountOutStr) {
				throw new Error("StellaSwap SDK did not return an amountOut");
			}

			const amountOut = BigInt(amountOutStr);

			if (amountOut === 0n) {
				throw new Error("Quote returned zero - insufficient liquidity");
			}

			console.log("✅ Quote fetched successfully from StellaSwap SDK:", {
				originalPath: extractPath(payload)?.map(p => p),
				convertedPath: path.map(p => p),
				amountOut: amountOut.toString(),
			});

			return { quote: amountOut, path };
		} catch (err: any) {
			const errorMsg = err instanceof Error ? err.message : String(err);
			console.error("❌ StellaSwap SDK quote error:", {
				error: errorMsg,
				details: err,
			});

			return null;
		} finally {
			setIsLoading(false);
		}
	};

	return { isLoading, fetchQuote };
}
