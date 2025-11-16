import { useEffect, useMemo, useState } from "react";
import { FaExternalLinkAlt, FaCopy, FaCheck, FaWallet } from "react-icons/fa";
import { formatUnits } from "viem";
import { useAccount, useReadContract, useBlockNumber } from "wagmi";
import { ShariaSwapABI } from "../config/abis";
import deployedContracts from "../../../config/deployedContracts.json";
import tayebCoinsData from "../../../config/tayebCoins.json";
import { useShariaCompliance } from "../hooks/useShariaCompliance";
import { useWallet } from "../hooks/useWallet";
import type { Address } from "viem";
import type { SwapRecord, Token } from "../types";

interface WalletAccountModalProps {
	isOpen: boolean;
	onClose: () => void;
}

const SHARIA_SWAP_ADDRESS = (
	deployedContracts as unknown as { main: { shariaSwap: string } }
).main.shariaSwap as Address;

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function WalletAccountModal({ isOpen, onClose }: WalletAccountModalProps) {
	const { address, disconnectWallet, chain } = useWallet();
	const { address: accountAddress } = useAccount();
	const { coins, coinsLoading } = useShariaCompliance();
	const [copied, setCopied] = useState(false);
	
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

	// Fetch swap history from contract
	const { data: swapHistory, isLoading: swapHistoryLoading, refetch: refetchSwapHistory } = useReadContract({
		address: SHARIA_SWAP_ADDRESS,
		abi: ShariaSwapABI,
		functionName: "getUserSwapHistory",
		args: [accountAddress!],
		query: {
			enabled: !!accountAddress && isOpen,
			refetchInterval: 5000, // Refetch every 5 seconds for near real-time updates
		},
	}) as {
		data: SwapRecord[] | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	// Watch for new blocks to refetch swap history when transactions are confirmed
	const { data: blockNumber } = useBlockNumber({
		watch: !!accountAddress && isOpen, // Enable watching when modal is open
	});
	
	// Refetch swap history when a new block is mined (transaction might be confirmed)
	useEffect(() => {
		if (blockNumber && accountAddress && isOpen) {
			// Small delay to allow blockchain state to update after block
			const timer = setTimeout(() => {
				refetchSwapHistory();
			}, 1000);
			
			return () => clearTimeout(timer);
		}
	}, [blockNumber, accountAddress, isOpen, refetchSwapHistory]);

	// Filter and format recent transactions (last 24 hours)
	const recentSwaps = useMemo(() => {
		if (!swapHistory || swapHistory.length === 0) return [];

		const now = Date.now();
		const twentyFourHoursAgo = now - TWENTY_FOUR_HOURS_MS;

		// Filter swaps from last 24 hours and sort by timestamp (newest first)
		// Only show the most recent transaction
		return swapHistory
			.filter((swap) => {
				const swapTimeMs = Number(swap.timestamp) * 1000;
				return swapTimeMs >= twentyFourHoursAgo;
			})
			.sort((a, b) => Number(b.timestamp - a.timestamp)) // Newest first
			.slice(0, 1); // Limit to only the most recent transaction
	}, [swapHistory]);

	// Handle ESC key to close
	useEffect(() => {
		if (!isOpen) return;
		
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onClose();
			}
		};
		
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isOpen, onClose]);

	// Reset copied state when modal closes
	useEffect(() => {
		if (!isOpen) {
			setCopied(false);
		}
	}, [isOpen]);

	// Helper to find token by address
	const findTokenByAddress = (addr: string) => {
		return tokens.find(
			(t) => t.addresses.moonbeam.toLowerCase() === addr.toLowerCase()
		);
	};

	// Format relative time (e.g., "2 hours ago", "Just now")
	const formatRelativeTime = (timestamp: bigint) => {
		const swapTimeMs = Number(timestamp) * 1000;
		const now = Date.now();
		const diffMs = now - swapTimeMs;
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);

		if (diffMins < 1) return "Just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		return new Date(swapTimeMs).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	// Format amount with appropriate decimals
	const formatAmount = (amount: bigint, decimals: number, symbol: string) => {
		const formatted = formatUnits(amount, decimals);
		const num = parseFloat(formatted);
		
		// Format large numbers (e.g., 1.5M, 2.3K)
		if (num >= 1000000) {
			return `${(num / 1000000).toFixed(2)}M ${symbol}`;
		}
		if (num >= 1000) {
			return `${(num / 1000).toFixed(2)}K ${symbol}`;
		}
		
		// For smaller numbers, show more precision
		if (num >= 1) {
			return `${num.toFixed(4)} ${symbol}`;
		}
		return `${num.toFixed(6)} ${symbol}`;
	};

	const handleCopyAddress = async () => {
		if (address) {
			try {
				await navigator.clipboard.writeText(address);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			} catch (err) {
				console.error("Failed to copy address:", err);
			}
		}
	};

	const handleDisconnect = () => {
		disconnectWallet();
		onClose();
	};

	const handleViewOnExplorer = () => {
		if (address && chain) {
			// Moonbeam explorer
			const explorerUrl = `https://moonscan.io/address/${address}`;
			window.open(explorerUrl, "_blank", "noopener,noreferrer");
		}
	};

	// Open transaction on explorer (links to user's address page showing all transactions)
	const handleViewSwapOnExplorer = () => {
		if (accountAddress && chain) {
			const explorerUrl = `https://moonscan.io/address/${accountAddress}`;
			window.open(explorerUrl, "_blank", "noopener,noreferrer");
		}
	};

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4"
			onClick={onClose}
		>
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
			
			{/* Modal */}
			<div
				className="relative bg-[#1a3a2f] border border-solid border-[#23483c] rounded-xl shadow-2xl max-w-md w-full p-4 z-10"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-2">
						<FaWallet className="text-white/70" size={18} />
						<h3 className="text-white/70 text-base font-medium">
							Account
						</h3>
					</div>
					<button
						onClick={onClose}
						className="text-white/60 hover:text-white transition-colors p-1"
						aria-label="Close"
					>
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<line x1="18" y1="6" x2="6" y2="18" />
							<line x1="6" y1="6" x2="18" y2="18" />
						</svg>
					</button>
				</div>

				{/* Connection Status */}
				<div className="flex items-center justify-between mb-3">
					<p className="text-white/70 text-sm">Connected with MetaMask</p>
					<button
						onClick={handleDisconnect}
						className="px-2.5 py-1 text-xs border border-primary/30 text-primary hover:bg-primary/10 rounded-lg transition-colors"
					>
						Disconnect
					</button>
				</div>

				{/* Wallet Address Display */}
				<div className="mb-3 p-3 bg-primary/20 rounded-lg border border-primary/30">
					<p className="text-white font-mono text-sm break-all">
						{address}
					</p>
				</div>

				{/* Network Info */}
				{chain && (
					<div className="mb-3 p-2.5 bg-[#23483c] rounded-lg border border-[#23483c]">
						<p className="text-white/60 text-xs mb-0.5">Network</p>
						<p className="text-white text-sm font-medium">{chain.name}</p>
					</div>
				)}

				{/* Address Actions */}
				<div className="flex items-center justify-between">
					<button
						onClick={handleViewOnExplorer}
						className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors text-sm"
					>
						<FaExternalLinkAlt className="text-primary" size={14} />
						View on explorer
					</button>
					<button
						onClick={handleCopyAddress}
						className="flex items-center gap-1.5 text-primary hover:text-primary/80 transition-colors text-sm"
					>
						{copied ? (
							<>
								<FaCheck className="text-primary" size={14} />
								Copied!
							</>
						) : (
							<>
								Copy Address
								<FaCopy className="text-primary" size={14} />
							</>
						)}
					</button>
				</div>

				{/* Recent Transactions Section */}
				<div className="mt-4 pt-4 border-t border-[#23483c]">
					<div className="flex items-center justify-between mb-3">
						<h4 className="text-white text-sm font-medium">Recent Transaction</h4>
						{recentSwaps.length > 0 && (
							<span className="text-white/40 text-xs">Last 24 hours</span>
						)}
					</div>

					{swapHistoryLoading && !coinsLoading && tokens.length > 0 ? (
						<p className="text-white/40 text-xs">Loading transactions...</p>
					) : !coinsLoading && tokens.length > 0 && recentSwaps.length === 0 ? (
						<p className="text-white/40 text-xs">Your transactions will appear here...</p>
					) : coinsLoading || tokens.length === 0 ? null : (
						<div className="space-y-2 max-h-[300px] overflow-y-auto">
							{recentSwaps.map((swap, index) => {
								const tokenIn = findTokenByAddress(swap.tokenIn);
								const tokenOut = findTokenByAddress(swap.tokenOut);
								const tokenInSymbol = swap.tokenInSymbol || tokenIn?.symbol || "?";
								const tokenOutSymbol = swap.tokenOutSymbol || tokenOut?.symbol || "?";

								return (
									<div
										key={index}
										className="bg-[#0f1e18] rounded-lg p-2.5 border border-[#23483c] hover:border-primary/30 transition-colors"
									>
										<div className="flex items-center justify-between mb-1">
											<div className="flex items-center gap-2">
												<span className="text-white text-xs font-medium">
													{tokenInSymbol}
												</span>
												<span className="text-white/40 text-xs">→</span>
												<span className="text-primary text-xs font-medium">
													{tokenOutSymbol}
												</span>
											</div>
											<div className="flex items-center gap-2">
												<span className="text-white/40 text-xs">
													{formatRelativeTime(swap.timestamp)}
												</span>
												<button
													onClick={(e) => {
														e.stopPropagation();
														handleViewSwapOnExplorer();
													}}
													className="text-primary/60 hover:text-primary transition-colors p-0.5"
													title="View on explorer"
													aria-label="View transaction on explorer"
												>
													<FaExternalLinkAlt size={11} />
												</button>
											</div>
										</div>
										<div className="flex items-center justify-between text-xs">
											<span className="text-white/60">
												{formatAmount(
													swap.amountIn,
													tokenIn?.decimals || 18,
													tokenInSymbol
												)}
											</span>
											<span className="text-primary/80">
												{formatAmount(
													swap.amountOut,
													tokenOut?.decimals || 18,
													tokenOutSymbol
												)}
											</span>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

