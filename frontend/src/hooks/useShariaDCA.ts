import { useMemo } from "react";
import type { Address } from "viem";
import {
	useAccount,
	useChainId,
	useReadContract,
	useReadContracts,
	useWriteContract,
	useWaitForTransactionReceipt,
	useSwitchChain,
} from "wagmi";
import { moonbeam } from "wagmi/chains";
import { ERC20_ABI, ShariaDCAABI } from "../config/abis";
import deployedContracts from "../../../config/deployedContracts.json";
import { REQUIRED_CHAIN_ID, REQUIRED_CHAIN_NAME } from "../config/wagmi";

const SHARIA_DCA_ADDRESS = (
	deployedContracts as unknown as { main: { shariaDCA: string } }
).main.shariaDCA as Address;

/**
 * Type matching the smart contract's DCAOrder struct
 */
export interface DCAOrder {
	id: bigint;
	owner: Address;
	sourceToken: Address;
	targetToken: Address;
	amountPerInterval: bigint;
	interval: bigint;
	intervalsCompleted: bigint;
	totalIntervals: bigint;
	nextExecutionTime: bigint;
	startTime: bigint;
	isActive: boolean;
	exists: boolean;
}

/**
 * Hook for ShariaDCA contract interactions using Wagmi v2
 */
export function useShariaDCA() {
	const { address: userAddress, chainId: accountChainId } = useAccount();
	const chainId = useChainId();
	const { switchChain } = useSwitchChain();
	const { 
		writeContract, 
		isPending: isWriting,
		data: txHash,
		error: writeError,
		reset: resetWrite,
	} = useWriteContract();

	// Validate network before any transaction and prompt to switch if needed
	// Use accountChainId if available (more reliable), fallback to chainId
	const validateNetwork = async () => {
		const currentChainId = accountChainId || chainId;
		if (!currentChainId || currentChainId !== REQUIRED_CHAIN_ID) {
			// Try to automatically switch to the correct network
			if (switchChain) {
				try {
					await switchChain({ chainId: moonbeam.id });
					// Wait a moment for the switch to complete
					await new Promise(resolve => setTimeout(resolve, 500));
					// Re-check after switch attempt
					const newChainId = accountChainId || chainId;
					if (newChainId !== REQUIRED_CHAIN_ID) {
						throw new Error(
							`Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) in your wallet. If the network is not added, MetaMask will prompt you to add it.`
						);
					}
				} catch (error: any) {
					// If user rejects or switch fails, throw a helpful error
					if (error?.code === 4902 || error?.message?.includes('4902')) {
						// Chain not added - MetaMask should prompt to add it
						throw new Error(
							`Please add ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) to your wallet. MetaMask should prompt you to add it.`
						);
					} else if (error?.code === 4001 || error?.message?.includes('rejected')) {
						// User rejected the switch
						throw new Error(
							`Network switch was rejected. Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) manually in your wallet.`
						);
					} else {
						throw new Error(
							`Please switch to ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}) in your wallet. If the network is not added, MetaMask will prompt you to add it.`
						);
					}
				}
			} else {
				throw new Error(
					`Wrong network! You're connected to chain ID ${currentChainId || 'unknown'}, but this app requires ${REQUIRED_CHAIN_NAME} (Chain ID: ${REQUIRED_CHAIN_ID}). Please switch networks in your wallet.`
				);
			}
		}
	};

	// Wait for transaction confirmation
	const {
		isLoading: isConfirming,
		isSuccess: isConfirmed,
		error: confirmError,
	} = useWaitForTransactionReceipt({
		hash: txHash,
	});

	// Get user's order IDs
	const { data: userOrderIds, isLoading: loadingOrderIds, refetch: refetchUserOrders } = useReadContract({
		address: SHARIA_DCA_ADDRESS,
		abi: ShariaDCAABI,
		functionName: "getUserOrders",
		args: userAddress ? [userAddress] : undefined,
		query: {
			enabled: !!userAddress,
		},
	});

	// Create DCA order with DEV (native token)
	const createDCAOrderWithDEV = async (
		targetToken: Address,
		amountPerInterval: bigint,
		intervalSeconds: bigint,
		totalIntervals: bigint,
		totalValue: bigint
	) => {
		if (!userAddress) throw new Error("Wallet not connected");
		await validateNetwork(); // Check network before transaction (will prompt to switch if needed)

		writeContract({
			address: SHARIA_DCA_ADDRESS,
			abi: ShariaDCAABI,
			functionName: "createDCAOrderWithDEV",
			args: [targetToken, amountPerInterval, intervalSeconds, totalIntervals],
			value: totalValue, // Total amount to be locked
		});
	};

	// Create DCA order with ERC20 token
	const createDCAOrderWithToken = async (
		sourceToken: Address,
		targetToken: Address,
		amountPerInterval: bigint,
		intervalSeconds: bigint,
		totalIntervals: bigint
	) => {
		if (!userAddress) throw new Error("Wallet not connected");
		await validateNetwork(); // Check network before transaction (will prompt to switch if needed)

		writeContract({
			address: SHARIA_DCA_ADDRESS,
			abi: ShariaDCAABI,
			functionName: "createDCAOrderWithToken",
			args: [
				sourceToken,
				targetToken,
				amountPerInterval,
				intervalSeconds,
				totalIntervals,
			],
		});
	};

	// Approve token for DCA contract
	const approveToken = async (tokenAddress: Address, amount: bigint) => {
		if (!userAddress) throw new Error("Wallet not connected");
		await validateNetwork(); // Check network before transaction (will prompt to switch if needed)

		writeContract({
			address: tokenAddress,
			abi: ERC20_ABI,
			functionName: "approve",
			args: [SHARIA_DCA_ADDRESS, amount],
		});
	};

	// Execute DCA order
	const executeDCAOrder = async (orderId: bigint) => {
		await validateNetwork(); // Check network before transaction (will prompt to switch if needed)
		writeContract({
			address: SHARIA_DCA_ADDRESS,
			abi: ShariaDCAABI,
			functionName: "executeDCAOrder",
			args: [orderId],
		});
	};

	// Cancel DCA order
	const cancelDCAOrder = async (orderId: bigint) => {
		if (!userAddress) throw new Error("Wallet not connected");
		await validateNetwork(); // Check network before transaction (will prompt to switch if needed)

		writeContract({
			address: SHARIA_DCA_ADDRESS,
			abi: ShariaDCAABI,
			functionName: "cancelDCAOrder",
			args: [orderId],
		});
	};

	return {
		createDCAOrderWithDEV,
		createDCAOrderWithToken,
		approveToken,
		executeDCAOrder,
		cancelDCAOrder,
		userOrderIds: (userOrderIds as bigint[]) || [],
		loadingOrderIds,
		refetchUserOrders,
		isCreating: isWriting,
		isExecuting: isWriting,
		isCancelling: isWriting,
		isApproving: isWriting,
		isConfirming,
		isConfirmed,
		txHash,
		writeError,
		confirmError,
		resetWrite,
		SHARIA_DCA_ADDRESS,
	};
}

