import { useEffect } from "react";

interface ConfirmModalProps {
	isOpen: boolean;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void;
	onCancel: () => void;
}

export function ConfirmModal({
	isOpen,
	title,
	message,
	confirmText = "Confirm",
	cancelText = "Cancel",
	onConfirm,
	onCancel,
}: ConfirmModalProps) {
	// Handle ESC key to close
	useEffect(() => {
		if (!isOpen) return;
		
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onCancel();
			}
		};
		
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [isOpen, onCancel]);

	if (!isOpen) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4"
			onClick={onCancel}
		>
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
			
			{/* Modal */}
			<div
				className="relative bg-[#1a3a2f] border border-solid border-[#23483c] rounded-xl shadow-2xl max-w-md w-full p-6 z-10"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Title */}
				<h3 className="text-white text-xl font-bold mb-4">
					{title}
				</h3>
				
				{/* Message */}
				<p className="text-white/80 text-sm mb-6 leading-relaxed">
					{message}
				</p>
				
				{/* Buttons */}
				<div className="flex gap-3 justify-end">
					<button
						onClick={onCancel}
						className="px-6 py-2.5 rounded-lg bg-[#23483c] text-white/90 hover:bg-[#2c5a4b] transition-colors font-medium"
					>
						{cancelText}
					</button>
					<button
						onClick={onConfirm}
						className="px-6 py-2.5 rounded-lg bg-primary hover:opacity-90 text-background-dark font-bold transition-opacity"
					>
						{confirmText}
					</button>
				</div>
			</div>
		</div>
	);
}

