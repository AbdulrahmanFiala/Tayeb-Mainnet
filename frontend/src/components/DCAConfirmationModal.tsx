import type { DCAConfirmationData } from "../types";
import { CryptoTokenIcon } from "./CryptoTokenIcon";

interface DCAConfirmationModalProps {
	data: DCAConfirmationData;
	isOpen: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

export function DCAConfirmationModal({
	data,
	isOpen,
	onConfirm,
	onCancel,
}: DCAConfirmationModalProps) {
	if (!isOpen) return null;

	const {
		sourceToken,
		targetToken,
		totalBudget,
		amountPerInterval,
		actualTotalUsed,
		remainder,
		totalIntervals,
		interval,
	} = data;

	// Format interval label
	const intervalLabel = totalIntervals > 1 
		? `${totalIntervals} ${interval}s`
		: `1 ${interval}`;

	return (
		<>
			{/* Overlay */}
			<div
				className='modal-overlay'
				onClick={onCancel}
			/>

			{/* Modal */}
			<div className='modal-container'>
				<div className='modal-card'>
					{/* Header */}
					<div className='flex items-center justify-between mb-4'>
						<h2 className='text-white text-xl font-bold'>
							Confirm DCA Order
						</h2>
						<button
							onClick={onCancel}
							className='flex items-center justify-center size-8 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white'
							aria-label='Close modal'
						>
							<span className='material-symbols-outlined'>close</span>
						</button>
					</div>

					{/* Source Token (Total Budget) */}
					<div className='flex items-center gap-3 mb-2'>
						<CryptoTokenIcon symbol={sourceToken.symbol} className="size-10" />
						<div className="flex-1">
							<div className='text-white text-2xl font-bold'>{totalBudget}</div>
							<div className='text-white/60 text-sm'>{formatTokenSymbolForDisplay(sourceToken.symbol)} Total Budget</div>
						</div>
					</div>

					{/* Arrow Down */}
					<div className='flex justify-center my-3'>
						<div className='flex items-center justify-center size-10 rounded-full bg-[#23483c]'>
							<span className='material-symbols-outlined text-primary'>
								arrow_downward
							</span>
						</div>
					</div>

					{/* Target Token */}
					<div className='flex items-center gap-3 mb-6'>
						<CryptoTokenIcon symbol={targetToken.symbol} className="size-10" />
						<div className="flex-1">
							<div className='text-white text-2xl font-bold'>{formatTokenSymbolForDisplay(targetToken.symbol)}</div>
							<div className='text-white/60 text-sm'>Target token</div>
						</div>
					</div>

					{/* Divider */}
					<div className='border-t border-white/10 mb-4'></div>

					{/* Details */}
					<div className='space-y-3 mb-4'>
						{/* Duration */}
						<div className='flex items-center justify-between text-sm'>
							<span className='text-white/70'>Duration</span>
							<span className='text-white font-medium'>
								{intervalLabel}
							</span>
						</div>

						{/* Amount Per Interval */}
						<div className='flex items-center justify-between text-sm'>
							<span className='text-white/70'>Amount per interval</span>
							<span className='text-white font-medium'>
								{amountPerInterval} {formatTokenSymbolForDisplay(sourceToken.symbol)}
							</span>
						</div>

						{/* Total Amount Used */}
						<div className='flex items-center justify-between text-sm'>
							<span className='text-white/70'>Total amount used</span>
							<span className='text-white font-medium'>
								{actualTotalUsed} {formatTokenSymbolForDisplay(sourceToken.symbol)}
							</span>
						</div>
					</div>

					{/* Remainder Info */}
					{remainder && parseFloat(remainder) > 0 && (
						<div className='mb-4 p-3 bg-yellow-400/10 border border-yellow-400/20 rounded-lg'>
							<div className='flex items-start gap-2'>
								<span className='text-yellow-400 text-base leading-none self-start pt-0.5'>ℹ️</span>
								<div className='flex-1'>
									<p className='text-yellow-400/90 text-xs font-medium mb-1'>
										Precision Adjustment
									</p>
									<p className='text-yellow-400/70 text-xs leading-relaxed'>
										A small remainder of{" "}
										<span className='font-semibold text-yellow-400/90'>
											{remainder} {formatTokenSymbolForDisplay(sourceToken.symbol)}
										</span>{" "}
										will remain unused due to integer division. This amount will stay in your wallet.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* Perfect Divisibility Message */}
					{(!remainder || parseFloat(remainder) === 0) && (
						<div className='mb-4 p-3 bg-green-400/10 border border-green-400/20 rounded-lg'>
							<div className='flex items-center gap-2'>
								<span className='text-green-400 text-base'>✓</span>
								<p className='text-green-400/90 text-xs'>
									Perfect! Your budget is evenly divisible across all intervals.
								</p>
							</div>
						</div>
					)}

					{/* Confirm Button */}
					<button
						onClick={onConfirm}
						className='mt-6 w-full flex items-center justify-center gap-2 rounded-xl h-14 px-5 bg-primary text-background-dark text-lg font-bold leading-normal tracking-wide hover:opacity-90 transition-opacity'
					>
						<span>Schedule DCA Order</span>
					</button>
				</div>
			</div>
		</>
	);
}

