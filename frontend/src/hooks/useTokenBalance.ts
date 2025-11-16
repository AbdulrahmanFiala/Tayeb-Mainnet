import { useAccount, useBalance, useReadContract } from "wagmi";
import { formatUnits, isAddress } from "viem";
import { ERC20_ABI } from "../config/abis";
import { CONTRACTS } from "../config/contracts";
import type { Token } from "../types";

export function useTokenBalance(token: Token | null) {
	const { address } = useAccount();

	// Check if this is GLMR/WETH (native token or wrapped native token)
	// GLMR token uses the WETH contract address, so we check by address
	const isNativeToken = token?.addresses.moonbeam?.toLowerCase() === CONTRACTS.WETH.toLowerCase();

	// Get native balance for GLMR/WETH
	const { data: nativeBalance, refetch: refetchNative } = useBalance({
		address: address,
		query: {
			enabled: Boolean(isNativeToken && address),
			refetchOnWindowFocus: true,
		},
	});

	// Fetch wrapped balance from the ERC20 contract
	// For DEV/WETH, this gets the wrapped balance; for other tokens, this is the token balance
	const tokenAddress = token?.addresses.moonbeam;
	// Normalize address to lowercase for comparison (addresses are case-insensitive)
	// But keep original format for the contract call (viem handles case-insensitive addresses)
	const normalizedTokenAddress = tokenAddress?.toLowerCase();
	const isValidAddress = tokenAddress && isAddress(tokenAddress) && normalizedTokenAddress !== "0x0000000000000000000000000000000000000000";
	
	// Debug logging (only in development)
	if (process.env.NODE_ENV === 'development' && token) {
		console.log(`[useTokenBalance] Token: ${token.symbol}, Address: ${tokenAddress}, Valid: ${isValidAddress}, Wallet: ${address}`);
	}
	
	const { data: wrappedBalance, refetch: refetchWrapped, error: balanceError, isLoading: balanceLoading } = useReadContract({
		address: tokenAddress as `0x${string}` | undefined,
		abi: ERC20_ABI,
		functionName: "balanceOf",
		args: address ? [address] : undefined,
		query: {
			enabled: Boolean(token && address && isValidAddress),
			refetchOnWindowFocus: true,
		},
	});

	// Calculate total balance
	let totalBalance: bigint | undefined;
	let formattedBalance: string;

	if (isNativeToken) {
		// For GLMR/WETH, combine native and wrapped balances
		// This shows the total GLMR available (native + wrapped)
		const native = nativeBalance?.value || 0n;
		const wrapped = (wrappedBalance as bigint) || 0n;
		totalBalance = native + wrapped;
		formattedBalance = totalBalance > 0n
			? formatUnits(totalBalance, token.decimals)
			: "0";
		} else {
			// For other ERC20 tokens, use wrapped balance only
			// Handle both undefined and null cases
			if (wrappedBalance === undefined || wrappedBalance === null) {
				// Query hasn't completed yet or failed - return "0" for now
				// But log for debugging if there's an error
				if (balanceError) {
					console.warn(`[useTokenBalance] Error for ${token?.symbol} (${tokenAddress}):`, balanceError);
				}
				// If still loading, we might want to show a loading state, but for now return "0"
				if (balanceLoading && process.env.NODE_ENV === 'development') {
					console.log(`[useTokenBalance] Still loading balance for ${token?.symbol}...`);
				}
				totalBalance = undefined;
				formattedBalance = "0";
			} else {
				totalBalance = wrappedBalance as bigint;
				if (token && totalBalance !== undefined) {
					formattedBalance = totalBalance > 0n
						? formatUnits(totalBalance, token.decimals)
						: "0";
					// Debug log successful balance fetch
					if (process.env.NODE_ENV === 'development' && totalBalance > 0n) {
						console.log(`[useTokenBalance] Balance for ${token.symbol}: ${formattedBalance} (raw: ${totalBalance.toString()})`);
					}
				} else {
					formattedBalance = "0";
				}
			}
		}

	// Refetch function that refetches both native and wrapped if needed
	const refetch = async () => {
		if (isNativeToken) {
			// For GLMR/WETH, refetch both native and wrapped balances
			await Promise.all([
				refetchNative(),
				refetchWrapped(),
			]);
		} else {
			// For other ERC20 tokens, only refetch wrapped balance
			await refetchWrapped();
		}
	};

	return {
		balance: formattedBalance,
		balanceRaw: totalBalance,
		refetch,
	};
}

