import { useState, useMemo } from "react";
import { formatUnits } from "viem";
import { useBlockNumber, useReadContract } from "wagmi";
import type { DCAOrder } from "../hooks/useShariaDCA";
import type { Token } from "../types";
import { ShariaDCAABI } from "../config/abis";
import deployedContracts from "../../../config/deployedContracts.json";
import type { Address } from "viem";
import { formatTokenSymbolForDisplay } from "../utils/formatTokenSymbol";

const SHARIA_DCA_ADDRESS = (
	deployedContracts as unknown as { main: { shariaDCA: string } }
).main.shariaDCA as Address;

const HOUR_IN_SECONDS = 3600;

interface DCAOrdersListProps {
	orders: DCAOrder[];
	tokens: Token[];
	isLoading: boolean;
	onCancelOrder: (orderId: bigint) => void;
}

export function DCAOrdersList({ orders, tokens, isLoading, onCancelOrder }: DCAOrdersListProps) {
	const [activeTab, setActiveTab] = useState<"all" | "open" | "history">("all");
	const { data: currentBlockNumber } = useBlockNumber();
	
	// Read blockTime and blocksBeforeHour from contract to stay in sync
	const { data: blockTime } = useReadContract({
		address: SHARIA_DCA_ADDRESS,
		abi: ShariaDCAABI,
		functionName: "blockTime",
	});
	
	const { data: blocksBeforeHour } = useReadContract({
		address: SHARIA_DCA_ADDRESS,
		abi: ShariaDCAABI,
		functionName: "blocksBeforeHour",
	});
	
	// Use contract values with fallback to defaults (Moonbeam: 12s blocks, 2 blocks before hour)
	const BLOCK_TIME = blockTime ? Number(blockTime) : 6;
	const BLOCKS_BEFORE_HOUR = blocksBeforeHour ? Number(blocksBeforeHour) : 2;

	// Filter and sort orders based on active tab (newest first)
	const filteredOrders = useMemo(() => {
		return orders
			.filter((order) => {
				if (activeTab === "all") return true;
				if (activeTab === "open") return order.isActive;
				if (activeTab === "history") return !order.isActive;
				return true;
			})
			.sort((a, b) => {
				// Sort by startTime descending (newest first), fallback to id if startTime is same
				if (a.startTime !== b.startTime) {
					return Number(b.startTime - a.startTime);
				}
				return Number(b.id - a.id);
			});
	}, [orders, activeTab]);

	// Helper to find token by address
	const findTokenByAddress = (address: string) => {
		return tokens.find((t) => t.addresses.moonbeam.toLowerCase() === address.toLowerCase());
	};

	// Helper to format interval
	const formatInterval = (seconds: bigint) => {
		const secs = Number(seconds);
		if (secs < 3600) return `${Math.floor(secs / 60)}m`;
		if (secs < 86400) return `${Math.floor(secs / 3600)}h`;
		if (secs < 604800) return `${Math.floor(secs / 86400)}d`;
		return `${Math.floor(secs / 604800)}w`;
	};

	// Helper to get order status
	const getOrderStatus = (order: DCAOrder): "active" | "completed" | "cancelled" => {
		if (!order.isActive) {
			return order.intervalsCompleted >= order.totalIntervals ? "completed" : "cancelled";
		}
		return "active";
	};

	// Helper to get status badge className
	const getStatusBadgeClassName = (status: "active" | "completed" | "cancelled"): string => {
		return status === "active"
			? "bg-green-500/20 text-green-400"
			: status === "completed"
			? "bg-blue-500/20 text-blue-400"
			: "bg-red-500/20 text-red-400";
	};

	// Helper to capitalize status text
	const capitalizeStatus = (status: "active" | "completed" | "cancelled"): string => {
		return status.charAt(0).toUpperCase() + status.slice(1);
	};

	// Helper to process order data for display
	const processOrderData = (order: DCAOrder) => {
		const sourceToken = findTokenByAddress(order.sourceToken);
		const targetToken = findTokenByAddress(order.targetToken);
		const status = getOrderStatus(order);
		const intervalStr = formatInterval(order.interval);
		const amountStr = sourceToken 
			? formatUnits(order.amountPerInterval, sourceToken.decimals)
			: "0";
		return { sourceToken, targetToken, status, intervalStr, amountStr };
	};

	// Helper to format token pair display
	const formatTokenPair = (sourceToken: Token | undefined, targetToken: Token | undefined): string => {
		const sourceSymbol = sourceToken ? formatTokenSymbolForDisplay(sourceToken.symbol) : "?";
		const targetSymbol = targetToken ? formatTokenSymbolForDisplay(targetToken.symbol) : "?";
		return `${sourceSymbol} / ${targetSymbol}`;
	};

	// Helper to format amount display
	const formatAmount = (amountStr: string, sourceToken: Token | undefined): string => {
		const symbol = sourceToken ? formatTokenSymbolForDisplay(sourceToken.symbol) : "";
		return `${parseFloat(amountStr).toFixed(4)} ${symbol}`;
	};

	// Helper to format progress display
	const formatProgress = (intervalsCompleted: bigint, totalIntervals: bigint): string => {
		return `${intervalsCompleted.toString()} / ${totalIntervals.toString()}`;
	};

	// Helper to get tab button className
	const getTabClassName = (isActive: boolean): string => {
		return `flex-1 py-4 px-6 font-medium transition-colors ${
			isActive
				? "text-white border-b-2 border-primary"
				: "text-white/60 hover:text-white/80"
		}`;
	};

	// Helper to render inactive order placeholder
	const renderInactivePlaceholder = () => (
		<span className="text-white/40">—</span>
	);

	// Helper to check if order is ready for execution
	const isOrderReady = (order: DCAOrder): boolean => {
		if (!order.isActive) return false;
		const now = Math.floor(Date.now() / 1000);
		return Number(order.nextExecutionTime) <= now;
	};

	// Helper to get first execution time - use contract's nextExecutionTime directly
	// When intervalsCompleted === 0, nextExecutionTime is the first execution time
	// For executed orders, we can't get the original first execution time from contract,
	// so we calculate it from startTime as a fallback (though it won't account for 5-min skip for old orders)
	const getFirstExecutionTime = (order: DCAOrder): bigint => {
		// For orders that haven't executed yet, use nextExecutionTime (contract's calculated value)
		if (order.intervalsCompleted === 0n) {
			return order.nextExecutionTime;
		}
		// For executed orders, calculate from startTime (fallback - won't match contract logic for old orders)
		const startTimestamp = Number(order.startTime);
		return BigInt(((Math.floor(startTimestamp / HOUR_IN_SECONDS) + 1) * HOUR_IN_SECONDS) - (BLOCKS_BEFORE_HOUR * BLOCK_TIME));
	};

	// Helper to calculate estimated block number from timestamp
	const calculateBlockNumber = (timestamp: bigint): bigint | null => {
		if (!currentBlockNumber || BLOCK_TIME <= 0) return null;
		
		const timestampNum = Number(timestamp);
		const now = Math.floor(Date.now() / 1000);
		const diffSeconds = timestampNum - now;
		
		// Calculate blocks difference using contract's blockTime
		const blocksDiff = BigInt(Math.floor(diffSeconds / BLOCK_TIME));
		
		// Return estimated block number
		return currentBlockNumber + blocksDiff;
	};

	// Helper to format execution time with block
	const formatExecutionTimeWithBlock = (executionTime: bigint): string => {
		// Round UP to the next hour for display (the buffer is internal only)
		// This matches the contract's behavior: rounds to next hour, then subtracts blocks
		// Add buffer back to get the hour boundary (using contract values)
		const timeWithBuffer = Number(executionTime) + (BLOCKS_BEFORE_HOUR * BLOCK_TIME);
		
		// Round UP to next hour (matching contract's rounding logic)
		const roundedToHour = Math.ceil(timeWithBuffer / HOUR_IN_SECONDS) * HOUR_IN_SECONDS;
		
		const timestamp = roundedToHour * 1000;
		const now = Date.now();
		const date = new Date(timestamp);
		
		// Check if it's in the past
		const isPast = timestamp < now;
		
		// Show clean hour time (e.g., 3:00:00)
		const timeStr = date.toLocaleString(undefined, {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
		
		// Calculate block number based on the rounded hour time (not the actual execution time)
		// This ensures orders with the same displayed hour show the same block number
		const roundedExecutionTime = BigInt(roundedToHour - (BLOCKS_BEFORE_HOUR * BLOCK_TIME));
		const estimatedBlock = calculateBlockNumber(roundedExecutionTime);
		
		if (isPast) {
			// For past executions, show "Past" or the date
			if (estimatedBlock) {
				return `${timeStr} (Block ~${estimatedBlock.toString()})`;
			}
			return `${timeStr} (Past)`;
		}
		
		// For future executions, show estimated block number
		if (estimatedBlock) {
			return `${timeStr} (Block ~${estimatedBlock.toString()})`;
		}
		
		return timeStr;
	};

	return (
		<div className="flex flex-col h-full">
			<h1 className="text-white tracking-light text-[32px] font-bold leading-tight text-center pb-6">
				Your orders
			</h1>

			<div className="bg-[#1a3a2f] rounded-xl border border-solid border-[#23483c] shadow-lg flex-1 flex flex-col">
				{/* Tabs */}
				<div className="flex gap-0 border-b border-[#23483c]">
					<button
						onClick={() => setActiveTab("all")}
						className={getTabClassName(activeTab === "all")}
					>
						All
					</button>
					<button
						onClick={() => setActiveTab("open")}
						className={getTabClassName(activeTab === "open")}
					>
						Open orders
					</button>
					<button
						onClick={() => setActiveTab("history")}
						className={getTabClassName(activeTab === "history")}
					>
						Order history
					</button>
				</div>

				{/* Orders Table */}
				<div className="flex-1 overflow-auto">
					{isLoading ? (
						<div className="flex flex-col items-center justify-center h-full py-16 px-4">
							<div className="text-primary text-2xl mb-2">Loading orders...</div>
						</div>
					) : filteredOrders.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-full py-16 px-4">
							<div className="flex items-center justify-center mb-4 opacity-40">
								<svg
									width="120"
									height="120"
									viewBox="0 0 120 120"
									fill="none"
									xmlns="http://www.w3.org/2000/svg"
								>
									{/* Dinosaur icon - simple representation */}
									<path
										d="M40 80 L40 60 L50 50 L60 45 L70 50 L75 55 L80 60 L80 80 M60 45 L60 35 L65 30 L70 35 L70 45"
										stroke="currentColor"
										strokeWidth="4"
										fill="none"
										className="text-white/20"
									/>
									<circle cx="65" cy="37" r="2" fill="currentColor" className="text-white/20" />
									{/* Cup */}
									<path
										d="M85 65 L85 80 L95 80 L95 65 M90 65 L90 55 L85 55"
										stroke="currentColor"
										strokeWidth="3"
										fill="none"
										className="text-white/20"
									/>
								</svg>
							</div>
							<p className="text-white/40 text-xl font-medium mb-1">
								No recent activity
							</p>
							<p className="text-white/30 text-sm">
								Your DCA orders will appear here
							</p>
						</div>
					) : (
						<div className="hidden lg:block">
							<table className="w-full">
								<thead className="bg-[#23483c]/50 text-white/60 text-xs uppercase">
									<tr>
										<th className="text-left py-4 px-6 font-medium">
											PAY WITH / GET
										</th>
										<th className="text-left py-4 px-6 font-medium">
											INTERVAL
										</th>
										<th className="text-left py-4 px-6 font-medium">AMOUNT</th>
										<th className="text-left py-4 px-6 font-medium">PROGRESS</th>
										<th className="text-left py-4 px-6 font-medium">FIRST EXECUTION</th>
										<th className="text-left py-4 px-6 font-medium">NEXT EXECUTION</th>
										<th className="text-left py-4 px-6 font-medium">STATUS</th>
										{activeTab !== "history" && (
											<th className="text-left py-4 px-6 font-medium">ACTION</th>
										)}
									</tr>
								</thead>
								<tbody>
									{filteredOrders.map((order) => {
										const { sourceToken, targetToken, status, intervalStr, amountStr } = processOrderData(order);
										const ready = isOrderReady(order);
										const firstExecutionTime = getFirstExecutionTime(order);
										const firstExecutionStr = formatExecutionTimeWithBlock(firstExecutionTime);
										const nextExecutionWithBlockStr = formatExecutionTimeWithBlock(order.nextExecutionTime);

										return (
											<tr
												key={order.id.toString()}
												className="border-t border-[#23483c]/50 hover:bg-[#23483c]/20 transition-colors"
											>
												<td className="py-4 px-6 text-white font-medium">
													{formatTokenPair(sourceToken, targetToken)}
												</td>
												<td className="py-4 px-6 text-white/70">
													Every {intervalStr}
												</td>
												<td className="py-4 px-6 text-white/70">
													{formatAmount(amountStr, sourceToken)}
												</td>
												<td className="py-4 px-6 text-white/70">
													{formatProgress(order.intervalsCompleted, order.totalIntervals)}
												</td>
												<td className="py-4 px-6 text-white/70 text-xs">
													{order.isActive ? (
														<span>{firstExecutionStr}</span>
													) : (
														renderInactivePlaceholder()
													)}
												</td>
												<td className="py-4 px-6 text-white/70 text-xs">
													{order.isActive ? (
														<span className={ready ? "text-green-400 font-semibold" : ""}>
															{nextExecutionWithBlockStr}
														</span>
													) : (
														renderInactivePlaceholder()
													)}
												</td>
												<td className="py-4 px-6">
													<span
														className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClassName(status)}`}
													>
														{capitalizeStatus(status)}
													</span>
												</td>
												{activeTab !== "history" && (
													<td className="py-4 px-6">
														{order.isActive && (
															<button
																onClick={() => onCancelOrder(order.id)}
																className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-semibold transition-colors"
															>
																Cancel
															</button>
														)}
													</td>
												)}
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}

					{/* Mobile view for orders */}
					{!isLoading && filteredOrders.length > 0 && (
						<div className="lg:hidden p-4 space-y-3">
							{filteredOrders.map((order) => {
								const { sourceToken, targetToken, status, intervalStr, amountStr } = processOrderData(order);

								return (
									<div
										key={order.id.toString()}
										className="bg-[#23483c] rounded-lg p-4 space-y-2"
									>
										<div className="flex justify-between items-start">
											<span className="text-white font-medium">
												{formatTokenPair(sourceToken, targetToken)}
											</span>
											<span
												className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClassName(status)}`}
											>
												{capitalizeStatus(status)}
											</span>
										</div>
										<div className="flex justify-between text-sm">
											<span className="text-white/60">Interval:</span>
											<span className="text-white/80">Every {intervalStr}</span>
										</div>
										<div className="flex justify-between text-sm">
											<span className="text-white/60">Amount:</span>
											<span className="text-white/80">
												{formatAmount(amountStr, sourceToken)}
											</span>
										</div>
										<div className="flex justify-between text-sm">
											<span className="text-white/60">Progress:</span>
											<span className="text-white/80">
												{formatProgress(order.intervalsCompleted, order.totalIntervals)}
											</span>
										</div>
										{order.isActive && (
											<>
												<div className="flex justify-between text-sm">
													<span className="text-white/60">First execution:</span>
													<span className="text-white/80 text-xs">
														{formatExecutionTimeWithBlock(getFirstExecutionTime(order))}
													</span>
												</div>
												<div className="flex justify-between text-sm">
													<span className="text-white/60">Next execution:</span>
													<span className={isOrderReady(order) ? "text-green-400 font-semibold text-xs" : "text-white/80 text-xs"}>
														{formatExecutionTimeWithBlock(order.nextExecutionTime)}
													</span>
												</div>
												<button
													onClick={() => onCancelOrder(order.id)}
													className="w-full mt-2 px-3 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-sm font-semibold transition-colors"
												>
													Cancel Order
												</button>
											</>
										)}
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

