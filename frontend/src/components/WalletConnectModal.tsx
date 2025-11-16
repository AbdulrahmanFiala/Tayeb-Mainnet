import { useEffect, useState } from "react";
import { useWallet } from "../hooks/useWallet";
import type { Connector } from "wagmi";

interface WalletConnectModalProps {
	isOpen: boolean;
	onClose: () => void;
}

// Wallet metadata for display
const getWalletInfo = (connector: Connector) => {
	const name = connector.name.toLowerCase();
	
	// Determine wallet type and icon
	if (name.includes("metamask") || connector.id === "injected") {
		return {
			name: "MetaMask",
			icon: (
				<img 
					src="https://images.ctfassets.net/clixtyxoaeas/4rnpEzy1ATWRKVBOLxZ1Fm/a74dc1eed36d23d7ea6030383a4d5163/MetaMask-icon-fox.svg" 
					alt="MetaMask" 
					width="32" 
					height="32"
					style={{ borderRadius: "6px" }}
				/>
			),
			description: "Connect using MetaMask browser extension",
		};
	}
	
	if (name.includes("coinbase") || name.includes("coinbasewallet")) {
		return {
			name: "Coinbase Wallet",
			icon: (
				<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
					<rect width="32" height="32" rx="6" fill="#0052FF"/>
					<path d="M16 8C11.58 8 8 11.58 8 16C8 20.42 11.58 24 16 24C20.42 24 24 20.42 24 16C24 11.58 20.42 8 16 8ZM16 22C13.79 22 12 20.21 12 18C12 15.79 13.79 14 16 14C18.21 14 20 15.79 20 18C20 20.21 18.21 22 16 22Z" fill="white"/>
				</svg>
			),
			description: "Connect using Coinbase Wallet",
		};
	}
	
	if (name.includes("walletconnect") || connector.id === "walletConnect") {
		return {
			name: "WalletConnect",
			icon: (
				<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
					<rect width="32" height="32" rx="6" fill="#3B99FC"/>
					<path d="M16 10C12.69 10 10 12.69 10 16C10 19.31 12.69 22 16 22C19.31 22 22 19.31 22 16C22 12.69 19.31 10 16 10Z" fill="white"/>
				</svg>
			),
			description: "Scan QR code with your mobile wallet",
		};
	}
	
	// Default fallback
	return {
		name: connector.name || "Wallet",
		icon: (
			<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
				<rect width="32" height="32" rx="6" fill="#40c399"/>
				<path d="M10 12H22V20H10V12ZM12 14V18H20V14H12Z" fill="white"/>
			</svg>
		),
		description: `Connect using ${connector.name}`,
	};
};

// Check if wallet is installed/available
const isWalletInstalled = (connector: Connector) => {
	if (connector.id === "injected") {
		return typeof window !== "undefined" && 
			(window.ethereum !== undefined || 
			 (window as any).web3 !== undefined);
	}
	// WalletConnect and Coinbase are always available
	return true;
};

