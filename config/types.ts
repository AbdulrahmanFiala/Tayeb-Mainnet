/**
 * Type definitions for Hala Coins configuration
 */

export interface HalaCoin {
  symbol: string;
  name: string;
  decimals: number;
  complianceReason: string;
  description: string;
  permissible: boolean; // Maps to contract's 'verified' field
  addresses: {
    moonbeam: string | null;
  };
}

export interface HalaCoinsConfig {
  coins: HalaCoin[];
  stablecoins: string[];
  metadata: {
    version: string;
    lastUpdated: string | null;
    network: string;
  };
}

/**
 * Helper function to get non-stablecoin Hala Coins
 */
export function getNonStablecoins(config: HalaCoinsConfig): HalaCoin[] {
  return config.coins.filter(coin => !config.stablecoins.includes(coin.symbol));
}

/**
 * Helper function to get stablecoins only
 */
export function getStablecoins(config: HalaCoinsConfig): HalaCoin[] {
  return config.coins.filter(coin => config.stablecoins.includes(coin.symbol));
}

/**
 * Helper function to find a coin by symbol
 */
export function getCoinBySymbol(config: HalaCoinsConfig, symbol: string): HalaCoin | undefined {
  return config.coins.find(coin => coin.symbol === symbol);
}

/**
 * Helper function to get all coin symbols
 */
export function getAllSymbols(config: HalaCoinsConfig): string[] {
  return config.coins.map(coin => coin.symbol);
}

// ============================================================================
// Deployed Contracts Types
// ============================================================================

export interface DeployedAMM {
  factory: string | null;
  router: string | null;
  weth: string | null;
}

export interface DeployedMain {
  shariaCompliance: string | null;
  shariaSwap: string | null;
  shariaDCA: string | null;
  remoteSwapInitiator?: string | null;
}

export interface DeploymentMetadata {
  deploymentDate: string | null;
  deployer: string | null;
}

export interface DeployedContracts {
  network: string;
  version: string;
  lastDeployed: string | null;
  amm: DeployedAMM;
  main: DeployedMain;
  tokens: { [key: string]: string | null }; // Token addresses by symbol: e.g., "BTC": "0x..."
  pairs: { [key: string]: string | null }; // Dedicated pairs section: e.g., "BTC_USDC": "0x..."
  metadata: DeploymentMetadata;
}

