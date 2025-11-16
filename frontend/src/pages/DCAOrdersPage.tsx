import { useMemo, useState, useEffect } from "react";
import { parseUnits, formatUnits } from "viem";
import type { Address } from "viem";
import { DCAOrdersList } from "../components/DCAOrdersList";
import { DCATradeForm } from "../components/DCATradeForm";
import { useShariaCompliance } from "../hooks/useShariaCompliance";
import { formatTokenSymbolForDisplay } from "../utils/formatTokenSymbol";
import { useShariaDCA, useDCAOrders } from "../hooks/useShariaDCA";
import { useWallet } from "../hooks/useWallet";
import { TransactionNotificationList } from "../components/TransactionNotification";
import { ConfirmModal } from "../components/ConfirmModal";
import { getFriendlyErrorMessage, isUserRejection } from "../utils/errorMessages";
import { CONTRACTS } from "../config/contracts";
import tayebCoinsData from "../../../config/tayebCoins.json";
import type { Token, TransactionNotification } from "../types";

export const DCAOrdersPage: React.FC = () => {
	const { coins, coinsLoading, coinsError } = useShariaCompliance();
	const { address, isConnected } = useWallet();
	
	// DCA hooks
	const {
		createDCAOrderWithDEV,
		createDCAOrderWithToken,
		approveToken,
		cancelDCAOrder,
		userOrderIds,
		loadingOrderIds,
		refetchUserOrders,
		isCreating,
		isApproving,
		isConfirming,
		isConfirmed,
		txHash,
		writeError,
		confirmError,
		resetWrite,
	} = useShariaDCA();
	
	const { orders, isLoading: loadingOrders, refetchOrders } = useDCAOrders(userOrderIds);

	// State management
	const [notifications, setNotifications] = useState<TransactionNotification[]>([]);
	const [currentTxId, setCurrentTxId] = useState<string | null>(null);
	const [approvalConfirmed, setApprovalConfirmed] = useState<number>(0);
	const [cancelConfirmModal, setCancelConfirmModal] = useState<{
		isOpen: boolean;
		orderId: bigint | null;
	}>({ isOpen: false, orderId: null });
	
	// Track if we're currently in an approval transaction
	const isApprovalInProgress = useMemo(() => {
		return (isApproving || isConfirming) && currentTxId?.startsWith("dca-approve-") === true;
	}, [isApproving, isConfirming, currentTxId]);

	// Format tokens: merge smart contract data with tayebCoins.json metadata
	const tokens: Token[] = useMemo(() => {
		return (coins || []).map((coin) => {
			const tayebCoins = (
				tayebCoinsData as {
					coins: Array<{
						symbol: string;
						decimals: number;
						avgSlippagePercent: number;
					}>;
				}
			).coins;
			const coinMetadata = tayebCoins.find(
				(c: { symbol: string; decimals: number; avgSlippagePercent: number }) =>
					c.symbol.toLowerCase() === coin.symbol.toLowerCase()
			);

			return {
				symbol: coin.symbol,
				name: coin.name,
				decimals: coinMetadata?.decimals ?? 18,
				description: coin.complianceReason,
				complianceReason: coin.complianceReason,
				addresses: { moonbeam: coin.tokenAddress },
				permissible: coin.verified,
				avgSlippagePercent: coinMetadata?.avgSlippagePercent,
			};
		});
	}, [coins]);

	// Handle DCA scheduling (called when user clicks schedule button)
	const handleScheduleDCA = async (data: {
		sourceToken: Token;
		targetToken: Token;
		amount: string;
		interval: "hour" | "day" | "week";
		duration: string;
	}) => {
		if (!isConnected || !address) {
			alert("Please connect your wallet first");
			return;
		}

		// Create the order (allowance is already checked in the form)
		await createOrder(data);
	};

	// Handle token approval (called from form)
	const handleApproveToken = async (token: Token, amount: bigint) => {
		if (!address) return;

		const txId = `dca-approve-${Date.now()}`;
		setCurrentTxId(txId);

		// Create approval notification
		const approvalNotification: TransactionNotification = {
			id: txId,
			status: "pending",
			type: "approve",
			message: `Approving ${formatTokenSymbolForDisplay(token.symbol)}...`,
		};
		setNotifications((prev) => [...prev, approvalNotification]);

		try {
			// Approve token (will prompt to switch network if needed)
			await approveToken(token.addresses.moonbeam as Address, amount);
		} catch (error: any) {
			// Check if user rejected the transaction
			const isRejection = isUserRejection(error);
			
			if (isRejection) {
				// User declined - show friendly message and clear notification
				setNotifications((prev) =>
					prev.map((n) =>
						n.id === txId
							? { ...n, status: "error", message: "Transaction was declined. The approval was cancelled." }
							: n
					)
				);
				// Keep notification visible briefly, then remove it after showing the error
				setTimeout(() => {
					setNotifications((prev) => prev.filter((n) => n.id !== txId));
					setCurrentTxId(null);
					resetWrite();
				}, 3000);
			} else {
				// Real error - show error message
				const friendlyMessage = getFriendlyErrorMessage(error);
				setNotifications((prev) =>
					prev.map((n) =>
						n.id === txId
							? { ...n, status: "error", message: friendlyMessage }
							: n
					)
				);
				setCurrentTxId(null);
			}
		}
	};

	// Create DCA order
	const createOrder = async (data: {
		sourceToken: Token;
		targetToken: Token;
		amount: string;
		interval: "hour" | "day" | "week";
		duration: string;
	}) => {
		const txId = `dca-create-${Date.now()}`;
		setCurrentTxId(txId);

		// Add notification
		setNotifications((prev) => [
			...prev,
			{
				id: txId,
				status: "pending",
				type: "approve",
				message: "Creating DCA order...",
			},
		]);

		// Parse values
		// PRECISION HANDLING: User enters total budget, divide by intervals with floor division
		// Option 2: Round down (floor division) + inform user about remainder
		const totalBudget = parseUnits(data.amount, data.sourceToken.decimals);
		const totalIntervals = BigInt(data.duration);
		const amountPerInterval = totalBudget / totalIntervals; // Floor division (rounds down)
		const actualTotalUsed = amountPerInterval * totalIntervals; // Actual amount that will be used
		const remainder = totalBudget - actualTotalUsed; // Remaining amount that won't be used

		// Show warning if there's a remainder (precision loss)
		if (remainder > 0n) {
			const remainderDisplay = formatUnits(remainder, data.sourceToken.decimals);
			const amountPerIntervalDisplay = formatUnits(amountPerInterval, data.sourceToken.decimals);
			console.log(
				`Note: Due to precision, ${remainderDisplay} ${formatTokenSymbolForDisplay(data.sourceToken.symbol)} ` +
				`remainder will not be used. Actual amount per interval: ${amountPerIntervalDisplay} ${formatTokenSymbolForDisplay(data.sourceToken.symbol)}`
			);
		}

		const intervalSeconds = 
			data.interval === "hour" ? BigInt(3600) :
			data.interval === "day" ? BigInt(86400) :
			BigInt(604800); // week

		// Check if source token is native GLMR
		const isNativeGLMR = data.sourceToken.symbol === "GLMR" && 
			data.sourceToken.addresses.moonbeam?.toLowerCase() === CONTRACTS.WETH.toLowerCase();

		try {
			// Create order (will prompt to switch network if needed)
			if (isNativeGLMR) {
				// Use native GLMR function (no approval needed)
				// Send totalBudget - contract will use actualTotalUsed and automatically refund remainder
				await createDCAOrderWithDEV(
					data.targetToken.addresses.moonbeam as Address,
					amountPerInterval,
					intervalSeconds,
					totalIntervals,
					totalBudget // Contract refunds remainder automatically
				);
			} else {
				// Use regular token function (requires approval)
				// Contract will transfer actualTotalUsed (amountPerInterval * totalIntervals)
				// Approval check in DCATradeForm already uses actualTotalUsed, so this is safe
				await createDCAOrderWithToken(
					data.sourceToken.addresses.moonbeam as Address,
					data.targetToken.addresses.moonbeam as Address,
					amountPerInterval,
					intervalSeconds,
					totalIntervals
				);
			}
		} catch (error: any) {
			// Network switch errors will be caught and shown in the notification
			const errorMessage = error?.message || "Failed to create DCA order";
			setNotifications((prev) =>
				prev.map((n) =>
					n.id === txId
						? { ...n, status: "error", message: errorMessage }
						: n
				)
			);
			setCurrentTxId(null);
		}
	};


	// Handle order cancellation - show confirmation modal
	const handleCancelOrder = (orderId: bigint) => {
		setCancelConfirmModal({ isOpen: true, orderId });
	};
	
	// Confirm cancellation
	const confirmCancelOrder = async () => {
		if (!cancelConfirmModal.orderId) return;

		const orderId = cancelConfirmModal.orderId;
		setCancelConfirmModal({ isOpen: false, orderId: null });

		const txId = `dca-cancel-${Date.now()}`;
		setCurrentTxId(txId);

		setNotifications((prev) => [
			...prev,
			{
				id: txId,
				status: "pending",
				type: "approve",
				message: "Cancelling DCA order...",
			},
		]);

		try {
			// Cancel order (will prompt to switch network if needed)
			await cancelDCAOrder(orderId);
		} catch (error: any) {
			// Network switch errors will be caught and shown in the notification
			const errorMessage = error?.message || "Failed to cancel DCA order";
			setNotifications((prev) =>
				prev.map((n) =>
					n.id === txId
						? { ...n, status: "error", message: errorMessage }
						: n
				)
			);
			setCurrentTxId(null);
		}
	};
	
	// Cancel confirmation modal
	const cancelConfirmModalClose = () => {
		setCancelConfirmModal({ isOpen: false, orderId: null });
	};

	// Track transaction confirmation
	useEffect(() => {
		if (isConfirmed && currentTxId) {
			console.log("✅ Transaction CONFIRMED! Updating notification to SUCCESS", { currentTxId });
			
			const isApprovalTx = currentTxId.startsWith("dca-approve-");
			const isCreateTx = currentTxId.startsWith("dca-create-");
			const isCancelTx = currentTxId.startsWith("dca-cancel-");
			
			setNotifications((prev) =>
				prev.map((n) =>
					n.id === currentTxId
						? { ...n, status: "success" as const }
						: n
				)
			);

			// If approval is confirmed, trigger form to re-check allowance
			if (isApprovalTx) {
				console.log("✅ Approval confirmed - triggering form to re-check allowance");
				setApprovalConfirmed((prev) => prev + 1);
			}

			// If order is created or cancelled, refetch user orders and order details
			if (isCreateTx || isCancelTx) {
				console.log("✅ Order transaction confirmed - refetching user orders");
				// Wait a bit for blockchain state to update, then refetch
				setTimeout(async () => {
					// Refetch order IDs first
					await refetchUserOrders();
					// Then refetch order details (contracts will also auto-update when userOrderIds changes)
					refetchOrders();
				}, 1000);
			}

			// Reset transaction ID after a delay
			setTimeout(() => {
				console.log("🔄 Resetting transaction state");
				setCurrentTxId(null);
				resetWrite();
			}, 2000);
		}
	}, [isConfirmed, currentTxId, resetWrite, refetchUserOrders, refetchOrders]);

	// Track transaction hash
	useEffect(() => {
		if (txHash && currentTxId) {
			console.log("📝 Transaction hash available:", txHash);
			setNotifications((prev) =>
				prev.map((n) =>
					n.id === currentTxId
						? { ...n, txHash }
						: n
				)
			);
		}
	}, [txHash, currentTxId]);

	// Track errors
	useEffect(() => {
		const error = writeError || confirmError;
		if (error && currentTxId) {
			const isRejection = isUserRejection(error);
			const friendlyMessage = getFriendlyErrorMessage(error);
			
			if (isRejection) {
				// User rejection
				const isApprovalTx = currentTxId.startsWith("dca-approve-");
				
				if (isApprovalTx) {
					// For approval rejections, show error message briefly
					console.log("❌ User rejected approval transaction");
					const rejectionMessage = "Transaction was declined. The approval was cancelled.";
					setNotifications((prev) =>
						prev.map((n) =>
							n.id === currentTxId
								? { ...n, status: "error", message: rejectionMessage }
								: n
						)
					);
					// Remove notification after showing error briefly
					setTimeout(() => {
						setNotifications((prev) => prev.filter((n) => n.id !== currentTxId));
						setCurrentTxId(null);
						resetWrite();
					}, 3000);
				} else {
					// For other rejections, just remove the notification without showing error
					console.log("❌ User rejected transaction");
					setNotifications((prev) =>
						prev.filter((n) => n.id !== currentTxId)
					);
					setCurrentTxId(null);
					resetWrite();
				}
			} else {
				// Real error - update notification to error
				console.log("❌ Transaction ERROR:", friendlyMessage);
				setNotifications((prev) =>
					prev.map((n) =>
						n.id === currentTxId && n.status !== "error"
							? { ...n, status: "error", message: friendlyMessage }
							: n
					)
				);
				setCurrentTxId(null);
			}
		}
	}, [writeError, confirmError, currentTxId, resetWrite]);

	// Handle notification dismissal
	const handleDismissNotification = (id: string) => {
		setNotifications((prev) => prev.filter((n) => n.id !== id));
	};

	return (
		<main className='flex flex-1 justify-center py-10 sm:py-16 px-4'>
			<div className='w-full max-w-7xl'>
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


				{/* Main Two-Column Layout */}
				{!coinsLoading && !coinsError && tokens.length > 0 && (
					<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
						{/* Left Column: Orders List */}
						<div className='order-2 lg:order-1'>
							<DCAOrdersList 
								orders={orders}
								tokens={tokens}
								isLoading={loadingOrders || loadingOrderIds}
								onCancelOrder={handleCancelOrder}
							/>
						</div>

						{/* Right Column: DCA Trade Form */}
						<div className='order-1 lg:order-2'>
							<DCATradeForm 
								tokens={tokens} 
								onSchedule={handleScheduleDCA}
								onApprove={handleApproveToken}
								isCreating={isCreating}
								isApproving={isApprovalInProgress}
								approvalConfirmed={approvalConfirmed}
							/>
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

			{/* Transaction Notifications */}
			<TransactionNotificationList
				notifications={notifications}
				onDismiss={handleDismissNotification}
			/>
			
			{/* Cancel Confirmation Modal */}
			<ConfirmModal
				isOpen={cancelConfirmModal.isOpen}
				title="Cancel DCA Order"
				message="Are you sure you want to cancel this DCA order? This action cannot be undone."
				confirmText="Yes, Cancel Order"
				cancelText="Keep Order"
				onConfirm={confirmCancelOrder}
				onCancel={cancelConfirmModalClose}
			/>
		</main>
	);
};