export function WalletConnectModal({ isOpen, onClose }: WalletConnectModalProps) {
	const { connectors, connectWallet, isConnected, connectError, isConnecting } = useWallet();
	const [connectingId, setConnectingId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Close modal when connected
	useEffect(() => {
		if (isConnected && isOpen) {
			onClose();
		}
	}, [isConnected, isOpen, onClose]);

	// Handle connection errors from wagmi
	useEffect(() => {
		if (connectError) {
			// Check if it's a user rejection
			const errorMessage = connectError.message || "";
			const errorName = connectError.name || "";
			const errorCode = (connectError as any)?.code;
			
			if (
				errorMessage.toLowerCase().includes("rejected") ||
				errorMessage.toLowerCase().includes("denied") ||
				errorMessage.toLowerCase().includes("user rejected") ||
				errorName === "UserRejectedRequestError" ||
				errorCode === 4001 ||
				errorCode === "ACTION_REJECTED"
			) {
				setError("Connection request was rejected. Please try again.");
			} else {
				setError(connectError.message || "Failed to connect wallet. Please try again.");
			}
			setConnectingId(null);
		}
	}, [connectError]);

	// Reset connecting state when connection is no longer pending
	useEffect(() => {
		if (!isConnecting) {
			// Clear connecting state when connection attempt finishes (success or failure)
			setConnectingId(null);
		}
	}, [isConnecting]);

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

	// Reset state when modal opens
	useEffect(() => {
		if (isOpen) {
			setConnectingId(null);
			setError(null);
		}
	}, [isOpen]);

	// Clear error when user tries to connect again
	const handleConnect = async (connector: Connector) => {
		setError(null);
		setConnectingId(connector.id);
		try {
			connectWallet(connector);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to connect wallet");
			setConnectingId(null);
		}
	};

	if (!isOpen) return null;

	// Filter to only show MetaMask
	const availableConnectors = connectors.filter((connector) => {
		const name = connector.name.toLowerCase();
		// Only include MetaMask (injected connector)
		return (
			name.includes("metamask") ||
			connector.id === "injected"
		);
	});

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center p-4"
			onClick={onClose}
		>
			{/* Backdrop */}
			<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
			
			{/* Modal */}
			<div
				className="relative bg-[#1a3a2f] border border-solid border-[#23483c] rounded-xl shadow-2xl max-w-md w-full p-6 z-10"
				onClick={(e) => e.stopPropagation()}
			>
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<h3 className="text-white text-xl font-bold">
						Connect Wallet
					</h3>
					<button
						onClick={onClose}
						className="text-white/60 hover:text-white transition-colors p-1"
						aria-label="Close"
					>
						<svg
							width="24"
							height="24"
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

				{/* Description */}
				<p className="text-white/70 text-sm mb-6">
					Choose a wallet to connect to your account
				</p>

				{/* Error Message */}
				{error && (
					<div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
						<p className="text-red-400 text-sm">{error}</p>
					</div>
				)}

				{/* Wallet List */}
				<div className="space-y-2 mb-6">
					{availableConnectors.length === 0 ? (
						<div className="text-center py-8">
							<p className="text-white/60 text-sm">
								No wallets available. Please install a wallet extension.
							</p>
						</div>
					) : (
						availableConnectors.map((connector) => {
							const walletInfo = getWalletInfo(connector);
							const isInstalled = isWalletInstalled(connector);
							const isConnectingThis = isConnecting && connectingId === connector.id;

							return (
								<button
									key={connector.id}
									onClick={() => handleConnect(connector)}
									disabled={isConnectingThis || !isInstalled}
									className={`
										w-full flex items-center gap-4 p-4 rounded-lg border transition-all
										${isConnectingThis
											? "bg-[#23483c] border-primary cursor-wait"
											: isInstalled
												? "bg-[#23483c] border-[#23483c] hover:border-primary hover:bg-[#2c5a4b] cursor-pointer"
												: "bg-[#1a2f26] border-[#1a2f26] opacity-50 cursor-not-allowed"
										}
									`}
								>
									{/* Wallet Icon */}
									<div className="flex-shrink-0">
										{walletInfo.icon}
									</div>

									{/* Wallet Info */}
									<div className="flex-1 text-left">
										<div className="flex items-center gap-2">
											<span className="text-white font-medium">
												{walletInfo.name}
											</span>
											{!isInstalled && (
												<span className="text-xs text-white/50 bg-white/10 px-2 py-0.5 rounded">
													Not installed
												</span>
											)}
										</div>
										<p className="text-white/60 text-xs mt-1">
											{walletInfo.description}
										</p>
									</div>

									{/* Loading/Arrow Icon */}
									<div className="flex-shrink-0">
										{isConnectingThis ? (
											<div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
										) : (
											<svg
												width="20"
												height="20"
												viewBox="0 0 20 20"
												fill="none"
												className="text-white/40"
											>
												<path
													d="M7.5 5L12.5 10L7.5 15"
													stroke="currentColor"
													strokeWidth="2"
													strokeLinecap="round"
													strokeLinejoin="round"
												/>
											</svg>
										)}
									</div>
								</button>
							);
						})
					)}
				</div>

				{/* Footer */}
				<div className="pt-4 border-t border-[#23483c]">
					<p className="text-white/50 text-xs text-center">
						New to Crypto?{" "}
						<a
							href="https://moonbeam.network/news/how-to-create-a-moonbeam-ethereum-address/"
							target="_blank"
							rel="noopener noreferrer"
							className="text-primary hover:underline"
						>
							Learn more about wallets
						</a>
					</p>
				</div>
			</div>
		</div>
	);
}

