import { useState, useEffect } from "react";
import type { SwapConfirmationData } from "../types";
import { CryptoTokenIcon } from "./CryptoTokenIcon";
import { formatTokenSymbolForDisplay } from "../utils/formatTokenSymbol";

interface SwapConfirmationModalProps {
	data: SwapConfirmationData;
	isOpen: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

export function SwapConfirmationModal({
	data,
	isOpen,
	onConfirm,
	onCancel,
}: SwapConfirmationModalProps) {
	const [showMore, setShowMore] = useState(false);
	const [isRateReversed, setIsRateReversed] = useState(false);

	// Reset rate reversal when modal opens/closes or data changes
	useEffect(() => {
		if (isOpen) {
			setIsRateReversed(false);
		}
	}, [isOpen, data.exchangeRate]);

	if (!isOpen) return null;

	const {
		tokenIn,
		tokenOut,
		amountIn,
		amountOut,
		exchangeRate,
		fee,
		slippageTolerance,
		minAmountOut,
	} = data;

	// Calculate reversed rate
	const rateValue = parseFloat(exchangeRate);
	const reversedRate = rateValue > 0 ? (1 / rateValue).toFixed(6) : "0";
	const displayRate = isRateReversed ? reversedRate : exchangeRate;
	const displayTokenIn = isRateReversed ? tokenOut : tokenIn;
	const displayTokenOut = isRateReversed ? tokenIn : tokenOut;

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
							You're swapping
						</h2>
						<button
							onClick={onCancel}
							className='flex items-center justify-center size-8 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white'
							aria-label='Close modal'
						>
							<span className='material-symbols-outlined'>close</span>
						</button>
					</div>

					{/* Token In */}
					<div className='flex items-center gap-3 mb-2'>
						<CryptoTokenIcon symbol={tokenIn.symbol} className="size-10" />
							<div>
								<div className='text-white text-2xl font-bold'>{amountIn}</div>
								<div className='text-white/60 text-sm'>{formatTokenSymbolForDisplay(tokenIn.symbol)}</div>
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

					{/* Token Out */}
					<div className='flex items-center gap-3 mb-6'>
						<CryptoTokenIcon symbol={tokenOut.symbol} className="size-10" />
							<div>
								<div className='text-white text-2xl font-bold'>{amountOut}</div>
								<div className='text-white/60 text-sm'>{formatTokenSymbolForDisplay(tokenOut.symbol)}</div>
							</div>
					</div>

					{/* Divider */}
					<div className='border-t border-white/10 mb-4'></div>

					{/* Details */}
					<div className='space-y-3 mb-4'>
					{/* Exchange Rate */}
					<div className='flex items-center justify-between text-sm'>
						<span className='text-white/70'>Exchange Rate</span>
						<div className='flex items-center gap-2'>
							<span className='text-white font-medium'>
								1 {formatTokenSymbolForDisplay(displayTokenIn.symbol)} = {displayRate} {formatTokenSymbolForDisplay(displayTokenOut.symbol)}
							</span>
							<button
								onClick={() => setIsRateReversed(!isRateReversed)}
								className='flex items-center justify-center'
								aria-label='Reverse exchange rate'
							>
								<span className='material-symbols-outlined text-white/70'>
									swap_horiz
								</span>
							</button>
						</div>
					</div>

						{/* Fee */}
						<div className='flex items-center justify-between text-sm'>
							<span className='text-white/70'>Fee (0.3%)</span>
							<span className='text-white font-medium'>{fee}</span>
						</div>
					</div>

					{/* Show More */}
					<button
						onClick={() => setShowMore(!showMore)}
						className='flex items-center justify-center gap-1 w-full py-2 text-white/70 hover:text-white text-sm transition-colors'
					>
						<span>Show {showMore ? "less" : "more"}</span>
						<span
							className={`material-symbols-outlined text-base transition-transform ${
								showMore ? "rotate-180" : ""
							}`}
						>
							expand_more
						</span>
					</button>

					{/* Additional Details */}
					{showMore && (
						<div className='space-y-3 mt-3 pt-3 border-t border-white/10'>
							{/* Min Received */}
							<div className='flex items-center justify-between text-sm'>
									<span className='text-white/70'>Minimum received</span>
								<span className='text-white font-medium'>
									{minAmountOut} {formatTokenSymbolForDisplay(tokenOut.symbol)}
								</span>
							</div>

							{/* Slippage */}
							<div className='flex items-center justify-between text-sm'>
								<span className='text-white/70'>Slippage tolerance</span>
								<span className='text-white font-medium'>
									{slippageTolerance}%
								</span>
							</div>
						</div>
					)}

					{/* Confirm Button */}
					<button
						onClick={onConfirm}
						className='mt-6 w-full flex items-center justify-center gap-2 rounded-xl h-14 px-5 bg-primary text-background-dark text-lg font-bold leading-normal tracking-wide hover:opacity-90 transition-opacity'
					>
						<span>Swap</span>
					</button>
				</div>
			</div>
		</>
	);
}

