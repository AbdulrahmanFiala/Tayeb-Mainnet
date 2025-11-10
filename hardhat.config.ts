import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
      evmVersion: "london",
    },
  },
  networks: {
    // Moonbeam Mainnet (Production)
    moonbeam: {
      url: process.env.MOONBEAM_RPC_URL || "https://rpc.api.moonbeam.network",
      chainId: 1284,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gas: 5000000,
      gasPrice: 1000000000, // 1 Gwei
      timeout: 300000, // 5 minutes
    },
    // Chopsticks fork / custom RPC (set via .env)
    chopsticks: {
      url: process.env.CHOPSTICKS_RPC_URL || "http://127.0.0.1:9949",
      chainId: process.env.CHOPSTICKS_CHAIN_ID ? Number(process.env.CHOPSTICKS_CHAIN_ID) : 1284,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gas: 5000000,
      gasPrice: 1000000000,
      timeout: 300000,
    },
    // Local Hardhat network
    hardhat: {
      chainId: 1337,
    },
  },
  // Cross-chain XCM configuration
  // Hydration (parachain 2034) is a Substrate chain, not EVM-compatible
  // XCM integration uses Moonbeam's XCM Transactor precompile at 0x0806
  // See config/xcmConfig.json for full Hydration Omnipool configuration
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "", 
    customChains: [
      {
        network: "moonbeam",
        chainId: 1284,
        urls: {
          apiURL: "https://api-moonscan.io/api",
          browserURL: "https://moonscan.io",
        },
      },
    ],
  },
  sourcify: {
    enabled: true, 
  },
};

export default config;

