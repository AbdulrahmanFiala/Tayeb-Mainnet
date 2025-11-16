import {
	useAccount,
	useChainId,
	useConnect,
	useDisconnect,
	useSwitchChain,
	useConnectors,
} from "wagmi";
import { moonbeam } from "wagmi/chains";
import type { Connector } from "wagmi";

/**
 * Refactored wallet hook using Wagmi v2
 * Replaces the old ethers-based useWallet hook
 */
export function useWallet() {
	const { address, isConnected, chain } = useAccount();
	const chainId = useChainId();
	const { switchChain } = useSwitchChain();
	const { connect, error: connectError, isPending } = useConnect();
	const { disconnect } = useDisconnect();
	const availableConnectors = useConnectors();

	// Check if on Moonbeam mainnet
	const isOnMoonbeam = chainId === moonbeam.id;

	// Connect wallet with a specific connector
	const connectWallet = (connector?: Connector) => {
		if (connector) {
			connect({ connector });
		} else {
			// Fallback: try to use the first available injected connector (MetaMask)
			const injectedConnector = availableConnectors.find(
				(c) => c.id === "injected" || c.name.toLowerCase().includes("metamask")
			);
			if (injectedConnector) {
				connect({ connector: injectedConnector });
			}
		}
	};

	// Switch to Moonbeam if not already on it
	const switchToMoonbeam = async () => {
		if (!isOnMoonbeam && switchChain) {
			try {
				await switchChain({ chainId: moonbeam.id });
			} catch (error) {
				// If switch fails, the chain might not be added to MetaMask
				// The error will be handled by the caller
				throw error;
			}
		}
	};

	// Disconnect wallet
	const disconnectWallet = () => {
		disconnect();
	};

	return {
		address,
		isConnected,
		chainId,
		chain,
		isOnMoonbeam,
		connectWallet,
		switchToMoonbeam,
		disconnectWallet,
		connectors: availableConnectors,
		connectError,
		isConnecting: isPending,
	};
}
