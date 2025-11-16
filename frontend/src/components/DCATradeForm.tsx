import { useState, useEffect, useMemo } from "react";
import { parseUnits, formatUnits } from "viem";
import type { Address } from "viem";
import { usePublicClient, useAccount } from "wagmi";
import type { Token, DCAConfirmationData } from "../types";
import { TokenSelector } from "./TokenSelector";
import { useTokenBalance } from "../hooks/useTokenBalance";
import { ERC20_ABI } from "../config/abis";
import { CONTRACTS } from "../config/contracts";
import deployedContracts from "../../../config/deployedContracts.json";
import { DCAConfirmationModal } from "./DCAConfirmationModal";

const SHARIA_DCA_ADDRESS = (
	deployedContracts as unknown as { main: { shariaDCA: string } }
).main.shariaDCA as Address;

interface DCATradeFormProps {
	tokens: Token[];
	isCreating?: boolean;
	isApproving?: boolean;
	approvalConfirmed?: number;
	onSchedule?: (data: {
		sourceToken: Token;
		targetToken: Token;
		amount: string;
		interval: "hour" | "day" | "week";
		duration: string;
	}) => void;
	onApprove?: (token: Token, amount: bigint) => void;
}

export function DCATradeForm({ 
	tokens, 
	isCreating = false, 
	isApproving = false,
	approvalConfirmed = 0,
	onSchedule,
	onApprove
}: DCATradeFormProps) {
	const { address } = useAccount();
	const publicClient = usePublicClient();
	
	// Constants (must be defined before use in state initializers)
	const DEFAULT_DURATION = "1";
	const INTERVAL_STORAGE_KEY = "dca-interval";
	const DEFAULT_INTERVAL: "hour" | "day" | "week" = "day";
	const VALID_INTERVALS: ("hour" | "day" | "week")[] = ["hour", "day", "week"];
	const MAX_APPROVAL = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
	const APPROVAL_CHECK_DELAY_MS = 1500;
	const ALLOWANCE_POLL_INTERVAL_MS = 2000;
	
	// Helper to check if window is available (SSR safety)
	const isWindowAvailable = (): boolean => {
		return typeof window !== "undefined";
	};
	
	// Helper to safely get token by index
	const getTokenByIndex = (index: number): Token | null => {
		return tokens.length > index ? tokens[index] : null;
	};
	
	const [sourceToken, setSourceToken] = useState<Token | null>(
		getTokenByIndex(0)
	);
	const [targetToken, setTargetToken] = useState<Token | null>(
		getTokenByIndex(1)
	);
	const [amount, setAmount] = useState<string>("");
	
	// Load interval from localStorage on mount, default to "day"
	const [interval, setInterval] = useState<"hour" | "day" | "week">(() => {
		if (isWindowAvailable()) {
			const saved = localStorage.getItem(INTERVAL_STORAGE_KEY) as "hour" | "day" | "week" | null;
			return saved && VALID_INTERVALS.includes(saved) ? saved : DEFAULT_INTERVAL;
		}
		return DEFAULT_INTERVAL;
	});
	
	// Save interval to localStorage whenever it changes
	useEffect(() => {
		if (isWindowAvailable()) {
			localStorage.setItem(INTERVAL_STORAGE_KEY, interval);
		}
	}, [interval]);
	
	const [duration, setDuration] = useState<string>(DEFAULT_DURATION);
	
	const [showConfirmationModal, setShowConfirmationModal] = useState(false);
	const [confirmationData, setConfirmationData] = useState<DCAConfirmationData | null>(null);
	
	const [needsApproval, setNeedsApproval] = useState(false);
	const [checkingAllowance, setCheckingAllowance] = useState(false);
	const [isApprovingToken, setIsApprovingToken] = useState(false);
	const [waitingForApproval, setWaitingForApproval] = useState(false);
	
	// Fetch source token balance
	const { balance: sourceBalance } = useTokenBalance(sourceToken);
	
	// Helper to get token address as Address type
	const getTokenAddress = (token: Token | null): Address | undefined => {
		return token?.addresses.moonbeam as `0x${string}` | undefined;
	};
	
	// Helper to get token symbol with fallback
	const getTokenSymbol = (token: Token | null, fallback: string = "TOKEN"): string => {
		return token?.symbol || fallback;
	};
	
	// Helper to validate numeric value (generic validation for positive numbers)
	const isValidPositiveNumber = (value: string, parseFn: (val: string) => number): boolean => {
		const numeric = parseFn(value);
		return !isNaN(numeric) && numeric > 0;
	};
	
	// Helper to validate amount
	const validateAmount = (amountValue: string): boolean => {
		return isValidPositiveNumber(amountValue, parseFloat);
	};
	
	// Helper to validate duration
	const validateDuration = (durationValue: string): boolean => {
		return isValidPositiveNumber(durationValue, parseInt);
	};
	
	// Helper to get interval button className
	const getIntervalButtonClassName = (intervalValue: "hour" | "day" | "week"): string => {
		return `flex-1 py-3 rounded-lg font-bold transition-colors ${
			interval === intervalValue
				? "bg-primary text-background-dark"
				: "bg-[#23483c] text-white/70 hover:bg-[#2c5a4b]"
		}`;
	};
	
	// Helper to get button base className
	const getButtonBaseClassName = (): string => {
		return "w-full py-4 rounded-xl bg-primary hover:opacity-90 text-background-dark font-bold text-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed";
	};
	
	// Helper to format balance display
	const formatBalance = (balance: string | null | undefined): string => {
		return balance ? parseFloat(balance).toFixed(6) : "0.000000";
	};
	
	// Helper to handle amount input change (sanitize decimal input)
	const handleAmountChange = (value: string): string => {
		let newValue = value.replace(/[^\d.]/g, "");
		const parts = newValue.split(".");
		if (parts.length > 2) {
			newValue = parts[0] + "." + parts.slice(1).join("");
		}
		return newValue;
	};
	
	// Helper to get number input base className (for hiding spinner)
	const getNumberInputClassName = (additionalClasses: string = ""): string => {
		const baseClasses = "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
		return additionalClasses ? `${baseClasses} ${additionalClasses}` : baseClasses;
	};
	
	// Helper to get section header className
	const getSectionHeaderClassName = (): string => {
		return "text-white/60 text-xs uppercase font-medium mb-3";
	};
	
	// Helper to get section container className
	const getSectionContainerClassName = (): string => {
		return "bg-[#23483c] rounded-lg p-4";
	};
	
	// Helper to check if any transaction is in progress
	const isTransactionInProgress = (): boolean => {
		return isApprovingToken || isApproving || isCreating || checkingAllowance;
	};
	
	// Helper to reset approval state
	const resetApprovalState = () => {
		setNeedsApproval(false);
	};
	
	// Helper to reset approval transaction state
	const resetApprovalTransactionState = () => {
		setIsApprovingToken(false);
		setWaitingForApproval(false);
	};
	
	// Helper to check if two tokens have the same address
	const areTokensEqual = (token1: Token | null, token2: Token | null): boolean => {
		return token1?.addresses.moonbeam === token2?.addresses.moonbeam;
	};
	
	// Check token allowance
	const checkAllowance = async () => {
		if (!hasAllowanceCheckFields() || !validateAmount(amount)) {
			resetApprovalState();
			return;
		}

		try {
			setCheckingAllowance(true);
			
			// At this point, hasAllowanceCheckFields() ensures these are non-null
			if (!sourceToken || !address || !publicClient) {
				resetApprovalState();
				return;
			}
			
			// Native DEV doesn't need approval - skip check
			const isNativeGLMR = sourceToken.symbol === "GLMR" && 
				sourceToken.addresses.moonbeam?.toLowerCase() === CONTRACTS.WETH.toLowerCase();

			if (isNativeGLMR) {
				setNeedsApproval(false);
				return;
			}
			
			// Calculate total amount needed (amount is total budget per form label "FOR TOTAL BUDGET")
			// The contract will transfer amountPerInterval * totalIntervals, so calculate that
			const totalBudget = parseUnits(amount, sourceToken.decimals);
			const totalIntervals = BigInt(duration || DEFAULT_DURATION);
			const amountPerInterval = totalBudget / totalIntervals;
			// Calculate what contract will actually transfer (may be slightly less than totalBudget due to division)
			const totalAmount = amountPerInterval * totalIntervals;
			
			const tokenAddress = getTokenAddress(sourceToken);
			if (!tokenAddress) {
				resetApprovalState();
				return;
			}
			
			const allowance = await publicClient.readContract({
				address: tokenAddress,
				abi: ERC20_ABI,
				functionName: "allowance",
				args: [address, SHARIA_DCA_ADDRESS],
			}) as bigint;

			setNeedsApproval(allowance < totalAmount);
		} catch (err) {
			setNeedsApproval(true); // Assume needs approval on error
		} finally {
			setCheckingAllowance(false);
		}
	};

	// Check allowance whenever relevant dependencies change
	useEffect(() => {
		checkAllowance();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [sourceToken, amount, duration, address, publicClient]);

	// Immediately re-check allowance when approval is confirmed
	useEffect(() => {
		if (approvalConfirmed > 0 && hasAllowanceCheckFields()) {
			// Check immediately
			checkAllowance();
			// Also check after a short delay to account for blockchain state propagation
			const timeout = window.setTimeout(() => {
				checkAllowance();
				setWaitingForApproval(false);
			}, APPROVAL_CHECK_DELAY_MS);
			return () => window.clearTimeout(timeout);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [approvalConfirmed, sourceToken, amount, duration, address, publicClient]);

	// Re-check allowance after approval transaction is sent (poll until confirmed)
	useEffect(() => {
		// Only poll when we're waiting for approval confirmation
		if (!waitingForApproval || isApprovingToken || !hasAllowanceCheckFields()) {
			return;
		}

		// Poll allowance every 2 seconds after approval is sent
		const pollInterval = window.setInterval(async () => {
			await checkAllowance();
		}, ALLOWANCE_POLL_INTERVAL_MS);

		return () => window.clearInterval(pollInterval);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [waitingForApproval, isApprovingToken, sourceToken, amount, duration, address, publicClient]);

	// Stop waiting when allowance is sufficient
	useEffect(() => {
		if (!needsApproval && waitingForApproval) {
			setWaitingForApproval(false);
		}
	}, [needsApproval, waitingForApproval]);

	// Reset waiting state when amount/token changes
	useEffect(() => {
		setWaitingForApproval(false);
	}, [sourceToken, amount, duration]);

	const isValid = (): boolean => {
		if (!sourceToken || !targetToken || !amount || !duration) return false;
		if (!validateAmount(amount) || !validateDuration(duration)) return false;
		if (areTokensEqual(sourceToken, targetToken)) return false;
		return true;
	};
	
	// Helper to check if form has basic required fields for allowance check
	const hasAllowanceCheckFields = (): boolean => {
		return !!(sourceToken && amount && duration && address && publicClient);
	};
	
	// Helper to check if form has basic required fields
	const hasRequiredFields = (): boolean => {
		return !!(sourceToken && targetToken && amount && duration && address);
	};

	const handleSchedule = () => {
		if (!isValid() || !sourceToken || !targetToken || !precisionInfo) {
			alert("Please fill in all fields with valid values");
			return;
		}

		// Calculate interval seconds
		const intervalSeconds = 
			interval === "hour" ? 3600 :
			interval === "day" ? 86400 :
			604800; // week

		// Prepare confirmation data
		const data: DCAConfirmationData = {
			sourceToken,
			targetToken,
			totalBudget: amount,
			amountPerInterval: precisionInfo.amountPerIntervalDisplay,
			actualTotalUsed: precisionInfo.actualTotalUsedDisplay,
			remainder: precisionInfo.remainderDisplay,
			totalIntervals: precisionInfo.totalIntervals,
			interval,
			intervalSeconds,
		};

		setConfirmationData(data);
		setShowConfirmationModal(true);
	};

	const handleConfirmSchedule = () => {
		setShowConfirmationModal(false);
		
		if (!sourceToken || !targetToken) return;

		// Actually call onSchedule to create the order
		onSchedule?.({
			sourceToken,
			targetToken,
			amount,
			interval,
			duration,
		});
	};

	const handleCancelConfirmation = () => {
		setShowConfirmationModal(false);
		setConfirmationData(null);
	};

	// Helper to check if approval can proceed (simpler check than hasRequiredFields)
	const canApprove = (): boolean => {
		return !!(sourceToken && amount && address);
	};
	
	const handleApproveToken = async () => {
		if (!canApprove()) return;

		try {
			setIsApprovingToken(true);
			setWaitingForApproval(true);
			
			// Approve maximum amount to avoid future approvals
			// canApprove() ensures sourceToken is not null
			if (sourceToken) {
				onApprove?.(sourceToken, MAX_APPROVAL);
			}
			
			// Reset approving state - transaction is sent, now waiting for confirmation
			setIsApprovingToken(false);
		} catch (err) {
			resetApprovalTransactionState();
		}
	};

	// Helper to handle token swap when same token is selected
	const handleTokenSwap = (newToken: Token, currentOtherToken: Token | null, setOtherToken: (token: Token | null) => void) => {
		if (areTokensEqual(newToken, currentOtherToken)) {
			setOtherToken(null); // Clear the other token to prevent same token selection
		}
	};
	
	const handleSourceTokenChange = (token: Token) => {
		setSourceToken(token);
		handleTokenSwap(token, targetToken, setTargetToken);
	};

	const handleTargetTokenChange = (token: Token) => {
		setTargetToken(token);
		handleTokenSwap(token, sourceToken, setSourceToken);
	};
	
	// Helper to swap source and target tokens
	const handleSwapTokens = () => {
		const tempToken = sourceToken;
		setSourceToken(targetToken);
		setTargetToken(tempToken);
	};
	
	// Helper to format amount with smart decimal places
	const formatAmountSmart = (amountStr: string, decimals: number): string => {
		const num = parseFloat(amountStr);
		if (num === 0) return "0";
		
		// For very small amounts, show more decimals
		if (num < 0.000001) {
			return num.toExponential(2);
		}
		
		// For amounts >= 1, show up to 6 decimals
		if (num >= 1) {
			return num.toFixed(6).replace(/\.?0+$/, "");
		}
		
		// For amounts < 1, show significant digits
		const fixed = num.toFixed(decimals);
		return fixed.replace(/\.?0+$/, "");
	};

	// Calculate actual amount per interval and remainder (for display)
	const precisionInfo = useMemo(() => {
		if (!sourceToken || !amount || !duration || !validateAmount(amount) || !validateDuration(duration)) {
			return null;
		}

		try {
			const totalBudget = parseUnits(amount, sourceToken.decimals);
			const totalIntervals = BigInt(duration);
			const amountPerInterval = totalBudget / totalIntervals; // Floor division
			const actualTotalUsed = amountPerInterval * totalIntervals;
			const remainder = totalBudget - actualTotalUsed;

			const amountPerIntervalStr = formatUnits(amountPerInterval, sourceToken.decimals);
			const remainderStr = remainder > 0n ? formatUnits(remainder, sourceToken.decimals) : null;
			const actualTotalUsedStr = formatUnits(actualTotalUsed, sourceToken.decimals);

			return {
				amountPerInterval,
				actualTotalUsed,
				remainder,
				amountPerIntervalDisplay: formatAmountSmart(amountPerIntervalStr, sourceToken.decimals),
				remainderDisplay: remainderStr ? formatAmountSmart(remainderStr, sourceToken.decimals) : null,
				actualTotalUsedDisplay: formatAmountSmart(actualTotalUsedStr, sourceToken.decimals),
				totalIntervals: parseInt(duration),
			};
		} catch {
			return null;
		}
	}, [sourceToken, amount, duration]);

	// Helper to get button text based on state
	const getButtonText = (): string => {
		if (needsApproval) {
			if (isApprovingToken || isApproving) return "APPROVING...";
			if (checkingAllowance) return "CHECKING...";
			return `APPROVE ${getTokenSymbol(sourceToken)}`;
		}
		if (isCreating) return "CREATING...";
		if (checkingAllowance) return "CHECKING...";
		return "SCHEDULE DCA ORDERS";
	};

	return (
		<div className="flex flex-col h-full">
			<h1 className="text-white tracking-light text-[32px] font-bold leading-tight text-center pb-6">
				Trade DCA
			</h1>

			<div className="bg-[#1a3a2f] p-4 sm:p-6 rounded-xl border border-solid border-[#23483c] shadow-lg flex-1 flex flex-col">
				{/* FOR TOTAL BUDGET Section */}
				<div className="mb-4">
					<p className={getSectionHeaderClassName()}>
						FOR TOTAL BUDGET
					</p>
					<div className={getSectionContainerClassName()}>
						<div className="flex justify-between items-center mb-2">
							<p className="text-white/80 text-sm font-medium">
								Balance: {formatBalance(sourceBalance)} {getTokenSymbol(sourceToken, "")}
							</p>
						</div>
						<div className="flex items-center gap-4">
							<input
								type="text"
								inputMode="decimal"
								value={amount}
								onChange={(e) => setAmount(handleAmountChange(e.target.value))}
								className={`flex-1 w-full bg-transparent text-white text-3xl font-medium placeholder:text-white/40 focus:outline-none ring-0 border-none p-0 ${getNumberInputClassName()}`}
								placeholder="0"
							/>
							<TokenSelector
								selectedToken={sourceToken}
								tokens={tokens}
								onTokenChange={handleSourceTokenChange}
							/>
						</div>
					</div>
				</div>

				{/* Swap Direction Button */}
				<div className="flex justify-center items-center h-0 z-10 relative">
					<button
						type="button"
						onClick={handleSwapTokens}
						className="flex items-center justify-center size-12 bg-[#23483c] border-4 border-solid border-[#1a3a2f] rounded-full text-primary hover:bg-[#2c5a4b] transition-colors"
					>
						<span className="material-symbols-outlined">arrow_downward</span>
					</button>
				</div>

				{/* GET Section */}
				<div className="mb-4">
					<p className={getSectionHeaderClassName()}>GET</p>
					<div className={getSectionContainerClassName()}>
						<div className="flex items-center justify-end">
							<TokenSelector
								selectedToken={targetToken}
								tokens={tokens}
								onTokenChange={handleTargetTokenChange}
							/>
						</div>
					</div>
				</div>

				{/* Over the period of Section */}
				<div className="mb-6">
					<p className="text-white/60 text-sm mb-3">Over the period of</p>
					<div className="flex items-center gap-4 mb-4">
						<input
							type="number"
							value={duration}
							onChange={(e) => setDuration(e.target.value)}
							min="1"
							className={`flex-1 bg-[#23483c] text-white text-2xl font-medium rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 ${getNumberInputClassName()}`}
						/>
					</div>
					<div className="flex gap-2">
						{VALID_INTERVALS.map((intervalValue) => (
							<button
								key={intervalValue}
								onClick={() => setInterval(intervalValue)}
								className={getIntervalButtonClassName(intervalValue)}
							>
								{intervalValue.toUpperCase()}
							</button>
						))}
					</div>
				</div>

				{/* Schedule/Approve Button */}
				<div className="pt-4">
					{needsApproval ? (
						<button
							onClick={handleApproveToken}
							disabled={
								isTransactionInProgress() ||
								!hasRequiredFields() ||
								!validateAmount(amount)
							}
							className={getButtonBaseClassName()}
						>
							{getButtonText()}
						</button>
					) : (
						<button
							onClick={handleSchedule}
							disabled={
								isTransactionInProgress() ||
								!isValid()
							}
							className={getButtonBaseClassName()}
						>
							{getButtonText()}
						</button>
					)}
				</div>
			</div>

			{/* DCA Confirmation Modal */}
			{confirmationData && (
				<DCAConfirmationModal
					data={confirmationData}
					isOpen={showConfirmationModal}
					onConfirm={handleConfirmSchedule}
					onCancel={handleCancelConfirmation}
				/>
			)}
		</div>
	);
}

