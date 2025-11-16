export interface Token {
	symbol: string;
	name: string;
	decimals: number;
	description: string;
	complianceReason: string;
	addresses: {
		moonbeam: string;
	};
	permissible: boolean;
	avgSlippagePercent?: number;
}

export interface TayebCoin {
	coins: Token[];
}

// Legacy alias for backwards compatibility
/** @deprecated Use TayebCoin instead */
export type HalaCoin = TayebCoin;

export interface DeployedContracts {
	network: string;
	version: string;
	lastDeployed: string;
	amm: {
		factory: string;
		router: string;
		weth: string;
	};
	main: {
		shariaCompliance: string;
		shariaSwap: string;
		shariaDCA: string;
	};
	tokens: {
		[key: string]: string;
	};
}

export interface SwapState {
	tokenIn: Token | null;
	tokenOut: Token | null;
	amountIn: string;
	amountOut: string;
	loading: boolean;
	error: string | null;
}

export interface TokenPrice {
	symbol: string;
	usd: number;
	change24h?: number;
	marketCap?: number;
	lastUpdated: number;
}

export interface SwapConfirmationData {
	tokenIn: Token;
	tokenOut: Token;
	amountIn: string;
	amountOut: string;
	amountInUsd?: number;
	amountOutUsd?: number;
	exchangeRate: string;
	priceImpact: number;
	fee: string;
	feeUsd?: number;
	networkCost?: string;
	networkCostUsd?: number;
	slippageTolerance: number;
	minAmountOut: string;
}

export type TransactionStatus = "idle" | "pending" | "success" | "error";

export interface TransactionNotification {
	id: string;
	status: TransactionStatus;
	type: "swap" | "approve";
	tokenIn?: Token;
	tokenOut?: Token;
	amountIn?: string;
	amountOut?: string;
	message?: string;
	txHash?: string;
}

export interface SwapRecord {
	tokenIn: string;
	tokenOut: string;
	amountIn: bigint;
	amountOut: bigint;
	timestamp: bigint;
	tokenInSymbol: string;
	tokenOutSymbol: string;
}

export interface DCAConfirmationData {
	sourceToken: Token;
	targetToken: Token;
	totalBudget: string;
	amountPerInterval: string;
	actualTotalUsed: string;
	remainder: string | null;
	totalIntervals: number;
	interval: "hour" | "day" | "week";
	intervalSeconds: number;
}