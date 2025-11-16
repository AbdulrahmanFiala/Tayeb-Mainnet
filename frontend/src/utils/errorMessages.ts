/**
 * Utility function to convert technical error messages into user-friendly messages
 */

interface ErrorWithCode extends Error {
	code?: string | number;
	shortMessage?: string;
	data?: {
		code?: number;
		message?: string;
		errorName?: string;
	};
	cause?: {
		data?: string;
		message?: string;
	};
}

/**
 * Parses various error types and returns a user-friendly message
 */
export function getFriendlyErrorMessage(error: unknown): string {
	if (!error) {
		return "An unexpected error occurred. Please try again.";
	}

	// Handle Error objects
	if (error instanceof Error) {
		const err = error as ErrorWithCode;
		const errorMessage = err.message || err.shortMessage || "";
		const errorCode = err.code;
		const causeData = err.cause?.data || err.data?.message || "";

		// User rejected the transaction
		if (
			errorMessage.includes("User rejected") ||
			errorMessage.includes("user rejected") ||
			errorMessage.includes("User denied") ||
			errorMessage.includes("user denied") ||
			errorCode === 4001 ||
			errorCode === "ACTION_REJECTED"
		) {
			return "Transaction was cancelled. Please try again when you're ready.";
		}

		// Insufficient funds
		if (
			errorMessage.includes("insufficient funds") ||
			errorMessage.includes("Insufficient funds") ||
			errorMessage.includes("insufficient balance") ||
			errorMessage.includes("execution reverted: ERC20: transfer amount exceeds balance")
		) {
			return "Insufficient balance. Please check your token balance and try again.";
		}

		// Gas estimation errors
		if (
			errorMessage.includes("gas required exceeds allowance") ||
			errorMessage.includes("intrinsic gas too low") ||
			errorMessage.includes("gas estimation failed")
		) {
			return "Transaction would fail. Please check your balance and try again.";
		}

		// Contract revert errors - check for specific revert reasons
		if (
			errorMessage.includes("reverted") ||
			errorMessage.includes("execution reverted") ||
			errorMessage.includes("Internal JSON-RPC error")
		) {
			// Check for specific revert reasons in the error message or cause
			const fullError = `${errorMessage} ${causeData}`.toLowerCase();

			// Deadline exceeded
			if (
				fullError.includes("deadline") ||
				fullError.includes("expired") ||
				fullError.includes("too old")
			) {
				return "Transaction deadline expired. Please try the swap again.";
			}

			// Slippage tolerance exceeded
			if (
				fullError.includes("slippage") ||
				fullError.includes("insufficient output amount") ||
				fullError.includes("amountout") ||
				fullError.includes("minamountout")
			) {
				return "Price moved too much. Try increasing your slippage tolerance or try again.";
			}

			// Insufficient liquidity
			if (
				fullError.includes("liquidity") ||
				fullError.includes("insufficient") ||
				fullError.includes("quotamounttoosmall") ||
				fullError.includes("0xbb55fd27")
			) {
				return "Insufficient liquidity for this swap. Try a smaller amount or a different token pair.";
			}

			// Allowance issues
			if (
				fullError.includes("allowance") ||
				fullError.includes("not enough allowance") ||
				fullError.includes("erc20: insufficient allowance")
			) {
				return "Token approval required. Please approve the token first and try again.";
			}

			// Generic contract revert
			return "Transaction failed. This could be due to insufficient liquidity, price changes, or network issues. Please try again.";
		}

		// Network errors
		if (
			errorMessage.includes("network") ||
			errorMessage.includes("Network") ||
			errorMessage.includes("fetch") ||
			errorMessage.includes("timeout") ||
			errorCode === "NETWORK_ERROR"
		) {
			return "Network error. Please check your connection and try again.";
		}

		// Transaction replacement errors
		if (
			errorMessage.includes("replacement") ||
			errorMessage.includes("nonce") ||
			errorMessage.includes("already known")
		) {
			return "A transaction is already pending. Please wait for it to complete or try again in a moment.";
		}

		// Return a sanitized version of the error if we can't parse it
		// Remove technical details but keep some context
		const sanitized = errorMessage
			.replace(/0x[a-fA-F0-9]{64}/g, "[hash]")
			.replace(/0x[a-fA-F0-9]{40}/g, "[address]")
			.replace(/Internal JSON-RPC error\./g, "")
			.trim();

		if (sanitized.length > 0 && sanitized.length < 200) {
			return sanitized;
		}
	}

	// Handle string errors
	if (typeof error === "string") {
		return error.length > 200 ? "Transaction failed. Please try again." : error;
	}

	// Fallback for unknown error types
	return "Transaction failed. Please try again. If the problem persists, check your network connection and try again later.";
}

/**
 * Checks if an error is a user rejection (not a real error)
 */
export function isUserRejection(error: unknown): boolean {
	if (!error) return false;

	if (error instanceof Error) {
		const err = error as ErrorWithCode;
		const errorMessage = err.message || err.shortMessage || "";
		const errorCode = err.code;

		return (
			errorMessage.includes("User rejected") ||
			errorMessage.includes("user rejected") ||
			errorMessage.includes("User denied") ||
			errorMessage.includes("user denied") ||
			errorCode === 4001 ||
			errorCode === "ACTION_REJECTED"
		);
	}

	return false;
}

