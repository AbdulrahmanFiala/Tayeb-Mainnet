// Auto-generated contract ABIs for type-safe contract interactions

export const ShariaSwapABI = [
	// Errors
	{
		type: "error",
		name: "QuoteAmountTooSmall",
		inputs: [
			{ name: "tokenIn", type: "address" },
			{ name: "tokenOut", type: "address" },
			{ name: "amountIn", type: "uint256" },
		],
	},
	{
		type: "error",
		name: "InsufficientBalance",
	},
	{
		type: "error",
		name: "SlippageExceeded",
	},
	{
		type: "error",
		name: "InvalidAmount",
	},
	{
		type: "error",
		name: "InvalidPath",
	},
	{
		type: "error",
		name: "SwapFailed",
	},
	{
		type: "error",
		name: "AssetNotRegistered",
	},
	// Functions
	{
		type: "function",
		name: "getSwapQuote",
		inputs: [
			{ name: "path", type: "address[]" },
			{ name: "amountIn", type: "uint256" },
		],
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "swapTokenForToken",
		inputs: [
			{ name: "tokenIn", type: "address" },
			{ name: "tokenOut", type: "address" },
			{ name: "amountIn", type: "uint256" },
			{ name: "minAmountOut", type: "uint256" },
			{ name: "deadline", type: "uint256" },
		],
		outputs: [{ name: "amountOut", type: "uint256" }],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "swapGLMRForToken",
		inputs: [
			{ name: "path", type: "address[]" },
			{ name: "minAmountOut", type: "uint256" },
			{ name: "deadline", type: "uint256" },
		],
		outputs: [{ name: "amountOut", type: "uint256" }],
		stateMutability: "payable",
	},
	{
		type: "function",
		name: "swapShariaCompliant",
		inputs: [
			{ name: "path", type: "address[]" },
			{ name: "amountIn", type: "uint256" },
			{ name: "minAmountOut", type: "uint256" },
			{ name: "deadline", type: "uint256" },
		],
		outputs: [{ name: "amountOut", type: "uint256" }],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "getUserSwapHistory",
		inputs: [
			{ name: "user", type: "address" },
		],
		outputs: [
			{
				name: "",
				type: "tuple[]",
				components: [
					{ name: "tokenIn", type: "address" },
					{ name: "tokenOut", type: "address" },
					{ name: "amountIn", type: "uint256" },
					{ name: "amountOut", type: "uint256" },
					{ name: "timestamp", type: "uint256" },
					{ name: "tokenInSymbol", type: "string" },
					{ name: "tokenOutSymbol", type: "string" },
				],
			},
		],
		stateMutability: "view",
	},
] as const;

