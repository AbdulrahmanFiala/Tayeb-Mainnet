import type { Address } from "viem";
import { createPublicClient, http, parseUnits } from "viem";
import { moonbeam } from "viem/chains";
import { ShariaSwapABI } from "../config/abis";

// Token addresses from deployment
const TOKEN_ADDRESSES: Record<string, Address> = {
	USDC: "0x1fc1F3961ed7E9118aBeFDE142362D6Fc885319a",
	BTC: "0x9C8262260A1Cfcca24a36a2d894c2b836Cb1b4E1",
	ETH: "0xf99a0892CF3ddDCD93F0428BC5BAaCC0604856f6",
	USDT: "0x884924C7Ef93081a34bCD4C057434e21A27Dd263",
};

const SHARIA_SWAP_ADDRESS: Address =
	"0x5baCC410De85c721EdCB99Ce4886f9F2f7B2D21d";

const publicClient = createPublicClient({
	chain: moonbeam,
	transport: http("https://rpc.api.moonbeam.network"),
});

/**
 * Test if a token pair has liquidity by attempting a quote
 */
export async function testTokenPairLiquidity(
	tokenInSymbol: string,
	tokenOutSymbol: string,
	amount: string = "1"
) {
	const tokenIn = TOKEN_ADDRESSES[tokenInSymbol];
	const tokenOut = TOKEN_ADDRESSES[tokenOutSymbol];

	try {
		if (!tokenIn || !tokenOut) {
			console.error(
				`❌ Token not found: ${!tokenIn ? tokenInSymbol : tokenOutSymbol}`
			);
			return { success: false, reason: "Token not found" };
		}

		console.log(`📝 Testing ${tokenInSymbol} → ${tokenOutSymbol}`);
		console.log(`   TokenIn:  ${tokenIn}`);
		console.log(`   TokenOut: ${tokenOut}`);

		const amountInWei = parseUnits(amount, 18);
		console.log(`   Amount:   ${amount} = ${amountInWei.toString()} wei`);

		const result = (await publicClient.readContract({
			address: SHARIA_SWAP_ADDRESS,
			abi: ShariaSwapABI,
			functionName: "getSwapQuote",
			args: [tokenIn, tokenOut, amountInWei],
		})) as bigint;

		console.log(`✅ SUCCESS: ${tokenInSymbol} → ${tokenOutSymbol}`);
		console.log(`   Quote: ${result.toString()}`);
		return { success: true, quote: result.toString() };
	} catch (err) {
		const errorMsg = err instanceof Error ? err.message : String(err);
		console.error(`❌ FAILED: ${tokenInSymbol} → ${tokenOutSymbol}`);
		console.error(`   Error: ${errorMsg}`);

		// Provide helpful hints
		if (errorMsg.includes("QuoteAmountTooSmall")) {
			console.error(
				`   💡 Reason: No liquidity for this pair or amount too small`
			);
			return { success: false, reason: "No liquidity or amount too small" };
		}
		if (errorMsg.includes("0xbb55fd27")) {
			console.error(
				`   💡 Reason: Contract revert with signature 0xbb55fd27 (insufficient liquidity)`
			);
			return { success: false, reason: "Insufficient liquidity" };
		}

		return { success: false, reason: errorMsg };
	}
}

/**
 * Test all common token pairs
 */
export async function testAllPairs() {
	const pairs = [
		["USDC", "BTC"],
		["USDC", "ETH"],
		["BTC", "USDC"],
		["ETH", "USDC"],
		["BTC", "ETH"],
		["ETH", "BTC"],
		["USDC", "USDT"],
		["USDT", "USDC"],
	];

	console.log("\n🔍 Testing all token pairs...\n");

	for (const [tokenIn, tokenOut] of pairs) {
		await testTokenPairLiquidity(tokenIn, tokenOut, "1");
		console.log(""); // Blank line for readability
	}
}

/**
 * Export for manual debugging in console
 * Usage: window.SwapDebugger.testPair("BTC", "USDC", "1")
 * Usage: window.SwapDebugger.testAll()
 */
declare global {
	interface Window {
		SwapDebugger: {
			testPair: typeof testTokenPairLiquidity;
			testAll: typeof testAllPairs;
		};
	}
}

// Make available in browser console
if (typeof window !== "undefined") {
	window.SwapDebugger = {
		testPair: testTokenPairLiquidity,
		testAll: testAllPairs,
	};
}
