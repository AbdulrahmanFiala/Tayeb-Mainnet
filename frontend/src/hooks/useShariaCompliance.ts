import { useMemo } from "react";
import type { Address } from "viem";
import { useReadContract } from "wagmi";
import { ShariaComplianceABI } from "../config/abis";
import deployedContracts from "../../../config/deployedContracts.json";

const SHARIA_COMPLIANCE_ADDRESS = (
	deployedContracts as unknown as { main: { shariaCompliance: string } }
).main.shariaCompliance as Address;

/**
 * Type matching the smart contract's ShariaCoin struct
 */
export interface ShariaCoin {
	id: string;
	name: string;
	symbol: string;
	tokenAddress: Address;
	verified: boolean;
	complianceReason: string;
	exists: boolean;
}

/**
 * Refactored compliance hook using Wagmi v2 + Viem
 * Replaces the old useShariaCompliance hook
 */
export function useShariaCompliance() {
	// Get all Sharia-compliant coins
	const {
		data: coinsRaw,
		isLoading: coinsLoading,
		error: coinsError,
	} = useReadContract({
		address: SHARIA_COMPLIANCE_ADDRESS,
		abi: ShariaComplianceABI,
		functionName: "getAllShariaCoins",
	});

	// Type-safe coins data
	const coins = useMemo(() => {
		if (!coinsRaw) return [];
		return coinsRaw as ShariaCoin[];
	}, [coinsRaw]);

	// Get total number of coins
	const { data: totalCoins } = useReadContract({
		address: SHARIA_COMPLIANCE_ADDRESS,
		abi: ShariaComplianceABI,
		functionName: "getTotalCoins",
	});

	return {
		coins,
		coinsLoading,
		coinsError,
		totalCoins: totalCoins ? Number(totalCoins) : 0,
		SHARIA_COMPLIANCE_ADDRESS,
	};
}

/**
 * Hook to check if a specific symbol is Sharia compliant
 */
export function useIsShariaCompliant(symbol: string | undefined) {
	const { data: isCompliant, isLoading } = useReadContract({
		address: SHARIA_COMPLIANCE_ADDRESS,
		abi: ShariaComplianceABI,
		functionName: "isShariaCompliant",
		args: symbol ? [symbol] : undefined,
		query: {
			enabled: !!symbol,
		},
	});

	return { isCompliant: isCompliant as boolean | undefined, isLoading };
}

/**
 * Hook to get coin details by symbol
 */
export function useCoinBySymbol(symbol: string | undefined) {
	const { data: coin, isLoading } = useReadContract({
		address: SHARIA_COMPLIANCE_ADDRESS,
		abi: ShariaComplianceABI,
		functionName: "getCoinBySymbol",
		args: symbol ? [symbol] : undefined,
		query: {
			enabled: !!symbol,
		},
	});

	return {
		coin: coin as ShariaCoin | undefined,
		isLoading,
	};
}