/**
 * Hook to get details for a specific DCA order
 */
export function useDCAOrder(orderId: bigint | undefined) {
	const { data: order, isLoading } = useReadContract({
		address: SHARIA_DCA_ADDRESS,
		abi: ShariaDCAABI,
		functionName: "getDCAOrder",
		args: orderId ? [orderId] : undefined,
		query: {
			enabled: orderId !== undefined,
		},
	});

	return {
		order: order as DCAOrder | undefined,
		isLoading,
	};
}

/**
 * Hook to get multiple DCA orders at once
 */
export function useDCAOrders(orderIds: bigint[] | undefined) {
	// Create contract calls for all order IDs
	const contracts = useMemo(() => {
		if (!orderIds || orderIds.length === 0) return [];

		return orderIds.map((id) => ({
			address: SHARIA_DCA_ADDRESS,
			abi: ShariaDCAABI,
			functionName: "getDCAOrder" as const,
			args: [id],
		}));
	}, [orderIds]);

	const { data: ordersData, isLoading, refetch: refetchOrders } = useReadContracts({
		contracts,
		query: {
			enabled: !!orderIds && orderIds.length > 0,
		},
	});

	// Extract orders from results
	const orders = useMemo(() => {
		if (!ordersData) return [];

		return ordersData
			.map((result) => {
				if (result.status === "success" && result.result) {
					return result.result as DCAOrder;
				}
				return null;
			})
			.filter((order): order is DCAOrder => order !== null);
	}, [ordersData]);

	return {
		orders,
		isLoading,
		refetchOrders,
	};
}

