import hre from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface DeployedContracts {
  main?: {
    crosschainSwapInitiator?: string;
  };
}

async function main() {
  const newMinGas = BigInt(process.env.MIN_XCM_GAS ?? "2000000000"); // default: 2,000,000,000
  const deployedPath = path.join(__dirname, "../../config/deployedContracts.json");
  const deployed: DeployedContracts = JSON.parse(fs.readFileSync(deployedPath, "utf-8"));

  const crosschainAddress = deployed.main?.crosschainSwapInitiator;
  if (!crosschainAddress) {
    throw new Error("CrosschainSwapInitiator address not found in deployedContracts.json");
  }

  const { ethers } = hre;
  const [signer] = await ethers.getSigners();

  console.log("\n🔧 Updating minXcmGas");
  console.log("   Signer:", signer.address);
  console.log("   CrosschainSwapInitiator:", crosschainAddress);
  console.log("   New minXcmGas:", newMinGas.toString());

  const crosschain = await ethers.getContractAt(
    "CrosschainSwapInitiator",
    crosschainAddress,
    signer
  );

  const current = await crosschain.minXcmGas();
  console.log("   Current minXcmGas:", current.toString());

  if (current === newMinGas) {
    console.log("   ✅ Already set to desired value, nothing to do.");
    return;
  }

  const feeData = await signer.provider.getFeeData();
  const maxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
  const maxPriorityFeePerGas =
    feeData.maxPriorityFeePerGas ?? ethers.parseUnits("1", "gwei");

  if (!maxFeePerGas) {
    throw new Error("Unable to determine gas price");
  }

  const tx = await crosschain.updateMinXcmGas(newMinGas, {
    maxFeePerGas,
    maxPriorityFeePerGas,
  });
  console.log("   Tx hash:", tx.hash);
  const receipt = await tx.wait();
  console.log("   ✅ minXcmGas updated in block", receipt?.blockNumber);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Failed to update minXcmGas:", err);
    process.exit(1);
  });

