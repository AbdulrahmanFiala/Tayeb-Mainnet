import { useMemo, useState, useCallback } from "react";
import { useAccount, useChainId, usePublicClient, useBalance } from "wagmi";
import { formatUnits, isAddress, getAddress } from "viem";
import type { Address } from "viem";
import { ERC20_ABI } from "../config/abis";
import { useShariaCompliance } from "./useShariaCompliance";
import { moonbeam } from "wagmi/chains";
import deployedContracts from "../../../config/deployedContracts.json";

const WETH_ADDRESS = (
	deployedContracts as unknown as { amm: { weth: string } }
).amm.weth as Address;


export interface ScannedToken {
	address: string;
	symbol: string;
	name: string;
	balance: string;
	balanceRaw: bigint;
	decimals: number;
	status: "compliant" | "non-compliant" | "unknown";
	complianceReason?: string;
	verified?: boolean;
}

interface UseWalletTokenScannerReturn {
	scannedTokens: ScannedToken[];
	isScanning: boolean;
	error: Error | null;
	scanWallet: () => Promise<void>;
	summary: {
		compliant: number;
		nonCompliant: number;
		unknown: number;
		total: number;
	};
}

/**
 * Hook to scan user's wallet for tokens and check Sharia compliance status
 * @param scanAddress Optional address to scan. If not provided, uses connected wallet address
 */
