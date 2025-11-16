// Token decimals configuration
// Maps token symbols to their decimal places

import tayebCoinsData from "../../../config/tayebCoins.json";

type TokenDecimalsMap = { [symbol: string]: number };

// Build decimals map from tayebCoins.json (including variants)
const tokenDecimalsMap: TokenDecimalsMap = {};
const tayebCoinsTyped = tayebCoinsData as {
	coins: Array<{
		symbol: string;
		decimals: number;
		variants?: Array<{
			symbol: string;
			decimals: number;
		}>;
	}>;
};

tayebCoinsTyped.coins.forEach((coin) => {
	// Add main coin
	tokenDecimalsMap[coin.symbol.toUpperCase()] = coin.decimals;
	
	// Add variants if they exist
	if (coin.variants) {
		coin.variants.forEach((variant) => {
			tokenDecimalsMap[variant.symbol.toUpperCase()] = variant.decimals ?? coin.decimals;
		});
	}
});

/**
 * Get decimals for a token symbol
 * @param symbol Token symbol (e.g. "BTC", "ETH", "USDC")
 * @returns Number of decimals (defaults to 18 if not found)
 */
export function getTokenDecimals(symbol: string): number {
	const decimals = tokenDecimalsMap[symbol.toUpperCase()];
	if (decimals === undefined) {
		console.warn(`⚠️ Decimals not found for ${symbol}, defaulting to 18`);
		return 18;
	}
	return decimals;
}

/**
 * Get all token decimals
 */
export function getAllTokenDecimals(): TokenDecimalsMap {
	return { ...tokenDecimalsMap };
}

