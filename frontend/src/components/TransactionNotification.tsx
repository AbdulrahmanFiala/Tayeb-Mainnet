import { useEffect } from "react";
import type { TransactionNotification as TxNotification } from "../types";
import { CryptoTokenIcon } from "./CryptoTokenIcon";
import { formatTokenSymbolForDisplay } from "../utils/formatTokenSymbol";

interface TransactionNotificationProps {
	notification: TxNotification;
	onDismiss: (id: string) => void;
}

export function TransactionNotification({
	notification,
	onDismiss,
}: TransactionNotificationProps) {
	const { id, status, type, tokenIn, tokenOut, amountIn, amountOut, message } =
		notification;

	// Auto-dismiss success notifications after 5 seconds
	useEffect(() => {
		if (status === "success") {
			const timer = setTimeout(() => {
				onDismiss(id);
			}, 5000);

			return () => clearTimeout(timer);
		}
	}, [status, id, onDismiss]);

	const getStatusIcon = () => {
		switch (status) {
			case "pending":
				return (
					<div className='notification-spinner'>
						<div className='spinner-ring'></div>
					</div>
				);
			case "success":
				return (
					<div className='flex items-center justify-center size-8 rounded-full bg-primary/20'>
						<span className='material-symbols-outlined text-primary text-xl'>
							check
						</span>
					</div>
				);
			case "error":
				return (
					<div className='flex items-center justify-center size-8 rounded-full bg-red-500/20'>
						<span className='material-symbols-outlined text-red-500 text-xl'>
							close
						</span>
					</div>
				);
			default:
				return null;
		}
	};

	const getStatusText = () => {
		if (message) return message;

		switch (status) {
			case "pending":
				return type === "swap" ? "Swapping" : "Approving";
			case "success":
				return type === "swap" ? "Swapped" : "Approved";
			case "error":
				return type === "swap" ? "Swap Failed" : "Approval Failed";
			default:
				return "";
		}
	};

	const getTransactionDetails = () => {
		if (type === "swap" && tokenIn && tokenOut && amountIn && amountOut) {
			return `${amountIn} ${formatTokenSymbolForDisplay(tokenIn.symbol)} for ${amountOut} ${formatTokenSymbolForDisplay(tokenOut.symbol)}`;
		}
		return "";
	};

	return (
		<div
			className={`notification-toast ${status}`}
			role='alert'
			aria-live='polite'
		>
			<div className='flex items-start gap-3'>
				{/* Status Icon */}
				{getStatusIcon()}

				{/* Content */}
				<div className='flex-1 min-w-0'>
					<div className='flex items-center gap-2'>
						{/* Token Icons for Swap */}
						{type === "swap" && tokenIn && tokenOut && (
							<div className='flex items-center -space-x-1'>
								<div className='relative z-10'>
									<CryptoTokenIcon symbol={tokenIn.symbol} className="size-6" />
								</div>
								<div className='relative z-0'>
									<CryptoTokenIcon symbol={tokenOut.symbol} className="size-6" />
								</div>
							</div>
						)}

						<div className='font-bold text-white text-base'>{getStatusText()}</div>
					</div>

					{/* Transaction Details */}
					{getTransactionDetails() && (
						<div className='text-sm text-white/70 mt-1'>
							{getTransactionDetails()}
						</div>
					)}
				</div>

				{/* Close Button */}
				<button
					onClick={() => onDismiss(id)}
					className='flex items-center justify-center size-6 rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white'
					aria-label='Dismiss notification'
				>
					<span className='material-symbols-outlined text-base'>close</span>
				</button>
			</div>
		</div>
	);
}

interface TransactionNotificationListProps {
	notifications: TxNotification[];
	onDismiss: (id: string) => void;
}

export function TransactionNotificationList({
	notifications,
	onDismiss,
}: TransactionNotificationListProps) {
	return (
		<div className='notification-container'>
			{notifications.map((notification) => (
				<TransactionNotification
					key={notification.id}
					notification={notification}
					onDismiss={onDismiss}
				/>
			))}
		</div>
	);
}