export function useWalletTokenScanner(scanAddress?: Address): UseWalletTokenScannerReturn {
	const { address: connectedAddress } = useAccount();
	const chainId = useChainId();
	const { coins } = useShariaCompliance();
	const publicClient = usePublicClient();
	const [scannedTokens, setScannedTokens] = useState<ScannedToken[]>([]);
	const [isScanning, setIsScanning] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	// Use custom address if provided, otherwise use connected address
	const addressToScan = scanAddress || connectedAddress;

	// Get native DEV balance (needed for checking DEV even if wrapped)
	const { data: nativeBalance } = useBalance({
		address: addressToScan,
		query: {
			enabled: Boolean(addressToScan),
		},
	});


	// Scan wallet function
	const scanWallet = useCallback(async () => {
		if (!addressToScan) {
			setError(new Error("No wallet address provided"));
			return;
		}

		// Validate address format
		if (!isAddress(addressToScan)) {
			setError(new Error("Invalid wallet address format"));
			return;
		}

		// Check if on Moonbeam
		if (chainId !== moonbeam.id) {
			setError(new Error("Please switch to Moonbeam network to scan"));
			return;
		}

		setIsScanning(true);
		setError(null);

		try {
			if (!addressToScan) {
				throw new Error("No address to scan");
			}

			if (!publicClient) {
				throw new Error("Public client not available");
			}

			// Step 1: Loop through Tayeb coins and check if they're in the wallet
			console.log("🔍 Checking wallet for Tayeb coins...");
			console.log(`📊 Found ${coins.length} registered coins to check`);

			const tokens: ScannedToken[] = [];

			// Get token addresses and prepare balance checks
			const tokenAddresses: Address[] = [];
			const coinMap = new Map<string, { symbol: string; name: string; address: Address; verified: boolean; complianceReason: string }>();

			for (const coin of coins) {
				if (coin.tokenAddress && coin.tokenAddress !== "0x0000000000000000000000000000000000000000") {
					try {
						const address = getAddress(coin.tokenAddress);
						tokenAddresses.push(address);
						coinMap.set(address.toLowerCase(), {
							symbol: coin.symbol || "UNKNOWN",
							name: coin.name || "Unknown Token",
							address: address,
							verified: coin.verified,
							complianceReason: coin.complianceReason || "",
						});
					} catch (err) {
						console.warn(`⚠️ Invalid coin address: ${coin.tokenAddress}`, err);
					}
				}
			}

			if (tokenAddresses.length === 0) {
				console.log("⚠️ No valid token addresses found in registered coins");
			} else {
				// Check balances for all registered tokens using multicall
				console.log(`🔍 Checking balances for ${tokenAddresses.length} registered tokens...`);

				// Prepare multicall contracts for balanceOf
				const balanceContracts = tokenAddresses.map((tokenAddress) => ({
					address: tokenAddress,
					abi: ERC20_ABI,
					functionName: "balanceOf" as const,
					args: [addressToScan] as const,
				}));

				// Also fetch decimals in case we don't have it
				const decimalsContracts = tokenAddresses.map((tokenAddress) => ({
					address: tokenAddress,
					abi: ERC20_ABI,
					functionName: "decimals" as const,
				}));

				// Execute multicalls in batches
				const batchSize = 50;

				for (let i = 0; i < balanceContracts.length; i += batchSize) {
					const batchEnd = Math.min(i + batchSize, balanceContracts.length);
					const balanceBatch = balanceContracts.slice(i, batchEnd);
					const decimalsBatch = decimalsContracts.slice(i, batchEnd);

					const [balanceResults, decimalsResults] = await Promise.all([
						publicClient.multicall({ contracts: balanceBatch as any }),
						publicClient.multicall({ contracts: decimalsBatch as any }),
					]);

					// Process results
					for (let j = 0; j < balanceBatch.length; j++) {
						const tokenIndex = i + j;
						const tokenAddress = tokenAddresses[tokenIndex];
						const tokenAddressLower = tokenAddress.toLowerCase();
						const coin = coinMap.get(tokenAddressLower);

						if (!coin) continue;

						const balanceResult = balanceResults[j];
						const decimalsResult = decimalsResults[j];

						let balance = balanceResult?.status === "success" && balanceResult.result 
							? (balanceResult.result as bigint) 
							: 0n;

						const decimals = decimalsResult?.status === "success" && decimalsResult.result 
							? Number(decimalsResult.result) 
							: 18;

						// If this is WETH (wrapped DEV), also check native DEV balance
						// Native DEV balance should be included since DEV is the native token
						if (tokenAddressLower === WETH_ADDRESS.toLowerCase() && nativeBalance && nativeBalance.value > 0n) {
							// Add native DEV balance to wrapped DEV balance
							balance = balance + nativeBalance.value;
							console.log(`  📊 DEV: Wrapped=${formatUnits(balance - nativeBalance.value, decimals)}, Native=${formatUnits(nativeBalance.value, 18)}, Total=${formatUnits(balance, decimals)}`);
						}

						// Only include tokens with non-zero balance
						if (balance > 0n) {
							console.log(`  ✅ Found ${coin.symbol}: ${formatUnits(balance, decimals)}`);

							// Use compliance status from coin data
							const status: "compliant" | "non-compliant" | "unknown" = coin.verified 
								? "compliant" 
								: coin.complianceReason 
									? "non-compliant" 
									: "unknown";

							tokens.push({
								address: tokenAddress,
								symbol: coin.symbol,
								name: coin.name,
								balance: formatUnits(balance, decimals),
								balanceRaw: balance,
								decimals,
								status,
								complianceReason: coin.complianceReason || undefined,
								verified: coin.verified,
							});
						}
					}
				}
			}

			// Get final list of tokens with balances
			const tokensWithBalance = tokens;

			if (tokensWithBalance.length === 0) {
				console.log("⚠️ No tokens with non-zero balances found in wallet");
			}

			// Sort: compliant first, then unknown, then non-compliant
			tokens.sort((a, b) => {
				const statusOrder = { compliant: 0, unknown: 1, "non-compliant": 2 };
				return statusOrder[a.status] - statusOrder[b.status];
			});

			console.log(`✅ Final scan result: ${tokens.length} tokens found (${tokens.filter(t => t.status === "compliant").length} compliant, ${tokens.filter(t => t.status === "unknown").length} unknown)`);

			setScannedTokens(tokens);
		} catch (err) {
			setError(err instanceof Error ? err : new Error("Failed to scan wallet"));
			console.error("Error scanning wallet:", err);
		} finally {
			setIsScanning(false);
		}
	}, [
		addressToScan,
		chainId,
		coins,
		nativeBalance,
		publicClient,
	]);

	// Calculate summary
	const summary = useMemo(() => {
		const compliant = scannedTokens.filter((t) => t.status === "compliant").length;
		const nonCompliant = scannedTokens.filter((t) => t.status === "non-compliant").length;
		const unknown = scannedTokens.filter((t) => t.status === "unknown").length;

		return {
			compliant,
			nonCompliant,
			unknown,
			total: scannedTokens.length,
		};
	}, [scannedTokens]);

	return {
		scannedTokens,
		isScanning,
		error,
		scanWallet,
		summary,
	};
}

