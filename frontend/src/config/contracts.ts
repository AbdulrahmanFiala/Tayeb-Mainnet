/**
 * Contract Addresses and Configuration
 * Auto-imported from deployed contracts configuration
 */

import type { Address } from "viem";
import deployedContracts from "../../../config/deployedContracts.json";
import tayebCoinsData from "../../../config/tayebCoins.json";

// Type-safe contract addresses
export const CONTRACTS = {
	// Main Protocol Contracts
	SHARIA_COMPLIANCE: deployedContracts.main.shariaCompliance as Address,
	SHARIA_SWAP: deployedContracts.main.shariaSwap as Address,
	SHARIA_DCA: deployedContracts.main.shariaDCA as Address,

	// AMM Contracts
	FACTORY: deployedContracts.amm.factory as Address,
	ROUTER: deployedContracts.amm.router as Address,
	WETH: deployedContracts.amm.weth as Address,

	// Token Addresses
	TOKENS: deployedContracts.tokens as Record<string, Address>,

	// Liquidity Pairs
	PAIRS: deployedContracts.pairs as Record<string, Address>,
} as const;

// Network Information
export const NETWORK_INFO = {
	network: deployedContracts.network,
	version: deployedContracts.version,
	lastDeployed: deployedContracts.lastDeployed,
	deployer: deployedContracts.metadata?.deployer,
} as const;

// Token Metadata
export const TOKEN_METADATA = tayebCoinsData.coins.reduce(
	(acc, coin) => {
		acc[coin.symbol] = {
			symbol: coin.symbol,
			name: coin.name,
			decimals: coin.decimals,
			avgSlippagePercent: coin.avgSlippagePercent,
			complianceReason: coin.complianceReason,
			description: coin.description,
			address: coin.addresses.moonbeam as Address,
			permissible: coin.permissible,
		};
		return acc;
	},
	{} as Record<
		string,
		{
			symbol: string;
			name: string;
			decimals: number;
			avgSlippagePercent: number;
			complianceReason: string;
			description: string;
			address: Address;
			permissible: boolean;
		}
	>
);

// Get token address by symbol
export function getTokenAddress(symbol: string): Address | undefined {
	const token = TOKEN_METADATA[symbol.toUpperCase()];
	return token?.address;
}

// Get token decimals by symbol
export function getTokenDecimalsBySymbol(symbol: string): number {
	const token = TOKEN_METADATA[symbol.toUpperCase()];
	return token?.decimals ?? 18;
}

// Get all token symbols
export function getAllTokenSymbols(): string[] {
	return Object.keys(TOKEN_METADATA);
}

// Check if token is permissible
export function isTokenPermissible(symbol: string): boolean {
	const token = TOKEN_METADATA[symbol.toUpperCase()];
	return token?.permissible ?? false;
}

// Export for convenience
export default CONTRACTS;

