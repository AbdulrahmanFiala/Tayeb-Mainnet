/**
 * Convert token symbol from underscore format to dot format for display
 * WBTC_WH -> WBTC.wh
 * IBTC_XC -> IBTC.xc
 * ETH_E -> ETH.e
 */
export function formatTokenSymbolForDisplay(symbol: string): string {
	if (!symbol) return symbol;
	
	// Check if it has underscore format
	const underscoreIndex = symbol.lastIndexOf('_');
	if (underscoreIndex > 0) {
		const base = symbol.substring(0, underscoreIndex);
		const suffix = symbol.substring(underscoreIndex + 1).toLowerCase();
		return `${base}.${suffix}`;
	}
	
	// Already in dot format or no variant, return as is
	return symbol;
}

/**
 * Get the base symbol from a variant symbol (for icon lookup)
 * WBTC.wh -> BTC, IBTC.xc -> BTC, ETH.e -> ETH
 */
export function getBaseSymbolForIcon(symbol: string): string {
	const upperSymbol = symbol.toUpperCase();
	let basePart = upperSymbol;
	
	// Extract base part before dot or underscore
	if (upperSymbol.includes('.')) {
		basePart = upperSymbol.split('.')[0];
	} else if (upperSymbol.includes('_')) {
		basePart = upperSymbol.split('_')[0];
	}
	
	// Map wrapped variants to their base coins
	// WBTC -> BTC, WETH -> ETH, wBTC -> BTC
	if (basePart.startsWith('W') && basePart.length > 1) {
		const unwrapped = basePart.substring(1);
		// We'll check against TOKEN_LOGOS in the component
		return unwrapped;
	}
	
	// Map Interlay variants to base coins
	// IBTC -> BTC, iBTC -> BTC
	if (basePart.startsWith('I') && basePart.length > 1) {
		const withoutI = basePart.substring(1);
		return withoutI;
	}
	
	// Return base part
	return basePart;
}

