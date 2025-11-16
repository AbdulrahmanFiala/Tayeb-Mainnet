import { useEffect, useState } from "react";
import type { TokenPrice } from "../types";

// Mock price data for common tokens (fallback when API is unavailable)
const MOCK_PRICES: Record<string, number> = {
	ETH: 3500,
	WETH: 3500,
	BTC: 65000,
	WBTC: 65000,
	USDT: 1,
	USDC: 1,
	DAI: 1,
	LINK: 15,
	UNI: 8,
	AAVE: 100,
	MATIC: 0.8,
	GLMR: 0.5, // Moonbeam native token
};

// Mapping from token symbol to CoinGecko ID
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
	BTC: "bitcoin",
	WBTC: "wrapped-bitcoin",
	ETH: "ethereum",
	WETH: "ethereum",
	USDT: "tether",
	USDC: "usd-coin",
	DAI: "dai",
	LINK: "chainlink",
	UNI: "uniswap",
	AAVE: "aave",
	MATIC: "matic-network",
	XRP: "ripple",
	BNB: "binancecoin",
	SOL: "solana",
	TRX: "tron",
	ADA: "cardano",
	HBAR: "hedera-hashgraph",
	BCH: "bitcoin-cash",
	LEO: "leo-token",
	XLM: "stellar",
	SUI: "sui",
	AVAX: "avalanche-2",
	GLMR: "moonbeam", // Moonbeam native token
};

interface PriceCache {
	[symbol: string]: TokenPrice;
}

// Cache with 5 minute expiry
const CACHE_DURATION = 5 * 60 * 1000;
const priceCache: PriceCache = {};

/**
 * Hook to fetch and manage token prices in USD
 * Uses CoinGecko API with fallback to mock prices
 */
export function useTokenPrices(symbols: string[]) {
	const [prices, setPrices] = useState<PriceCache>({});
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (symbols.length === 0) return;

		const fetchPrices = async () => {
			setLoading(true);
			setError(null);

			const now = Date.now();
			const newPrices: PriceCache = { ...prices };
			const symbolsToFetch: string[] = [];

			// Check cache first
			for (const symbol of symbols) {
				const symbolUpper = symbol.toUpperCase();
				const cached = priceCache[symbolUpper];
				// Only use cache if it has all required data (price and market cap) and is not expired
				// Allow marketCap to be 0, but reject undefined/null
				if (cached && now - cached.lastUpdated < CACHE_DURATION && cached.usd && cached.marketCap !== undefined && cached.marketCap !== null) {
					newPrices[symbolUpper] = cached;
				} else {
					symbolsToFetch.push(symbol);
				}
			}

			// If all prices are cached, use them
			if (symbolsToFetch.length === 0) {
				setPrices(newPrices);
				setLoading(false);
				return;
			}

			// Try to fetch from CoinGecko
			try {
				// Map symbols to CoinGecko IDs and group them
				const coingeckoIds: string[] = [];
				const symbolToIdMap: Record<string, string> = {};
				
				for (const symbol of symbolsToFetch) {
					const symbolUpper = symbol.toUpperCase();
					const coingeckoId = SYMBOL_TO_COINGECKO_ID[symbolUpper];
					if (coingeckoId) {
						if (!coingeckoIds.includes(coingeckoId)) {
							coingeckoIds.push(coingeckoId);
						}
						symbolToIdMap[symbolUpper] = coingeckoId;
					}
				}

				// Fetch from CoinGecko API if we have valid IDs
				if (coingeckoIds.length > 0) {
					const idsParam = coingeckoIds.join(",");
					const response = await fetch(
						`https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`
					);

					if (!response.ok) {
						throw new Error(`CoinGecko API error: ${response.status}`);
					}

					const data = await response.json();

					// Process fetched prices
					for (const symbol of symbolsToFetch) {
						const symbolUpper = symbol.toUpperCase();
						const coingeckoId = symbolToIdMap[symbolUpper];
						
						if (coingeckoId && data[coingeckoId]) {
							const coinData = data[coingeckoId];
							const priceData: TokenPrice = {
								symbol: symbolUpper,
								usd: coinData.usd || 0,
								change24h: coinData.usd_24h_change || 0,
								marketCap: coinData.usd_market_cap || 0,
								lastUpdated: now,
							};

							newPrices[symbolUpper] = priceData;
							priceCache[symbolUpper] = priceData;
						} else {
							// Fallback to mock price if CoinGecko ID not found
							const mockPrice = MOCK_PRICES[symbolUpper] || 1;
							const priceData: TokenPrice = {
								symbol: symbolUpper,
								usd: mockPrice,
								marketCap: 0, // No market cap available for unmapped tokens
								lastUpdated: now,
							};

							newPrices[symbolUpper] = priceData;
							priceCache[symbolUpper] = priceData;
						}
					}
				} else {
					// No CoinGecko IDs found, use mock prices
					for (const symbol of symbolsToFetch) {
						const symbolUpper = symbol.toUpperCase();
						const mockPrice = MOCK_PRICES[symbolUpper] || 1;
						
						const priceData: TokenPrice = {
							symbol: symbolUpper,
							usd: mockPrice,
							marketCap: 0, // No market cap available for unmapped tokens
							lastUpdated: now,
						};

						newPrices[symbolUpper] = priceData;
						priceCache[symbolUpper] = priceData;
					}
				}

				setPrices(newPrices);
			} catch (err) {
				console.error("Error fetching prices:", err);
				setError("Failed to fetch token prices");
				
				// Use mock prices as fallback
				for (const symbol of symbolsToFetch) {
					const symbolUpper = symbol.toUpperCase();
					const mockPrice = MOCK_PRICES[symbolUpper] || 1;
					
					const priceData: TokenPrice = {
						symbol: symbolUpper,
						usd: mockPrice,
						marketCap: 0, // No market cap available on error
						lastUpdated: now,
					};

					newPrices[symbolUpper] = priceData;
				}
				
				setPrices(newPrices);
			} finally {
				setLoading(false);
			}
		};

		fetchPrices();
	}, [symbols.join(",")]);

	return {
		prices,
		loading,
		error,
		getPrice: (symbol: string) => prices[symbol.toUpperCase()]?.usd || 0,
		getChange24h: (symbol: string) => prices[symbol.toUpperCase()]?.change24h || 0,
		getMarketCap: (symbol: string) => prices[symbol.toUpperCase()]?.marketCap || 0,
		calculateUsdValue: (symbol: string, amount: number) => {
			const price = prices[symbol.toUpperCase()]?.usd || 0;
			return price * amount;
		},
	};
}

/**
 * Hook to get a single token price
 */
export function useTokenPrice(symbol: string) {
	const { loading, error, getPrice } = useTokenPrices([symbol]);
	
	return {
		price: getPrice(symbol),
		loading,
		error,
	};
}

