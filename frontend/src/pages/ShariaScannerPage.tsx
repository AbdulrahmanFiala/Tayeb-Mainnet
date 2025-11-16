import { useState } from "react";
import { useWallet } from "../hooks/useWallet";
import { useWalletTokenScanner } from "../hooks/useWalletTokenScanner";
import { CryptoTokenIcon } from "../components/CryptoTokenIcon";
import { formatTokenSymbolForDisplay } from "../utils/formatTokenSymbol";
import { isAddress } from "viem";
import type { Address } from "viem";
import { moonbeam } from "wagmi/chains";

type ScanMode = "connected" | "other";

export function ShariaScannerPage() {
	const { address, isConnected, isOnMoonbeam, chain } = useWallet();
	const [scanMode, setScanMode] = useState<ScanMode>("connected");
	const [customAddress, setCustomAddress] = useState("");
	const [addressError, setAddressError] = useState<string | null>(null);

	// Determine which address to scan
	const addressToScan: Address | undefined = 
		scanMode === "connected" 
			? (address as Address | undefined)
			: (customAddress as Address | undefined);

	const { scannedTokens, isScanning, error, scanWallet, summary } = 
		useWalletTokenScanner(addressToScan);
	
	const [hasScanned, setHasScanned] = useState(false);

	const handleAddressChange = (value: string) => {
		setCustomAddress(value);
		setAddressError(null);
		
		if (value && !isAddress(value)) {
			setAddressError("Invalid wallet address format");
		}
	};

	const handleScan = async () => {
		if (scanMode === "other" && !customAddress) {
			setAddressError("Please enter a wallet address");
			return;
		}

		if (scanMode === "other" && !isAddress(customAddress)) {
			setAddressError("Invalid wallet address format");
			return;
		}

		setHasScanned(false);
		setAddressError(null);
		await scanWallet();
		setHasScanned(true);
	};

	const canScan = scanMode === "connected" 
		? isConnected && isOnMoonbeam
		: isAddress(customAddress) && isOnMoonbeam;

	// Group tokens by status
	const compliantTokens = scannedTokens.filter((t) => t.status === "compliant");
	const nonCompliantTokens = scannedTokens.filter((t) => t.status === "non-compliant");
	const unknownTokens = scannedTokens.filter((t) => t.status === "unknown");

	return (
		<div className='flex flex-col min-h-screen pt-4'>
			{/* Compact Header */}
			<div className='px-4 mb-4'>
				<div className='max-w-7xl mx-auto'>
					<h1 className='text-white text-2xl font-bold mb-1'>Sharia Wallet Scanner</h1>
					<p className='text-[#92c9b7] text-sm'>Scan any wallet to check Sharia compliance status</p>
				</div>
			</div>

			{/* Compact Control Panel - Desktop Layout */}
			<div className='px-4 mb-4'>
				<div className='max-w-7xl mx-auto'>
					<div className='bg-[#19332b] border border-[#326755] rounded-xl p-4'>
						<div className='grid grid-cols-1 lg:grid-cols-12 gap-4 items-start'>
							{/* Network Info - Left Side */}
							<div className='lg:col-span-3'>
								<div className='flex items-center gap-2 mb-1'>
									<span className='material-symbols-outlined text-primary text-lg'>
										hub
									</span>
									<p className='text-white text-sm font-medium'>Network</p>
								</div>
								<p className='text-[#92c9b7] text-xs font-mono mb-1'>
									{chain?.name || "Moonbeam"}
								</p>
								<p className='text-[#92c9b7] text-xs'>
									Chain ID: {chain?.id || moonbeam.id}
								</p>
								{!isOnMoonbeam && (
									<div className='flex items-center gap-1 text-yellow-400 mt-2'>
										<span className='material-symbols-outlined text-xs'>warning</span>
										<p className='text-xs'>Switch network</p>
									</div>
								)}
							</div>

							{/* Wallet Selection - Middle */}
							<div className='lg:col-span-6 space-y-3'>
								{/* Mode Selection - Compact */}
								<div className='flex gap-2'>
									<button
										onClick={() => {
											setScanMode("connected");
											setAddressError(null);
										}}
										className={`flex-1 h-9 rounded-lg px-3 text-sm font-medium transition-colors ${
											scanMode === "connected"
												? "bg-primary text-background-dark"
												: "bg-[#23483c] text-white hover:bg-[#2a5243]"
										}`}
									>
										<div className='flex items-center justify-center gap-1.5'>
											<span className='material-symbols-outlined text-base'>account_balance_wallet</span>
											<span>Connected</span>
										</div>
									</button>
									<button
										onClick={() => {
											setScanMode("other");
											setAddressError(null);
										}}
										className={`flex-1 h-9 rounded-lg px-3 text-sm font-medium transition-colors ${
											scanMode === "other"
												? "bg-primary text-background-dark"
												: "bg-[#23483c] text-white hover:bg-[#2a5243]"
										}`}
									>
										<div className='flex items-center justify-center gap-1.5'>
											<span className='material-symbols-outlined text-base'>search</span>
											<span>Other</span>
										</div>
									</button>
								</div>

								{/* Address Display/Input - Compact */}
								{scanMode === "connected" ? (
									<div className='bg-[#23483c] rounded-lg p-3'>
										<div className='flex items-center gap-2'>
											<span className='material-symbols-outlined text-[#92c9b7] text-sm'>
												{isConnected ? "check_circle" : "cancel"}
											</span>
											<div className='flex-1 min-w-0'>
												<p className='text-[#92c9b7] text-xs mb-0.5'>Wallet</p>
												<p className='text-white font-mono text-xs truncate'>
													{isConnected
														? address
														: "Not connected"}
												</p>
											</div>
										</div>
									</div>
								) : (
									<div>
										<label className='flex flex-col'>
											<input
												type='text'
												value={customAddress}
												onChange={(e) => handleAddressChange(e.target.value)}
												placeholder='0x...'
												className='w-full h-9 px-3 rounded-lg bg-[#23483c] text-white placeholder:text-[#92c9b7]/50 border border-[#326755] focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent font-mono text-xs'
											/>
											{addressError && (
												<p className='text-red-400 text-xs mt-1 flex items-center gap-1'>
													<span className='material-symbols-outlined text-xs'>error</span>
													{addressError}
												</p>
											)}
										</label>
									</div>
								)}
							</div>

							{/* Scan Button - Right Side */}
							<div className='lg:col-span-3'>
								<button
									onClick={handleScan}
									disabled={isScanning || !canScan}
									className={`w-full h-9 rounded-lg px-4 font-bold text-sm transition-opacity flex items-center justify-center gap-2 ${
										canScan && !isScanning
											? "bg-primary text-background-dark hover:opacity-90"
											: "bg-[#23483c] text-white/50 cursor-not-allowed"
									}`}
								>
									{isScanning ? (
										<>
											<span className='material-symbols-outlined text-base animate-spin'>sync</span>
											<span>Scanning...</span>
										</>
									) : (
										<>
											<span className='material-symbols-outlined text-base'>scanner</span>
											<span>Scan</span>
										</>
									)}
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Error State */}
			{(error || addressError) && (
				<div className='px-4 mb-4'>
					<div className='max-w-7xl mx-auto'>
						<div className='p-3 bg-red-500/10 border border-red-500/30 rounded-lg'>
							<p className='text-red-400 text-sm flex items-center gap-2'>
								<span className='material-symbols-outlined text-base'>error</span>
								{error?.message || addressError}
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Not Connected State */}
			{scanMode === "connected" && !isConnected && (
				<div className='px-4'>
					<div className='max-w-7xl mx-auto'>
						<div className='flex items-center justify-center h-64'>
							<div className='text-center'>
								<span className='material-symbols-outlined text-4xl text-[#92c9b7] mb-2 block'>
									wallet
								</span>
								<p className='text-white font-medium mb-1'>Wallet Not Connected</p>
								<p className='text-[#92c9b7] text-sm'>
									Connect your wallet to scan
								</p>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Results Section */}
			<div className='px-4 pb-6'>
				<div className='max-w-7xl mx-auto'>
					{/* Loading State */}
					{isScanning && (
						<div className='flex items-center justify-center h-64'>
							<div className='text-center'>
								<span className='material-symbols-outlined text-4xl text-primary animate-spin block mb-2'>
									sync
								</span>
								<p className='text-white text-sm mb-1'>Scanning wallet...</p>
								<p className='text-[#92c9b7] text-xs'>
									Checking balances and compliance
								</p>
							</div>
						</div>
					)}

					{/* Results */}
					{!isScanning && hasScanned && scannedTokens.length === 0 && (
						<div className='flex items-center justify-center h-64'>
							<div className='text-center'>
								<span className='material-symbols-outlined text-4xl text-[#92c9b7] block mb-2'>
									check_circle
								</span>
								<p className='text-white font-medium mb-1'>No Tokens Found</p>
								<p className='text-[#92c9b7] text-sm'>
									No tokens with non-zero balances
								</p>
							</div>
						</div>
					)}

					{!isScanning && hasScanned && scannedTokens.length > 0 && (
						<div className='space-y-6'>
							{/* Scanned Wallet Info - Compact */}
							<div className='bg-[#19332b] border border-[#326755] rounded-lg p-3'>
								<div className='flex items-center gap-2'>
									<span className='material-symbols-outlined text-primary text-base'>
										account_balance_wallet
									</span>
									<div>
										<p className='text-[#92c9b7] text-xs'>Scanned Wallet</p>
										<p className='text-white font-mono text-xs'>
											{addressToScan}
										</p>
									</div>
								</div>
							</div>

							{/* Summary Cards - More Compact */}
							<div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
								<div className='bg-[#19332b] border border-[#326755] rounded-lg p-3'>
									<div className='flex items-center gap-2 mb-1'>
										<span className='material-symbols-outlined text-green-400 text-base'>
											verified
										</span>
										<p className='text-[#92c9b7] text-xs font-medium'>Compliant</p>
									</div>
									<p className='text-white text-xl font-bold'>{summary.compliant}</p>
								</div>
								<div className='bg-[#19332b] border border-[#326755] rounded-lg p-3'>
									<div className='flex items-center gap-2 mb-1'>
										<span className='material-symbols-outlined text-red-400 text-base'>cancel</span>
										<p className='text-[#92c9b7] text-xs font-medium'>Non-Compliant</p>
									</div>
									<p className='text-white text-xl font-bold'>{summary.nonCompliant}</p>
								</div>
								<div className='bg-[#19332b] border border-[#326755] rounded-lg p-3'>
									<div className='flex items-center gap-2 mb-1'>
										<span className='material-symbols-outlined text-yellow-400 text-base'>help</span>
										<p className='text-[#92c9b7] text-xs font-medium'>Unknown</p>
									</div>
									<p className='text-white text-xl font-bold'>{summary.unknown}</p>
								</div>
								<div className='bg-[#19332b] border border-[#326755] rounded-lg p-3'>
									<div className='flex items-center gap-2 mb-1'>
										<span className='material-symbols-outlined text-white text-base'>inventory_2</span>
										<p className='text-[#92c9b7] text-xs font-medium'>Total</p>
									</div>
									<p className='text-white text-xl font-bold'>{summary.total}</p>
								</div>
							</div>

							{/* Compliant Tokens */}
							{compliantTokens.length > 0 && (
								<div>
									<h2 className='text-white text-lg font-bold mb-3 flex items-center gap-2'>
										<span className='material-symbols-outlined text-green-400 text-base'>verified</span>
										Compliant Tokens ({compliantTokens.length})
									</h2>
									<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
										{compliantTokens.map((token) => (
											<TokenCard key={token.address} token={token} />
										))}
									</div>
								</div>
							)}

							{/* Unknown Tokens */}
							{unknownTokens.length > 0 && (
								<div>
									<h2 className='text-white text-lg font-bold mb-3 flex items-center gap-2'>
										<span className='material-symbols-outlined text-yellow-400 text-base'>help</span>
										Unknown Status ({unknownTokens.length})
									</h2>
									<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
										{unknownTokens.map((token) => (
											<TokenCard key={token.address} token={token} />
										))}
									</div>
								</div>
							)}

							{/* Non-Compliant Tokens */}
							{nonCompliantTokens.length > 0 && (
								<div>
									<h2 className='text-white text-lg font-bold mb-3 flex items-center gap-2'>
										<span className='material-symbols-outlined text-red-400 text-base'>cancel</span>
										Non-Compliant Tokens ({nonCompliantTokens.length})
									</h2>
									<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
										{nonCompliantTokens.map((token) => (
											<TokenCard key={token.address} token={token} />
										))}
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

interface TokenCardProps {
	token: {
		address: string;
		symbol: string;
		name: string;
		balance: string;
		status: "compliant" | "non-compliant" | "unknown";
		complianceReason?: string;
	};
}

function TokenCard({ token }: TokenCardProps) {
	const statusColors = {
		compliant: {
			bg: "bg-green-500/10",
			border: "border-green-500/30",
			badge: "bg-green-500/20 text-green-400",
			icon: "verified",
		},
		"non-compliant": {
			bg: "bg-red-500/10",
			border: "border-red-500/30",
			badge: "bg-red-500/20 text-red-400",
			icon: "cancel",
		},
		unknown: {
			bg: "bg-yellow-500/10",
			border: "border-yellow-500/30",
			badge: "bg-yellow-500/20 text-yellow-400",
			icon: "help",
		},
	};

	const status = statusColors[token.status];
	const balanceNum = parseFloat(token.balance);
	const formattedBalance =
		balanceNum >= 1000
			? balanceNum.toLocaleString(undefined, { maximumFractionDigits: 2 })
			: balanceNum.toFixed(6);

	return (
		<div
			className={`bg-[#19332b] border ${status.border} rounded-lg p-3 hover:border-opacity-60 transition-all duration-200`}
		>
			<div className='flex items-start justify-between mb-2'>
				<div className='flex items-center gap-2 min-w-0 flex-1'>
					<CryptoTokenIcon symbol={token.symbol} className='w-8 h-8 flex-shrink-0' />
					<div className='min-w-0 flex-1'>
						<p className='text-white font-bold text-sm truncate'>{formatTokenSymbolForDisplay(token.symbol)}</p>
						<p className='text-[#92c9b7] text-xs truncate'>{token.name}</p>
					</div>
				</div>
				<div
					className={`${status.badge} rounded-full px-2 py-0.5 text-xs font-medium flex items-center gap-1 flex-shrink-0`}
				>
					<span className='material-symbols-outlined text-xs'>{status.icon}</span>
					<span className='capitalize hidden sm:inline'>{token.status.replace("-", " ")}</span>
				</div>
			</div>

			<div className='space-y-1.5'>
				<div>
					<p className='text-[#92c9b7] text-xs mb-0.5'>Balance</p>
					<p className='text-white font-bold text-base'>{formattedBalance}</p>
				</div>

				{token.complianceReason && (
					<div>
						<p className='text-[#92c9b7] text-xs mb-0.5'>Reason</p>
						<p className='text-white text-xs line-clamp-2'>{token.complianceReason}</p>
					</div>
				)}

				<div>
					<p className='text-[#92c9b7] text-xs mb-0.5'>Address</p>
					<p className='text-white text-xs font-mono truncate' title={token.address}>
						{token.address === "0x0000000000000000000000000000000000000000"
							? "Native GLMR"
							: `${token.address.slice(0, 6)}...${token.address.slice(-4)}`}
					</p>
				</div>
			</div>
		</div>
	);
}

