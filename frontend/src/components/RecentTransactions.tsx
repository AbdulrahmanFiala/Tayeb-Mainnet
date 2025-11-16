import { useMemo } from "react";
import { formatUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { ShariaSwapABI } from "../config/abis";
import deployedContracts from "../../../config/deployedContracts.json";
import type { Address } from "viem";
import type { SwapRecord, Token } from "../types";

const SHARIA_SWAP_ADDRESS = (
	deployedContracts as unknown as { main: { shariaSwap: string } }
).main.shariaSwap as Address;

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

interface RecentTransactionsProps {
	tokens: Token[];
	maxItems?: number; // Optional: limit number of items shown (default: 5)
}

export function RecentTransactions({ tokens, maxItems = 5 }: RecentTransactionsProps) {
	const { address } = useAccount();

	// Fetch swap history from contract
	const { data: swapHistory, isLoading } = useReadContract({
		address: SHARIA_SWAP_ADDRESS,
		abi: ShariaSwapABI,
		functionName: "getUserSwapHistory",
		args: [address!],
		query: {
			enabled: !!address,
			refetchInterval: 30000, // Refetch every 30 seconds for recent tx updates
		},
	}) as {
		data: SwapRecord[] | undefined;
		isLoading: boolean;
	};

	// Filter and format recent transactions (last 24 hours)
	const recentSwaps = useMemo(() => {
		if (!swapHistory || swapHistory.length === 0) return [];

		const now = Date.now();
		const twentyFourHoursAgo = now - TWENTY_FOUR_HOURS_MS;

		// Filter swaps from last 24 hours and sort by timestamp (newest first)
		return swapHistory
			.filter((swap) => {
				const swapTimeMs = Number(swap.timestamp) * 1000;
				return swapTimeMs >= twentyFourHoursAgo;
			})
			.sort((a, b) => Number(b.timestamp - a.timestamp)) // Newest first
			.slice(0, maxItems); // Limit to maxItems
	}, [swapHistory, maxItems]);

	// Helper to find token by address
	const findTokenByAddress = (address: string) => {
		return tokens.find(
			(t) => t.addresses.moonbeam.toLowerCase() === address.toLowerCase()
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

	// Format full timestamp for tooltip
	const formatFullTime = (timestamp: bigint) => {
		return new Date(Number(timestamp) * 1000).toLocaleString();
	};

	// Format amount with appropriate decimals and show abbreviated format for large numbers
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

	if (!address) {
		return null; // Don't show if wallet not connected
	}

	if (isLoading) {
		return (
			<div className='bg-[#1a2e26] rounded-xl p-4 border border-[#23483c]'>
				<h3 className='text-lg font-semibold text-white mb-3'>
					Recent Transactions
				</h3>
				<p className='text-gray-400 text-sm'>Loading...</p>
			</div>
		);
	}

	if (!recentSwaps || recentSwaps.length === 0) {
		return (
			<div className='bg-[#1a2e26] rounded-xl p-4 border border-[#23483c]'>
				<div className='flex items-center justify-between mb-3'>
					<h3 className='text-lg font-semibold text-white'>
						Recent Transactions
					</h3>
					<span className='text-gray-400 text-xs'>Last 24 hours</span>
				</div>
				<p className='text-gray-400 text-sm'>
					No transactions in the last 24 hours
				</p>
			</div>
		);
	}

	return (
		<div className='bg-[#1a2e26] rounded-xl p-4 border border-[#23483c]'>
			<div className='flex items-center justify-between mb-3'>
				<h3 className='text-lg font-semibold text-white'>
					Recent Transactions
				</h3>
				<span className='text-gray-400 text-xs'>Last 24 hours</span>
			</div>
			<div className='space-y-2'>
				{recentSwaps.map((swap, index) => {
					const tokenIn = findTokenByAddress(swap.tokenIn);
					const tokenOut = findTokenByAddress(swap.tokenOut);
					const tokenInSymbol = swap.tokenInSymbol || tokenIn?.symbol || "?";
					const tokenOutSymbol = swap.tokenOutSymbol || tokenOut?.symbol || "?";

					return (
						<div
							key={index}
							className='bg-[#0f1e18] rounded-lg p-3 border border-[#23483c] hover:border-[#92c9b7]/50 transition-colors'
						>
							<div className='flex items-center justify-between mb-1'>
								<div className='flex items-center gap-2'>
									<span className='text-white font-medium text-sm'>
										{tokenInSymbol}
									</span>
									<span className='text-gray-500'>→</span>
									<span className='text-[#92c9b7] font-medium text-sm'>
										{tokenOutSymbol}
									</span>
								</div>
								<span
									className='text-gray-400 text-xs'
									title={formatFullTime(swap.timestamp)}
								>
									{formatRelativeTime(swap.timestamp)}
								</span>
							</div>
							<div className='flex items-center justify-between text-xs'>
								<span className='text-gray-400'>
									{formatAmount(
										swap.amountIn,
										tokenIn?.decimals || 18,
										tokenInSymbol
									)}
								</span>
								<span className='text-[#92c9b7]'>
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
		</div>
	);
}

