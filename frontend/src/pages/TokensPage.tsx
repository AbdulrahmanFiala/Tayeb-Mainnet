import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { CryptoTokenIcon } from "../components/CryptoTokenIcon";
import { formatTokenSymbolForDisplay } from "../utils/formatTokenSymbol";
import { useShariaCompliance } from "../hooks/useShariaCompliance";
import { useWallet } from "../hooks/useWallet";
import { useTokenPrices } from "../hooks/useTokenPrices";

interface ShariaCoin {
	id: string;
	name: string;
	symbol: string;
	tokenAddress: string;
	verified: boolean;
	complianceReason: string;
	exists: boolean;
}

export function TokensPage() {
	const navigate = useNavigate();
	useWallet(); // Just to ensure wallet context

	const { coins, coinsLoading } = useShariaCompliance();

	const [searchTerm, setSearchTerm] = useState("");
	const [sortBy, setSortBy] = useState<"name" | "price" | "marketcap">("name");

	// Convert coins to ShariaCoin format for display
	const contractTokens: ShariaCoin[] = useMemo(
		() =>
			(coins || []).map((coin, idx) => ({
				id: idx.toString(),
				name: coin.name,
				symbol: coin.symbol,
				tokenAddress: coin.tokenAddress,
				verified: coin.verified,
				complianceReason: coin.complianceReason,
				exists: true,
			})),
		[coins]
	);

	// Get all token symbols for price fetching
	const tokenSymbols = useMemo(
		() => contractTokens.map((token) => token.symbol),
		[contractTokens]
	);

	// Fetch real prices from CoinGecko
	const { prices } = useTokenPrices(tokenSymbols);

	// Format price data for display - memoized to prevent re-renders
	const priceData = useMemo(
		() => {
			const data: Record<string, { price: number; marketCap: number }> = {};
			for (const token of contractTokens) {
				const priceInfo = prices[token.symbol.toUpperCase()];
				data[token.symbol] = {
					price: priceInfo?.usd || 0,
					marketCap: priceInfo?.marketCap || 0,
				};
			}
			return data;
		},
		[contractTokens, prices]
	);

	const filteredAndSortedTokens = useMemo(() => {
		const filtered = contractTokens.filter(
			(token: ShariaCoin) =>
				token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
				token.name.toLowerCase().includes(searchTerm.toLowerCase())
		);

		filtered.sort((a: ShariaCoin, b: ShariaCoin) => {
			const priceA = priceData[a.symbol]?.price || 0;
			const priceB = priceData[b.symbol]?.price || 0;
			const marketCapA = priceData[a.symbol]?.marketCap || 0;
			const marketCapB = priceData[b.symbol]?.marketCap || 0;

			switch (sortBy) {
				case "price":
					return priceB - priceA;
				case "marketcap":
					return marketCapB - marketCapA;
				case "name":
				default:
					return a.symbol.localeCompare(b.symbol);
			}
		});

		return filtered;
	}, [searchTerm, sortBy, contractTokens, priceData]);

	return (
		<div className='flex flex-col min-h-screen pt-8'>
			<div className='flex flex-wrap justify-between gap-4 px-4'>
				<div className='flex min-w-72 flex-col gap-3'>
					<p className='text-white text-4xl font-black leading-tight tracking-[-0.033em]'>
						Explore Sharia-Compliant Tokens
					</p>
					<p className='text-[#92c9b7] text-base font-normal leading-normal'>
						Discover a curated list of Sharia-compliant crypto tokens.
					</p>
				</div>
			</div>

			<div className='flex flex-col sm:flex-row gap-4 px-4 py-3 mt-6'>
				<div className='flex-grow'>
					<label className='flex flex-col min-w-40 h-12 w-full'>
						<div className='flex w-full flex-1 items-stretch rounded-xl h-full'>
							<div className='text-[#92c9b7] flex border-none bg-[#23483c] items-center justify-center pl-4 rounded-l-xl border-r-0'>
								<span className='material-symbols-outlined'>search</span>
							</div>
							<input
								className='form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-white focus:outline-0 focus:ring-0 border-none bg-[#23483c] focus:border-none h-full placeholder:text-[#92c9b7] px-4 rounded-l-none border-l-0 pl-2 text-base font-normal leading-normal'
								placeholder='Search token by name or symbol'
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
							/>
						</div>
					</label>
				</div>
				<div className='flex gap-3 overflow-x-auto pb-2'>
					<button
						onClick={() => setSortBy("name")}
						className={`flex h-12 shrink-0 items-center justify-center gap-x-2 rounded-xl px-4 transition-colors ${
							sortBy === "name"
								? "bg-primary text-background-dark"
								: "bg-[#23483c] text-white"
						}`}
					>
						<p className='text-sm font-medium leading-normal'>Sort by Name</p>
						<div
							className={
								sortBy === "name" ? "text-background-dark" : "text-white"
							}
						>
							<span className='material-symbols-outlined text-base'>
								unfold_more
							</span>
						</div>
					</button>
					<button
						onClick={() => setSortBy("price")}
						className={`flex h-12 shrink-0 items-center justify-center gap-x-2 rounded-xl px-4 transition-colors ${
							sortBy === "price"
								? "bg-primary text-background-dark"
								: "bg-[#23483c] text-white"
						}`}
					>
						<p className='text-sm font-medium leading-normal'>Sort by Price</p>
						<div
							className={
								sortBy === "price" ? "text-background-dark" : "text-white"
							}
						>
							<span className='material-symbols-outlined text-base'>
								unfold_more
							</span>
						</div>
					</button>
					<button
						onClick={() => setSortBy("marketcap")}
						className={`flex h-12 shrink-0 items-center justify-center gap-x-2 rounded-xl px-4 transition-colors ${
							sortBy === "marketcap"
								? "bg-primary text-background-dark"
								: "bg-[#23483c] text-white"
						}`}
					>
						<p className='text-sm font-medium leading-normal'>Sort by Market Cap</p>
						<div
							className={
								sortBy === "marketcap" ? "text-background-dark" : "text-white"
							}
						>
							<span className='material-symbols-outlined text-base'>
								unfold_more
							</span>
						</div>
					</button>
				</div>
			</div>

			<div className='p-4 flex-1'>
				{coinsLoading ? (
					<div className='flex items-center justify-center h-96'>
						<div className='text-center'>
							<div className='inline-block mb-4'>
								<span className='text-4xl text-primary'>Loading...</span>
							</div>
							<p className='text-white text-lg'>
								Fetching tokens from contract...
							</p>
						</div>
					</div>
				) : contractTokens.length === 0 ? (
					<div className='flex items-center justify-center h-96'>
						<div className='text-center'>
							<p className='text-white text-lg mb-2'>No tokens found</p>
							<p className='text-[#92c9b7] text-sm'>
								Make sure you're connected to the Moonbeam network
							</p>
						</div>
					</div>
				) : (
					<>
						<div className='hidden sm:block'>
							<div className='flex overflow-hidden rounded-xl border border-[#326755] bg-background-dark'>
								<table className='flex-1 w-full'>
									<thead>
										<tr className='bg-[#19332b]'>
											<th className='px-4 py-3 text-left text-white text-sm font-medium leading-normal'>
												#
											</th>
											<th className='px-4 py-3 text-left text-white text-sm font-medium leading-normal'>
												Token
											</th>
											<th className='px-4 py-3 text-left text-white text-sm font-medium leading-normal'>
												Address
											</th>
											<th className='px-4 py-3 text-left text-white text-sm font-medium leading-normal'>
												Price
											</th>
											<th className='px-4 py-3 text-left text-white text-sm font-medium leading-normal'>
												Market Cap
											</th>
											<th className='px-4 py-3 text-left text-white text-sm font-medium leading-normal'>
												Compliance
											</th>
											<th className='px-4 py-3 text-left text-white text-sm font-medium leading-normal'>
												Reason
											</th>
											<th className='px-4 py-3 text-left text-white text-sm font-medium leading-normal'>
												Action
											</th>
										</tr>
									</thead>
									<tbody>
										{filteredAndSortedTokens.map((token, index) => {
											const priceInfo = priceData[token.symbol];

											return (
												<tr
													key={token.id}
													className='border-t border-t-[#326755] hover:bg-white/5 transition-colors duration-200'
												>
													<td className='h-[72px] px-4 py-2 text-white text-sm font-normal leading-normal'>
														{index + 1}.
													</td>
													<td className='h-[72px] px-4 py-2 text-white text-sm font-normal leading-normal'>
														<div
															className='flex items-center gap-2'
															title={token.tokenAddress}
														>
															<CryptoTokenIcon 
																symbol={token.symbol}
																className='w-8 h-8' 
															/>
															<div>
																<p className='font-medium'>{formatTokenSymbolForDisplay(token.symbol)}</p>
																<p className='text-xs text-white/60'>
																	{token.name}
																</p>
															</div>
														</div>
													</td>
													<td className='h-[72px] px-4 py-2 text-white text-sm font-normal leading-normal text-ellipsis overflow-hidden'>
														{token.tokenAddress}
													</td>
													<td className='h-[72px] px-4 py-2 text-[#92c9b7] text-sm font-normal leading-normal'>
														${priceInfo?.price.toFixed(2) || "0.00"}
													</td>
													<td className='h-[72px] px-4 py-2 text-[#92c9b7] text-sm font-normal leading-normal'>
														{priceInfo?.marketCap 
															? priceInfo.marketCap >= 1e12
																? `$${(priceInfo.marketCap / 1e12).toFixed(2)}T`
																: priceInfo.marketCap >= 1e9
																? `$${(priceInfo.marketCap / 1e9).toFixed(2)}B`
																: priceInfo.marketCap >= 1e6
																? `$${(priceInfo.marketCap / 1e6).toFixed(2)}M`
																: `$${priceInfo.marketCap.toFixed(0)}`
															: "—"}
													</td>
													<td className='h-[72px] px-4 py-2 text-sm font-normal leading-normal'>
														{token.verified && (
															<div
																className='flex items-center gap-2 text-xs font-medium text-green-400 bg-green-500/10 rounded-full px-3 py-1 w-fit'
																title={token.complianceReason}
															>
																<span className='material-symbols-outlined text-sm'>
																	verified
																</span>
																<span>Compliant</span>
															</div>
														)}
													</td>
													<td className='h-[72px] px-4 py-2 text-sm font-normal leading-normal'>
														{token.complianceReason}
													</td>
													<td className='h-[72px] px-4 py-2 text-right'>
														<button
															onClick={() =>
																navigate(`/swap?tokenIn=${token.symbol}`)
															}
															className='bg-primary/20 text-primary hover:bg-primary hover:text-background-dark transition-colors duration-200 font-bold text-sm h-9 px-4 rounded-lg'
														>
															Swap
														</button>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						</div>

						{/* Mobile view */}
						<div className='sm:hidden grid grid-cols-1 gap-4'>
							{filteredAndSortedTokens.map((token) => {
								const priceInfo = priceData[token.symbol];

								return (
									<div
										key={token.symbol}
										className='bg-[#19332b] p-4 rounded-xl border border-[#326755] space-y-4 hover:border-primary/50 transition-all duration-300'
									>
										<div className='flex justify-between items-start'>
											<div className='flex items-center gap-3'>
												<CryptoTokenIcon 
													symbol={token.symbol}
													className='w-10 h-10' 
												/>
												<div>
													<h3 className='text-white font-bold text-lg'>
														{token.name}
													</h3>
													<p className='text-[#92c9b7] text-sm'>{formatTokenSymbolForDisplay(token.symbol)}</p>
												</div>
											</div>
											<div className='flex items-center gap-2 text-xs font-medium text-green-400 bg-green-500/10 rounded-full px-3 py-1'>
												<span className='material-symbols-outlined text-sm'>
													verified
												</span>
												<span>Compliant</span>
											</div>
										</div>
										<div className='flex justify-between items-center'>
											<div>
												<p className='text-[#92c9b7] text-sm'>Price</p>
												<p className='text-white text-lg font-bold'>
													${priceInfo?.price.toFixed(2) || "0.00"}
												</p>
											</div>
											<div>
												<p className='text-[#92c9b7] text-sm text-right'>Market Cap</p>
												<p className='text-white text-lg font-bold text-right'>
													{priceInfo?.marketCap 
														? priceInfo.marketCap >= 1e12
															? `$${(priceInfo.marketCap / 1e12).toFixed(2)}T`
															: priceInfo.marketCap >= 1e9
															? `$${(priceInfo.marketCap / 1e9).toFixed(2)}B`
															: priceInfo.marketCap >= 1e6
															? `$${(priceInfo.marketCap / 1e6).toFixed(2)}M`
															: `$${priceInfo.marketCap.toFixed(0)}`
														: "—"}
												</p>
											</div>
										</div>
										<button
											onClick={() => navigate(`/swap?tokenIn=${token.symbol}`)}
											className='w-full bg-primary text-background-dark hover:opacity-90 transition-opacity font-bold text-sm h-10 px-4 rounded-lg'
										>
											Swap
										</button>
									</div>
								);
							})}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
