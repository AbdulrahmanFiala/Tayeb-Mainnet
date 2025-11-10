import hre from "hardhat";
import type { BaseContract } from "ethers";

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

