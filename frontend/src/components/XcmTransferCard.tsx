import { useEffect, useMemo, useState } from "react";
import { assets, EvmBuilder, isForeignAsset } from "@paraspell/sdk";
import type { TAssetInfo } from "@paraspell/sdk";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { moonbeam } from "wagmi/chains";

export function XcmTransferCard() {
	const { address: evmAddress, isConnected, chain } = useAccount();
	const { switchChainAsync } = useSwitchChain();
	const { data: walletClient } = useWalletClient();

	const [destinationChain] = useState("Hydration" as const);
	const [currencyOptionId, setCurrencyOptionId] = useState<string>("");
	const [recipient, setRecipient] = useState<string>("");
	const [amount, setAmount] = useState<string>("");
	const [confirmRecipient, setConfirmRecipient] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [txHash, setTxHash] = useState<string | null>(null);

	const supportedAssets = useMemo(
		() => assets.getSupportedAssets("Moonbeam", destinationChain),
		[destinationChain]
	);

	const currencyMap = useMemo(() => {
		return supportedAssets.reduce(
			(map: Record<string, TAssetInfo>, asset) => {
				const key = `${asset.symbol ?? "NO_SYMBOL"}-${"assetId" in asset ? asset.assetId : "Location"}`;
				map[key] = asset;
				return map;
			},
			{}
		);
	}, [supportedAssets]);

	useEffect(() => {
		if (supportedAssets.length > 0 && !currencyOptionId) {
			const last = supportedAssets[supportedAssets.length - 1];
			const key = `${last.symbol ?? "NO_SYMBOL"}-${"assetId" in last ? last.assetId : "Location"}`;
			setCurrencyOptionId(key);
		}
	}, [supportedAssets, currencyOptionId]);

	const onSubmit = async () => {
		setError(null);
		setTxHash(null);

		if (!isConnected || !walletClient) {
			setError("Connect MetaMask first");
			return;
		}
		if (!recipient) {
			setError("Recipient address is required");
			return;
		}
		if (!confirmRecipient) {
			setError("Please confirm the recipient address is yours");
			return;
		}
		if (!amount || Number(amount) <= 0) {
			setError("Enter a valid amount in smallest units");
			return;
		}

		if (chain?.id !== moonbeam.id) {
			try {
				await switchChainAsync({ chainId: moonbeam.id });
			} catch (e) {
				setError("Please switch network to Moonbeam in your wallet");
				return;
			}
		}

		const asset = currencyMap[currencyOptionId];
		if (!asset) {
			setError("Invalid currency selection");
			return;
		}

		const currency = isForeignAsset(asset) && asset.assetId
			? { id: asset.assetId, amount }
			: { symbol: asset.symbol || "", amount };

		setSubmitting(true);
		try {
			const hash = await EvmBuilder()
				.from("Moonbeam")
				.to(destinationChain)
				.currency(currency)
				.address(recipient)
				.signer(walletClient as any)
				.build();
			setTxHash(hash);
		} catch (e: any) {
			setError(e?.message || String(e));
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className='bg-[#1a3a2f] p-4 sm:p-6 rounded-xl border border-solid border-[#23483c] shadow-lg text-white'>
			<h2 className='text-xl font-bold mb-4'>XCM Transfer (Moonbeam → Hydration)</h2>
			<div className='space-y-4'>
				<div>
					<label className='block text-sm mb-1'>Currency</label>
					<select
						className='w-full p-2 rounded bg-[#10261f] border border-[#23483c]'
						value={currencyOptionId}
						onChange={(e) => setCurrencyOptionId(e.target.value)}
					>
						{Object.keys(currencyMap).map((key) => (
							<option key={key} value={key}>
								{currencyMap[key].symbol} - {"assetId" in currencyMap[key] ? (currencyMap[key] as any).assetId : "Native"}
							</option>
						))}
					</select>
				</div>
				<div>
					<label className='block text-sm mb-1'>Recipient (HydraDX SS58)</label>
					<input
						className='w-full p-2 rounded bg-[#10261f] border border-[#23483c]'
						placeholder='Hydration address (prefix 63)'
						value={recipient}
						onChange={(e) => setRecipient(e.target.value)}
						required
					/>
				</div>
				<div className='flex items-center gap-2'>
					<input
						type='checkbox'
						checked={confirmRecipient}
						onChange={(e) => setConfirmRecipient(e.target.checked)}
					/>
					<span className='text-sm'>I confirm the recipient address is mine</span>
				</div>
				<div>
					<label className='block text-sm mb-1'>Amount (smallest units)</label>
					<input
						className='w-full p-2 rounded bg-[#10261f] border border-[#23483c]'
						placeholder='e.g. 1000000000000000000'
						value={amount}
						onChange={(e) => setAmount(e.target.value)}
						required
					/>
				</div>
				<button
					onClick={onSubmit}
					disabled={!isConnected || submitting}
					className='w-full h-12 bg-primary text-black font-bold rounded hover:opacity-90 disabled:opacity-40'
				>
					{!isConnected ? "Connect Wallet" : submitting ? "Submitting..." : "Send XCM"}
				</button>
				{error && (
					<div className='text-red-400 text-sm'>{error}</div>
				)}
				{txHash && (
					<div className='text-green-400 text-sm break-all'>Tx sent: {txHash}</div>
				)}
				{evmAddress && (
					<div className='text-white/60 text-xs'>Connected: {evmAddress}</div>
				)}
			</div>
		</div>
	);
}
