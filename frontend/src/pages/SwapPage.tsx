import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { formatUnits, parseUnits, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { FaTimes } from "react-icons/fa";
import tayebCoinsData from "../../../config/tayebCoins.json";
import { TokenInput } from "../components/TokenInput";
import { SwapConfirmationModal } from "../components/SwapConfirmationModal";
import { TransactionNotificationList } from "../components/TransactionNotification";
import { useShariaCompliance } from "../hooks/useShariaCompliance";
import { useManualSwapQuote, useShariaSwap } from "../hooks/useShariaSwap";
import { useTokenPrices } from "../hooks/useTokenPrices";
import { useTokenBalance } from "../hooks/useTokenBalance";
import { useWallet } from "../hooks/useWallet";
import type { Token, TransactionNotification, SwapConfirmationData } from "../types";
import { ERC20_ABI } from "../config/abis";
import { CONTRACTS } from "../config/contracts";
import { getFriendlyErrorMessage, isUserRejection } from "../utils/errorMessages";
import { formatTokenSymbolForDisplay } from "../utils/formatTokenSymbol";

export function SwapPage() {
	const [searchParams] = useSearchParams();
	const tokenInParam = searchParams.get("tokenIn");
	const { address, isConnected, isOnMoonbeam, switchToMoonbeam, chain } = useWallet();
	const {
		approveToken,
		swapTokenForToken,
		swapGLMRForToken,
		isSwapping,
		isConfirming,
		isConfirmed,
		txHash,
		transactionStatus,
		error: swapError,
		errorMessage: swapErrorMessage,
		isUserRejection: isSwapRejection,
		reset: resetSwap,
		SHARIA_SWAP_ADDRESS,
	} = useShariaSwap();
	const publicClient = usePublicClient();

	// Auto-prompt to switch network on page load if on wrong network
	useEffect(() => {
		if (isConnected && !isOnMoonbeam) {
			console.warn("⚠️ Wrong network detected! Connected to:", chain?.name, "Chain ID:", chain?.id);
			console.warn("⚠️ This app requires Moonbeam Mainnet (Chain ID: 1284)");
			// Automatically trigger switch prompt after a brief delay
			const timer = setTimeout(() => {
				if (confirm("You're connected to the wrong network. Switch to Moonbeam Mainnet now?")) {
					switchToMoonbeam();
				}
			}, 1000);
			return () => clearTimeout(timer);
		}
	}, [isConnected, isOnMoonbeam, chain, switchToMoonbeam]);

	// Debug: Log when isConfirmed changes
	useEffect(() => {
		console.log("🎯 isConfirmed changed:", isConfirmed);
	}, [isConfirmed]);

	// Debug: Log when isConfirming changes
	useEffect(() => {
		console.log("⏳ isConfirming changed:", isConfirming);
	}, [isConfirming]);
	const { coins, coinsLoading, coinsError } = useShariaCompliance();
	const { isLoading: quoteLoading, fetchQuote } = useManualSwapQuote();

	const [tokenIn, setTokenIn] = useState<Token | null>(null);
	const [tokenOut, setTokenOut] = useState<Token | null>(null);
	const [amountIn, setAmountIn] = useState<string>("");
	const [amountOut, setAmountOut] = useState<number | null>(null);
	const [swapPath, setSwapPath] = useState<`0x${string}`[] | null>(null); // Store path from StellaSwap SDK
	const [error, setError] = useState<string | null>(null);
	
	// Fetch token balances
	const { balance: balanceIn, refetch: refetchBalanceIn } = useTokenBalance(tokenIn);
	const { balance: balanceOut, refetch: refetchBalanceOut } = useTokenBalance(tokenOut);
	
	// Check if user has insufficient balance
	const hasInsufficientBalance = useMemo(() => {
		if (!amountIn || !tokenIn || !balanceIn || !isConnected) return false;
		const amount = parseFloat(amountIn);
		const balance = parseFloat(balanceIn);
		return !isNaN(amount) && !isNaN(balance) && amount > balance;
	}, [amountIn, balanceIn, tokenIn, isConnected]);
	
	// Modal and notification state
	const [showModal, setShowModal] = useState(false);
	const [confirmationData, setConfirmationData] = useState<SwapConfirmationData | null>(null);
	const [notifications, setNotifications] = useState<TransactionNotification[]>([]);
	const [currentTxId, setCurrentTxId] = useState<string | null>(null);
	
	// Allowance state
	const [needsApproval, setNeedsApproval] = useState(false);
	const [checkingAllowance, setCheckingAllowance] = useState(false);
	const [isApprovingToken, setIsApprovingToken] = useState(false);
	
	// Exchange rate reversal state
	const [isRateReversed, setIsRateReversed] = useState(false);
	
	// Reset rate reversal when tokens or amounts change
	useEffect(() => {
		setIsRateReversed(false);
	}, [tokenIn, tokenOut, amountIn, amountOut]);

	const slippageTolerance = useMemo(
		() => tokenOut?.avgSlippagePercent ?? 5,
		[tokenOut]
	);

	// Get token prices
	const tokenSymbols = useMemo(() => {
		const symbols: string[] = [];
		if (tokenIn) symbols.push(tokenIn.symbol);
		if (tokenOut) symbols.push(tokenOut.symbol);
		return symbols;
	}, [tokenIn, tokenOut]);
	
	const { calculateUsdValue } = useTokenPrices(tokenSymbols);



	// Format tokens: merge smart contract data with tayebCoins.json metadata
	const tokens: Token[] = (coins || []).map((coin) => {
		// Find matching coin metadata from tayebCoins.json
		// Check both main coins array and variants array
		const tayebCoinsDataTyped = tayebCoinsData as {
			coins: Array<{
				symbol: string;
				decimals: number;
				avgSlippagePercent: number;
				variants?: Array<{
					symbol: string;
					decimals: number;
					avgSlippagePercent?: number;
				}>;
			}>;
		};
		
		// First, try to find in main coins array
		let coinMetadata = tayebCoinsDataTyped.coins.find(
			(c: { symbol: string; decimals: number; avgSlippagePercent: number }) =>
				c.symbol.toLowerCase() === coin.symbol.toLowerCase()
		);
		
		// If not found, search in variants
		if (!coinMetadata) {
			for (const baseCoin of tayebCoinsDataTyped.coins) {
				if (baseCoin.variants) {
					const variant = baseCoin.variants.find(
						(v: { symbol: string }) => v.symbol.toLowerCase() === coin.symbol.toLowerCase()
					);
					if (variant) {
						coinMetadata = {
							symbol: variant.symbol,
							decimals: variant.decimals ?? baseCoin.decimals,
							avgSlippagePercent: variant.avgSlippagePercent ?? baseCoin.avgSlippagePercent,
						};
						break;
					}
				}
			}
		}

		return {
			symbol: coin.symbol,
			name: coin.name,
			// Use decimals from tayebCoins.json; default to 18
			decimals: coinMetadata?.decimals ?? 18,
			description: coin.complianceReason,
			complianceReason: coin.complianceReason,
			addresses: { moonbeam: coin.tokenAddress },
			permissible: coin.verified,
			// Include avgSlippagePercent from tayebCoins.json
			avgSlippagePercent: coinMetadata?.avgSlippagePercent,
		};
	});

	// Initialize token selections when tokens load
	useEffect(() => {
		if (tokens.length > 0 && !tokenIn) {
			// If tokenInParam is provided, try to find and select that token
			if (tokenInParam) {
				const selectedToken = tokens.find(
					(t) => t.symbol.toUpperCase() === tokenInParam.toUpperCase()
				);
				if (selectedToken) {
					setTokenIn(selectedToken);
					// Set tokenOut to the second token if available
					const secondToken = tokens.find(
						(t) => t.symbol.toUpperCase() !== tokenInParam.toUpperCase()
					);
					setTokenOut(secondToken || tokens[1] || null);
					return;
				}
			}
			// Default behavior: first two tokens
			setTokenIn(tokens[0]);
			setTokenOut(tokens.length > 1 ? tokens[1] : null);
		}

		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tokens.length, tokenInParam]);

	const handleTokenInChange = (selected: Token) => {
		if (!selected) return;
		if (
			tokenOut &&
			selected.addresses.moonbeam === tokenOut.addresses.moonbeam
		) {
			const tempToken = tokenIn;
			setTokenIn(selected);
			setTokenOut(tempToken);
			handleAmountChange(amountIn);
			return;
		}
		setTokenIn(selected);
	};

	const handleTokenOutChange = (selected: Token) => {
		if (!selected) return;
		if (tokenIn && selected.addresses.moonbeam === tokenIn.addresses.moonbeam) {
			const tempToken = tokenOut;
			setTokenOut(selected);
			setTokenIn(tempToken);
			handleAmountChange(amountIn);
			return;
		}
		setTokenOut(selected);
	};

	// Check token allowance
	const checkAllowance = async () => {
		if (!tokenIn || !amountIn || !address || !publicClient) {
			setNeedsApproval(false);
			return;
		}

		// Don't check if amount is invalid
		const numericAmount = parseFloat(amountIn);
		if (isNaN(numericAmount) || numericAmount <= 0) {
			setNeedsApproval(false);
			return;
		}

		// Native GLMR doesn't need approval - skip check
		const isNativeGLMR = tokenIn.symbol === "GLMR" && 
			tokenIn.addresses.moonbeam?.toLowerCase() === CONTRACTS.WETH.toLowerCase();
		
		if (isNativeGLMR) {
			setNeedsApproval(false);
			return;
		}

		try {
			setCheckingAllowance(true);
			const amountInWei = parseUnits(amountIn, tokenIn.decimals);
			
			const allowance = await publicClient.readContract({
				address: tokenIn.addresses.moonbeam as `0x${string}`,
				abi: ERC20_ABI,
				functionName: "allowance",
				args: [address, SHARIA_SWAP_ADDRESS],
			}) as bigint;

			console.log("🔍 Allowance check:", {
				token: tokenIn.symbol,
				allowance: allowance.toString(),
				required: amountInWei.toString(),
				needsApproval: allowance < amountInWei,
			});

			setNeedsApproval(allowance < amountInWei);
		} catch (err) {
			console.error("Error checking allowance:", err);
			setNeedsApproval(true); // Assume needs approval on error
		} finally {
			setCheckingAllowance(false);
		}
	};

	// Check allowance whenever relevant dependencies change
	useEffect(() => {
		checkAllowance();
	}, [tokenIn, amountIn, address, publicClient]);

	// Fetch quote when tokens change (if amount is already entered)
	useEffect(() => {
		if (amountIn && parseFloat(amountIn) > 0 && tokenIn && tokenOut) {
			// Use a small delay to avoid race conditions
			const timeoutId = setTimeout(() => {
				handleAmountChange(amountIn);
			}, 100);
			return () => clearTimeout(timeoutId);
		} else {
			// Clear path when tokens change or amount is cleared
			setSwapPath(null);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tokenIn?.symbol, tokenOut?.symbol]);

	// Fetch quote on amount change
	const handleAmountChange = async (value: string) => {
		setAmountIn(value);

		// Clear output if input is empty or invalid
		if (!value || value === "" || isNaN(parseFloat(value))) {
			setAmountOut(null);
			setNeedsApproval(false);
			return;
		}

		// Trigger quote fetch on amount change
		if (parseFloat(value) > 0 && tokenIn && tokenOut) {
			try {
				const decimalsIn = tokenIn.decimals ?? 18;
				const decimalsOut = tokenOut.decimals ?? 18;

				const amountInWei = parseUnits(value, decimalsIn);
				const quoteResult = await fetchQuote(
					tokenIn.addresses.moonbeam as `0x${string}`,
					tokenOut.addresses.moonbeam as `0x${string}`,
					amountInWei,
					tokenIn.symbol,
					tokenOut.symbol
				);

				if (quoteResult && quoteResult.quote > 0n) {
					const formatted = Number(formatUnits(quoteResult.quote, decimalsOut));
					setAmountOut(formatted);
					setSwapPath(quoteResult.path); // Store the path for swap execution
					setError(null); // Clear any previous errors
				} else {
					setAmountOut(null);
					setSwapPath(null);
					setError("Unable to get quote. This pair may not have sufficient liquidity.");
				}
			} catch (err: any) {
				console.error("Error fetching quote:", err);
				const errorMsg = err?.message || String(err);
				
				// Provide more specific error messages
				if (errorMsg.includes("HTTP 500") || errorMsg.includes("currently unavailable")) {
					setError("StellaSwap API is temporarily unavailable. Please try again in a few moments.");
				} else if (errorMsg.includes("HTTP 404") || errorMsg.includes("No route found")) {
					setError("No route found for this token pair. The pair may not have sufficient liquidity.");
				} else if (errorMsg.includes("QuoteAmountTooSmall") || errorMsg.includes("amount too small")) {
					setError("Amount too small for swap. Please try a larger amount.");
				} else if (errorMsg.includes("InvalidPath") || errorMsg.includes("invalid path")) {
					setError("No direct pair found. The swap path may not exist.");
				} else if (errorMsg.includes("reverted") || errorMsg.includes("revert")) {
					setError("Unable to get quote. This pair may not have sufficient liquidity or the direct pair doesn't exist. Try swapping through a different token.");
				} else {
					setError(errorMsg || "Failed to fetch quote. Please try again.");
				}
				setAmountOut(null);
				setSwapPath(null);
			}
		} else {
			setAmountOut(null);
			setSwapPath(null);
			setNeedsApproval(false);
		}
	};

	// Swap tokens
	const swapTokens = () => {
		// Swap the tokens
		const tempToken = tokenIn;
		setTokenIn(tokenOut);
		setTokenOut(tempToken);
		
		// Clear amounts to get fresh quote
		setAmountIn("");
		setAmountOut(null);
	};

	// Open confirmation modal with calculated data
	const handleReviewSwap = () => {
		if (!amountIn || !tokenIn || !tokenOut || !isConnected) {
			setError("Please fill in all fields and connect wallet");
			return;
		}

		if (parseFloat(amountIn) <= 0 || isNaN(parseFloat(amountIn))) {
			setError("Please enter a valid amount");
			return;
		}

		if (!amountOut || amountOut <= 0) {
			setError("Unable to get quote. Please try again.");
			return;
		}

		// Validate balance before opening confirmation modal
		if (hasInsufficientBalance) {
			setError(`Insufficient balance! You're trying to swap ${amountIn} ${formatTokenSymbolForDisplay(tokenIn.symbol)} but you only have ${balanceIn} ${formatTokenSymbolForDisplay(tokenIn.symbol)}.`);
			return;
		}

		setError(null);

		// Calculate values
		const amountInNum = parseFloat(amountIn);
		const amountOutNum = amountOut;
		const exchangeRate = (amountOutNum / amountInNum).toFixed(6);
		
		// Calculate USD values
		const amountInUsd = calculateUsdValue(tokenIn.symbol, amountInNum);
		const amountOutUsd = calculateUsdValue(tokenOut.symbol, amountOutNum);
		
		// Calculate fee (0.3%)
		const feeAmount = amountInNum * 0.003;
		const feeUsd = calculateUsdValue(tokenIn.symbol, feeAmount);
		
		// Calculate minimum amount out after slippage
		const minAmountOut = (amountOutNum * (100 - slippageTolerance)) / 100;

		const data: SwapConfirmationData = {
			tokenIn,
			tokenOut,
			amountIn,
			amountOut: amountOutNum.toFixed(6),
			amountInUsd,
			amountOutUsd,
			exchangeRate,
			priceImpact: 0, // Removed but keeping in type for compatibility
			fee: `${feeAmount.toFixed(8)} ${formatTokenSymbolForDisplay(tokenIn.symbol)}`,
			feeUsd,
			slippageTolerance,
			minAmountOut: minAmountOut.toFixed(6),
		};

		setConfirmationData(data);
		setShowModal(true);
	};

	// Execute the swap after confirmation
	const handleConfirmSwap = async () => {
		if (!confirmationData || !tokenIn || !tokenOut) return;

		// Additional safety check: validate network before proceeding
		if (!isOnMoonbeam) {
			setError(`Wrong network! Please switch to Moonbeam Mainnet before executing the swap.`);
			return;
		}

		// Additional safety check: validate balance before proceeding
		if (hasInsufficientBalance) {
			setError(`Insufficient balance! You're trying to swap ${amountIn} ${formatTokenSymbolForDisplay(tokenIn.symbol)} but you only have ${balanceIn} ${formatTokenSymbolForDisplay(tokenIn.symbol)}.`);
			return;
		}

		try {
			setError(null);
			// Generate a unique transaction ID for tracking
			const txId = `swap-${Date.now()}`;
			setCurrentTxId(txId);

			// Don't create notification here - wait for txHash (after wallet confirmation)

			const amountInWei = parseUnits(amountIn, tokenIn.decimals);
			const amountOutWei = parseUnits(
				confirmationData.amountOut,
				tokenOut.decimals
			);
			// Use slippageTolerance (already calculated) and ensure it's an integer
			const slippagePercentInt = Math.floor(slippageTolerance);
			const minAmountOut =
				(amountOutWei * BigInt(100 - slippagePercentInt)) / 100n;

			// Check if swapping native GLMR - use swapGLMRForToken instead
			const isNativeGLMR = tokenIn.symbol === "GLMR" && 
				tokenIn.addresses.moonbeam?.toLowerCase() === CONTRACTS.WETH.toLowerCase();

			// Use the path from StellaSwap SDK if available
			const path = swapPath as Address[] | undefined;

			if (isNativeGLMR) {
				// Use native GLMR swap function (no approval needed)
				await swapGLMRForToken(
					tokenOut.addresses.moonbeam as `0x${string}`,
					minAmountOut,
					amountInWei,
					path
				);
			} else {
				// Use regular token swap (requires approval)
				await swapTokenForToken(
					tokenIn.addresses.moonbeam as `0x${string}`,
					tokenOut.addresses.moonbeam as `0x${string}`,
					amountInWei,
					minAmountOut,
					path
				);
			}
		} catch (err) {
			const friendlyMessage = getFriendlyErrorMessage(err);
			setError(friendlyMessage);
			console.error("Swap error:", err);
			
			// Update notification to error if it exists
			if (currentTxId) {
				setNotifications((prev) =>
					prev.map((n) =>
						n.id === currentTxId
							? { ...n, status: "error", message: friendlyMessage }
							: n
					)
				);
			}
			// Clear currentTxId on error so user can try again
			setCurrentTxId(null);
		}
	};

	// Handle token approval (separate transaction)
	const handleApproveToken = async () => {
		if (!tokenIn || !amountIn || !address) return;

		// Additional safety check: validate network before proceeding
		if (!isOnMoonbeam) {
			setError(`Wrong network! Please switch to Moonbeam Mainnet before approving tokens.`);
			return;
		}

		// Additional safety check: validate balance before proceeding
		if (hasInsufficientBalance) {
			setError(`Insufficient balance! You're trying to approve ${amountIn} ${formatTokenSymbolForDisplay(tokenIn.symbol)} but you only have ${balanceIn} ${formatTokenSymbolForDisplay(tokenIn.symbol)}.`);
			return;
		}

		try {
			setIsApprovingToken(true);
			
			// Generate a unique transaction ID for tracking
			const txId = `approve-${Date.now()}`;
			setCurrentTxId(txId);

			// Don't create notification here - wait for txHash (after wallet confirmation)

			// Approve maximum amount to avoid future approvals
			const maxApproval = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
			
			await approveToken(
				tokenIn.addresses.moonbeam as `0x${string}`,
				maxApproval
			);

			console.log("✅ Approval transaction sent");
		} catch (err) {
			console.error("Approval error:", err);
			
			// Check if user rejected the transaction
			const isRejection = isUserRejection(err);
			
			if (isRejection) {
				// User declined - show friendly message and reset state
				setError("Transaction was declined. The approval was cancelled.");
				setIsApprovingToken(false);
				// Clear notification if it exists
				if (currentTxId) {
					setNotifications((prev) =>
						prev.filter((n) => n.id !== currentTxId)
					);
				}
				setCurrentTxId(null);
				// Reset the swap hook to clear its error state
				resetSwap();
			} else {
				// Real error - show error message
				const friendlyMessage = getFriendlyErrorMessage(err);
				setError(friendlyMessage);
				
				// Update notification to error if it exists
				if (currentTxId) {
					setNotifications((prev) =>
						prev.map((n) =>
							n.id === currentTxId
								? { ...n, status: "error", message: friendlyMessage }
								: n
						)
					);
				}
				// Clear currentTxId on error so user can try again
				setCurrentTxId(null);
				setIsApprovingToken(false);
			}
		}
	};


	// Close modal when transaction is sent
	useEffect(() => {
		if (isSwapping && showModal) {
			// Transaction has been sent to wallet and signed, close modal
			setShowModal(false);
		}
	}, [isSwapping, showModal]);

	// Separate effect specifically for transaction confirmation
	useEffect(() => {
		console.log("🎬 Confirmation Effect Triggered:", { isConfirmed, currentTxId });
		
		if (isConfirmed && currentTxId) {
			console.log("✅ Transaction CONFIRMED! Updating notification to SUCCESS");
			
			const isApprovalTx = currentTxId.startsWith("approve-");
			
			setNotifications((prev) => {
				console.log("Previous notifications:", prev);
				const updated = prev.map((n) => {
					console.log("Checking notification:", n.id, "against currentTxId:", currentTxId);
					return n.id === currentTxId
						? { ...n, status: "success" as const }
						: n;
				});
				console.log("Updated notifications:", updated);
				return updated;
			});

			if (isApprovalTx) {
				// Approval successful - re-check allowance and enable swap
				console.log("✅ Approval successful! Re-checking allowance...");
				setIsApprovingToken(false);
				setTimeout(async () => {
					await checkAllowance();
					setCurrentTxId(null);
					resetSwap();
				}, 1500);
			} else {
				// Swap successful - reset form and refetch balances
				setAmountIn("");
				setAmountOut(null);
				setConfirmationData(null);
				setNeedsApproval(false);
				
				// Refetch token balances
				refetchBalanceIn();
				refetchBalanceOut();
				
				// Reset swap state for next transaction
				setTimeout(() => {
					console.log("🔄 Resetting swap state");
					setCurrentTxId(null);
					resetSwap();
				}, 2000);
			}
		}
	}, [isConfirmed, currentTxId, resetSwap]);

	// Track transaction hash - create notification only after wallet confirmation
	useEffect(() => {
		if (txHash && currentTxId) {
			console.log("📝 Transaction hash available (wallet confirmed):", txHash);
			
			// Use functional update to check if notification exists without depending on notifications state
			setNotifications((prev) => {
				// Check if notification already exists
				const existingNotification = prev.find(n => n.id === currentTxId);
				
				if (existingNotification) {
					// Update existing notification with txHash if it doesn't have it
					if (!existingNotification.txHash) {
						return prev.map((n) =>
							n.id === currentTxId
								? { ...n, txHash }
								: n
						);
					}
					return prev; // No change needed
				}
				
				// Create new notification if it doesn't exist
				const isApproval = currentTxId.startsWith("approve-");
				
				if (isApproval && tokenIn) {
					// Create approval notification only after transaction is sent to wallet
					const approvalNotification: TransactionNotification = {
						id: currentTxId,
						status: "pending",
						type: "approve",
						tokenIn: tokenIn,
						amountIn,
						message: `Approving ${formatTokenSymbolForDisplay(tokenIn.symbol)}`,
						txHash,
					};
					return [...prev, approvalNotification];
				} else if (!isApproval && tokenIn && tokenOut) {
					// Create swap notification only after transaction is sent to wallet
					const swapNotification: TransactionNotification = {
						id: currentTxId,
						status: "pending",
						type: "swap",
						tokenIn: tokenIn,
						tokenOut: tokenOut,
						amountIn,
						amountOut: amountOut?.toFixed(6),
						txHash,
					};
					return [...prev, swapNotification];
				}
				
				return prev; // No change if conditions not met
			});
		}
	}, [txHash, currentTxId, tokenIn, tokenOut, amountIn, amountOut]);

	// Track errors
	useEffect(() => {
		if (swapError && currentTxId && !isSwapRejection) {
			// Don't show error for user rejections - they're not real errors
			const friendlyMessage = swapErrorMessage || getFriendlyErrorMessage(swapError);
			console.log("❌ Transaction ERROR:", friendlyMessage);
			setError(friendlyMessage);
			setNotifications((prev) =>
				prev.map((n) =>
					n.id === currentTxId && n.status !== "error"
						? { ...n, status: "error", message: friendlyMessage }
						: n
				)
			);
			setCurrentTxId(null);
		} else if (isSwapRejection && currentTxId) {
			// User rejection
			const isApprovalTx = currentTxId.startsWith("approve-");
			
			if (isApprovalTx) {
				// For approval rejections, show error message and reset approval state
				setError("Transaction was declined. The approval was cancelled.");
				setIsApprovingToken(false);
				setNotifications((prev) =>
					prev.filter((n) => n.id !== currentTxId)
				);
				setCurrentTxId(null);
				// Reset the swap hook to clear its error state
				resetSwap();
			} else {
				// For swap rejections, just clear the notification without showing error
				setNotifications((prev) =>
					prev.filter((n) => n.id !== currentTxId)
				);
				setCurrentTxId(null);
				setError(null);
			}
		}
	}, [swapError, swapErrorMessage, isSwapRejection, currentTxId, resetSwap]);

	// General status logging
	useEffect(() => {
		if (!currentTxId) return;
		
		console.log("🔍 Transaction Status Update:", {
			currentTxId,
			transactionStatus,
			txHash,
			isConfirmed,
			isConfirming,
			isSwapping,
			swapError: swapError?.message,
		});
	}, [currentTxId, transactionStatus, txHash, isConfirmed, isConfirming, isSwapping, swapError]);

	// Handle notification dismissal
	const handleDismissNotification = (id: string) => {
		setNotifications((prev) => prev.filter((n) => n.id !== id));
		// Clear currentTxId if this is the current transaction to prevent recreation
		if (currentTxId === id) {
			setCurrentTxId(null);
		}
	};

	// Calculate exchange rate - show placeholder if no amount entered
	const hasAmount = amountIn && amountOut && parseFloat(amountIn) > 0;
	const exchangeRate = hasAmount
		? (amountOut / parseFloat(amountIn)).toFixed(6)
		: null;
	
	// Calculate reversed rate
	const rateValue = exchangeRate ? parseFloat(exchangeRate) : 0;
	const reversedRate = rateValue > 0 ? (1 / rateValue).toFixed(6) : null;
	const displayRate = isRateReversed ? reversedRate : exchangeRate;
	const displayTokenIn = isRateReversed ? tokenOut : tokenIn;
	const displayTokenOut = isRateReversed ? tokenIn : tokenOut;

	return (
		<main className='flex flex-1 justify-center py-10 sm:py-16 px-4'>
				<div className='flex flex-col w-full max-w-lg'>
				<h1 className='text-white tracking-light text-[32px] font-bold leading-tight text-center pb-6'>
					Swap Tokens
				</h1>

				{/* CRITICAL: Wrong Network Warning */}
				{isConnected && !isOnMoonbeam && (
					<div className='mb-4 p-4 bg-red-500/20 border-2 border-red-500 rounded-lg text-red-400'>
						<div className='flex items-start gap-3'>
							<span className='material-symbols-outlined text-red-500 text-2xl'>
								warning
							</span>
							<div className='flex-1'>
								<div className='font-bold text-lg mb-1'>⚠️ WRONG NETWORK!</div>
								<div className='text-sm mb-3'>
									You're connected to <strong>{chain?.name || "wrong network"}</strong>.
									This app only works on <strong>Moonbeam Mainnet</strong> (GLMR tokens).
									<br/>
									<strong className='text-red-300'>Please switch to the correct network!</strong>
								</div>
								<button
									onClick={switchToMoonbeam}
									className='px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-colors'
								>
									Switch to Moonbeam Mainnet
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Loading State */}
				{coinsLoading && (
					<div className='mb-4 p-4 bg-blue-500/10 border border-blue-500 rounded-lg text-blue-500 text-sm text-center'>
						Loading tokens from smart contract...
					</div>
				)}

				{/* Token Error State */}
				{coinsError && (
					<div className='mb-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm'>
						Error: {coinsError.message || "Failed to load tokens"}
					</div>
				)}

				{/* Swap Error State */}
				{error && (
					<div className='mb-4 p-4 bg-red-500/10 border border-red-500 rounded-lg text-red-500 text-sm relative'>
						<div className='flex items-start justify-between gap-3'>
							<span className='flex-1'>{error}</span>
							<button
								onClick={() => setError(null)}
								className='flex-shrink-0 text-red-500 hover:text-red-400 transition-colors'
								aria-label='Dismiss error'
							>
								<FaTimes className='w-4 h-4' />
							</button>
						</div>
					</div>
				)}

				{/* Main Swap Card */}
				{!coinsLoading && !coinsError && tokens.length > 0 && (
					<div className='bg-[#1a3a2f] p-4 sm:p-6 rounded-xl border border-solid border-[#23483c] shadow-lg'>
						{/* From Token Section */}
						<TokenInput
							label='You Pay'
							value={amountIn}
							onChange={handleAmountChange}
							token={tokenIn}
							tokens={tokens}
							onTokenChange={handleTokenInChange}
							balance={balanceIn}
						/>
						{/* Swap Direction Button */}
						<div className='flex justify-center items-center h-0 z-10 relative'>
							<button
								onClick={swapTokens}
								className='flex items-center justify-center size-12 bg-[#23483c] border-4 border-solid border-[#1a3a2f] rounded-full text-primary hover:bg-[#2c5a4b] transition-colors'
							>
								<span className='material-symbols-outlined'>
									arrow_downward
								</span>
							</button>
						</div>
						{/* To Token Section */}
						<TokenInput
							label='You Receive'
							value={amountOut ? Number(amountOut).toFixed(5) : ""}
							readOnly
							token={tokenOut}
							tokens={tokens}
							onTokenChange={handleTokenOutChange}
							balance={balanceOut}
						/>
						<div className='pt-4'>
							{needsApproval ? (
								<button
									onClick={handleApproveToken}
									disabled={
										isApprovingToken ||
										isSwapping ||
										checkingAllowance ||
										!amountIn ||
										parseFloat(amountIn) <= 0 ||
										isNaN(parseFloat(amountIn)) ||
										!isConnected ||
										!isOnMoonbeam ||
										hasInsufficientBalance
									}
									className='flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-primary text-background-dark text-lg font-bold leading-normal tracking-wide hover:opacity-90 transition-opacity disabled:opacity-20 disabled:cursor-not-allowed'
								>
									{hasInsufficientBalance
										? "Insufficient balance"
										: isApprovingToken
										? "Approving..."
										: checkingAllowance
										? "Checking..."
										: `Approve ${tokenIn?.symbol || "Token"}`}
								</button>
							) : (
								<button
									onClick={handleReviewSwap}
									disabled={
										// Only disable during active wallet prompt (isSwapping), not during confirmation
										// This allows reviewing a new swap even if a previous one is being confirmed
										isSwapping ||
										isApprovingToken ||
										quoteLoading ||
										checkingAllowance ||
										!amountIn ||
										!amountOut ||
										parseFloat(amountIn) <= 0 ||
										isNaN(parseFloat(amountIn)) ||
										!isConnected ||
										!isOnMoonbeam ||
										hasInsufficientBalance
									}
									className='flex min-w-[84px] w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl h-14 px-5 bg-primary text-background-dark text-lg font-bold leading-normal tracking-wide hover:opacity-90 transition-opacity disabled:opacity-20 disabled:cursor-not-allowed'
								>
									{hasInsufficientBalance
										? "Insufficient balance"
										: !isOnMoonbeam && isConnected
										? "Wrong Network"
										: quoteLoading
										? "Getting quote..."
										: checkingAllowance
										? "Checking..."
										: "Review Swap"}
								</button>
							)}
						</div>
					</div>
				)}

				{/* Details */}
				{!coinsLoading && !coinsError && tokens.length > 0 && (
					<div className='mt-4 p-4 text-sm text-white/70 space-y-2'>
						<div className='flex justify-between items-center'>
							<span>Exchange Rate</span>
							{displayTokenIn && displayTokenOut && (
								<div className='flex items-center gap-2'>
									{displayRate ? (
										<>
											<span className='text-primary/80'>
												1 {formatTokenSymbolForDisplay(displayTokenIn.symbol)} = {displayRate} {formatTokenSymbolForDisplay(displayTokenOut.symbol)}
											</span>
											<button
												onClick={() => setIsRateReversed(!isRateReversed)}
												className='flex items-center justify-center'
												aria-label='Reverse exchange rate'
											>
												<span className='material-symbols-outlined text-primary/80'>
													swap_horiz
												</span>
											</button>
										</>
									) : (
										<span className='text-white/40 text-sm'>
											Enter amount to see rate
										</span>
									)}
								</div>
							)}
						</div>
						{/* <div className='flex justify-between items-center'>
							<span>Estimated Gas Fee</span>
							<span>${estimatedGas}</span>
						</div> */}
						<div className='flex justify-between items-center'>
							<span>Slippage Tolerance</span>
							<span className='text-primary/80'>{slippageTolerance}%</span>
						</div>
					</div>
				)}

				{/* No tokens error message */}
				{!coinsLoading && tokens.length === 0 && (
					<div className='mb-4 p-4 bg-yellow-500/10 border border-yellow-500 rounded-lg text-yellow-500 text-sm text-center'>
						No tokens available. Make sure you&apos;re connected to Moonbeam
						Mainnet.
					</div>
				)}
			</div>

			{/* Confirmation Modal */}
			{confirmationData && (
				<SwapConfirmationModal
					data={confirmationData}
					isOpen={showModal}
					onConfirm={handleConfirmSwap}
					onCancel={() => setShowModal(false)}
				/>
			)}

			{/* Transaction Notifications */}
			<TransactionNotificationList
				notifications={notifications}
				onDismiss={handleDismissNotification}
			/>
		</main>
	);
}