export const ShariaComplianceABI = [
	{
		type: "function",
		name: "getAllShariaCoins",
		inputs: [],
		outputs: [
			{
				name: "coins",
				type: "tuple[]",
				components: [
					{ name: "id", type: "string" },
					{ name: "name", type: "string" },
					{ name: "symbol", type: "string" },
					{ name: "tokenAddress", type: "address" },
					{ name: "verified", type: "bool" },
					{ name: "complianceReason", type: "string" },
					{ name: "exists", type: "bool" },
				],
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "getCoinBySymbol",
		inputs: [{ name: "symbol", type: "string" }],
		outputs: [
			{
				name: "",
				type: "tuple",
				components: [
					{ name: "id", type: "string" },
					{ name: "name", type: "string" },
					{ name: "symbol", type: "string" },
					{ name: "tokenAddress", type: "address" },
					{ name: "verified", type: "bool" },
					{ name: "complianceReason", type: "string" },
					{ name: "exists", type: "bool" },
				],
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "isShariaCompliant",
		inputs: [{ name: "symbol", type: "string" }],
		outputs: [{ name: "", type: "bool" }],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "getTotalCoins",
		inputs: [],
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "getSymbolByAddress",
		inputs: [{ name: "tokenAddress", type: "address" }],
		outputs: [{ name: "", type: "string" }],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "getCoinByAddress",
		inputs: [{ name: "tokenAddress", type: "address" }],
		outputs: [
			{
				name: "",
				type: "tuple",
				components: [
					{ name: "id", type: "string" },
					{ name: "name", type: "string" },
					{ name: "symbol", type: "string" },
					{ name: "tokenAddress", type: "address" },
					{ name: "verified", type: "bool" },
					{ name: "complianceReason", type: "string" },
					{ name: "exists", type: "bool" },
				],
			},
		],
		stateMutability: "view",
	},
] as const;

export const ERC20_ABI = [
	{
		type: "function",
		name: "approve",
		inputs: [
			{ name: "spender", type: "address" },
			{ name: "amount", type: "uint256" },
		],
		outputs: [{ name: "", type: "bool" }],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "allowance",
		inputs: [
			{ name: "owner", type: "address" },
			{ name: "spender", type: "address" },
		],
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "balanceOf",
		inputs: [{ name: "account", type: "address" }],
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "transfer",
		inputs: [
			{ name: "to", type: "address" },
			{ name: "amount", type: "uint256" },
		],
		outputs: [{ name: "", type: "bool" }],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "transferFrom",
		inputs: [
			{ name: "from", type: "address" },
			{ name: "to", type: "address" },
			{ name: "amount", type: "uint256" },
		],
		outputs: [{ name: "", type: "bool" }],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "decimals",
		inputs: [],
		outputs: [{ name: "", type: "uint8" }],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "name",
		inputs: [],
		outputs: [{ name: "", type: "string" }],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "symbol",
		inputs: [],
		outputs: [{ name: "", type: "string" }],
		stateMutability: "view",
	},
] as const;

export const ShariaDCAABI = [
	{
		type: "function",
		name: "createDCAOrderWithDEV",
		inputs: [
			{ name: "targetToken", type: "address" },
			{ name: "amountPerInterval", type: "uint256" },
			{ name: "intervalSeconds", type: "uint256" },
			{ name: "totalIntervals", type: "uint256" },
		],
		outputs: [{ name: "orderId", type: "uint256" }],
		stateMutability: "payable",
	},
	{
		type: "function",
		name: "createDCAOrderWithToken",
		inputs: [
			{ name: "sourceToken", type: "address" },
			{ name: "targetToken", type: "address" },
			{ name: "amountPerInterval", type: "uint256" },
			{ name: "intervalSeconds", type: "uint256" },
			{ name: "totalIntervals", type: "uint256" },
		],
		outputs: [{ name: "orderId", type: "uint256" }],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "executeDCAOrder",
		inputs: [{ name: "orderId", type: "uint256" }],
		outputs: [],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "cancelDCAOrder",
		inputs: [{ name: "orderId", type: "uint256" }],
		outputs: [],
		stateMutability: "nonpayable",
	},
	{
		type: "function",
		name: "getDCAOrder",
		inputs: [{ name: "orderId", type: "uint256" }],
		outputs: [
			{
				name: "",
				type: "tuple",
				components: [
					{ name: "id", type: "uint256" },
					{ name: "owner", type: "address" },
					{ name: "sourceToken", type: "address" },
					{ name: "targetToken", type: "address" },
					{ name: "amountPerInterval", type: "uint256" },
					{ name: "interval", type: "uint256" },
					{ name: "intervalsCompleted", type: "uint256" },
					{ name: "totalIntervals", type: "uint256" },
					{ name: "nextExecutionTime", type: "uint256" },
					{ name: "startTime", type: "uint256" },
					{ name: "isActive", type: "bool" },
					{ name: "exists", type: "bool" },
				],
			},
		],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "getUserOrders",
		inputs: [{ name: "user", type: "address" }],
		outputs: [{ name: "", type: "uint256[]" }],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "blockTime",
		inputs: [],
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
	},
	{
		type: "function",
		name: "blocksBeforeHour",
		inputs: [],
		outputs: [{ name: "", type: "uint256" }],
		stateMutability: "view",
	},
	{
		type: "event",
		name: "DCAOrderCreated",
		inputs: [
			{ name: "orderId", type: "uint256", indexed: true },
			{ name: "owner", type: "address", indexed: true },
			{ name: "sourceToken", type: "address", indexed: false },
			{ name: "targetToken", type: "address", indexed: false },
			{ name: "amountPerInterval", type: "uint256", indexed: false },
			{ name: "interval", type: "uint256", indexed: false },
			{ name: "totalIntervals", type: "uint256", indexed: false },
		],
	},
	{
		type: "event",
		name: "DCAOrderExecuted",
		inputs: [
			{ name: "orderId", type: "uint256", indexed: true },
			{ name: "intervalNumber", type: "uint256", indexed: false },
			{ name: "amountIn", type: "uint256", indexed: false },
			{ name: "amountOut", type: "uint256", indexed: false },
			{ name: "timestamp", type: "uint256", indexed: false },
		],
	},
	{
		type: "event",
		name: "DCAOrderCancelled",
		inputs: [
			{ name: "orderId", type: "uint256", indexed: true },
			{ name: "owner", type: "address", indexed: true },
		],
	},
] as const;