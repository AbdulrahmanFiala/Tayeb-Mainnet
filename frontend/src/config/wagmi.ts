import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { moonbeam } from "wagmi/chains";

// CRITICAL: This app is configured for Moonbeam Mainnet (Chain ID: 1284)
// This is the production network - transactions will cost real GLMR!
export const wagmiConfig = getDefaultConfig({
	appName: "Tayeb Sharia DeFi",
	projectId: "your-walletconnect-project-id", // Get from WalletConnect Cloud
	chains: [moonbeam], // Chain ID: 1284 - MAINNET
	transports: {
		[moonbeam.id]: http("https://rpc.api.moonbeam.network"),
	},
	ssr: false, 
});

// Export the mainnet chain and chain ID for validation
export { moonbeam };
export const REQUIRED_CHAIN_ID = moonbeam.id; // 1284
export const REQUIRED_CHAIN_NAME = moonbeam.name; // "Moonbeam"
