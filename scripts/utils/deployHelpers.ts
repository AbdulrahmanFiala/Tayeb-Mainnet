import hre from "hardhat";
import type { BaseContract, BigNumberish } from "ethers";

const { ethers } = hre;

/**
 * Helper function to deploy or verify a contract
 * 
 * Checks if a contract already exists at the given address (on-chain verification).
 * If valid, returns the existing address. Otherwise, deploys a new contract.
 * 
 * @param contractName - Name of the contract for logging purposes
 * @param existingAddress - Existing contract address from config (can be null/undefined)
 * @param deployFn - Async function that returns a contract instance to deploy
 * @returns The contract address (existing or newly deployed)
 */
export async function deployOrVerifyContract<T extends BaseContract>(
  contractName: string,
  existingAddress: string | null | undefined,
  deployFn: () => Promise<T>
): Promise<string> {
  // Check if contract already exists and is valid
  if (existingAddress && existingAddress !== null && existingAddress !== "null") {
    try {
      const code = await ethers.provider.getCode(existingAddress);
      if (code && code !== "0x") {
        console.log(`⏭️  ${contractName} already deployed at: ${existingAddress}`);
        return existingAddress;
      }
    } catch (error) {
      // Verification failed, will deploy below
    }
    console.log(`⚠️  ${contractName} address in JSON but contract not found on-chain, redeploying...`);
  }

  // Deploy new contract
  const contract = await deployFn();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`✅ ${contractName} deployed to: ${address}`);
  return address;
}

type TxOverrides =
  | {
      maxFeePerGas: BigNumberish;
      maxPriorityFeePerGas: BigNumberish;
    }
  | {
      gasPrice: BigNumberish;
    }
  | Record<string, never>;

/**
 * Builds transaction overrides with gas parameters appropriate for Moonbeam.
 * Ensures the submitted fee is above the current base fee to avoid "gas price less than block base fee".
 */
export async function buildTxOverrides(): Promise<TxOverrides> {
  const feeData = await ethers.provider.getFeeData();

  const gwei = (value: string) => ethers.parseUnits(value, "gwei");

  const priority =
    feeData.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas > 0n
      ? feeData.maxPriorityFeePerGas
      : gwei("2");

  const baseCandidate = feeData.maxFeePerGas ?? feeData.gasPrice ?? gwei("150");

  const buffer = gwei("5");
  const maxFee = baseCandidate + priority + buffer;

  if (feeData.maxFeePerGas !== null) {
    return {
      maxFeePerGas: maxFee,
      maxPriorityFeePerGas: priority,
    };
  }

  if (feeData.gasPrice) {
    const gasPrice = feeData.gasPrice > baseCandidate ? feeData.gasPrice : baseCandidate + buffer;
    return { gasPrice };
  }

  return {};
}

