import hre from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import tayebCoinsConfig from "../../config/tayebCoins.json";
import deployedContractsConfig from "../../config/deployedContracts.json";
import { TayebCoin, TayebCoinVariant, TayebCoinsConfig, DeployedContracts } from "../../config/types";
import { buildTxOverrides, deployOrVerifyContract } from "../utils/deployHelpers";

dotenv.config();

const { ethers } = hre;

function collectEntries(coin: TayebCoin) {
  const entries: Array<{
    symbol: string;
    name: string;
    complianceReason: string;
    address: string | null;
    isVariant: boolean;
    baseSymbol: string;
  }> = [];

  if (coin.addresses?.moonbeam) {
    entries.push({
      symbol: coin.symbol,
      name: coin.name,
      complianceReason: coin.complianceReason,
      address: coin.addresses.moonbeam,
      isVariant: false,
      baseSymbol: coin.symbol,
    });
  }

  if (coin.variants && coin.variants.length > 0) {
    for (const variant of coin.variants) {
      const moonbeamAddress = variant.addresses?.moonbeam ?? null;
      if (!moonbeamAddress) continue;

      // Convert variant symbol from WBTC_WH to WBTC.wh format
      // Extract the suffix (WH, XC, E, etc.) and convert to lowercase with dot
      const variantSymbol = variant.symbol;
      const underscoreIndex = variantSymbol.lastIndexOf('_');
      let formattedSymbol: string;
      
      if (underscoreIndex > 0) {
        const base = variantSymbol.substring(0, underscoreIndex);
        const suffix = variantSymbol.substring(underscoreIndex + 1).toLowerCase();
        formattedSymbol = `${base}.${suffix}`;
      } else {
        formattedSymbol = variantSymbol;
      }

      entries.push({
        symbol: formattedSymbol,
        name: variant.name ?? `${coin.name} (${formattedSymbol})`,
        complianceReason: variant.complianceReason ?? coin.complianceReason,
        address: moonbeamAddress,
        isVariant: true,
        baseSymbol: coin.symbol,
      });
    }
  }

  return entries;
}

async function registerCoins(
  shariaCompliance: any,
  config: TayebCoinsConfig
): Promise<{ registered: number; skipped: number }> {
  const registeredCoins = await shariaCompliance.getAllShariaCoins();
  const registeredSymbols = new Set(registeredCoins.map((c: any) => c.id));

  let registeredCount = 0;
  let skippedCount = 0;

  for (const coin of config.coins) {
    const entries = collectEntries(coin);

    if (entries.length === 0) {
      console.warn(
        `⚠️  ${coin.symbol} has no Moonbeam address or variants with addresses, skipping...`
      );
      skippedCount++;
      continue;
    }

    for (const entry of entries) {
      const displayLabel = entry.isVariant
        ? `${entry.symbol} (variant of ${entry.baseSymbol})`
        : entry.symbol;

      if (registeredSymbols.has(entry.symbol)) {
        console.log(`⏭️  ${displayLabel} already registered, skipping...`);
        skippedCount++;
        continue;
      }

      try {
        const overrides = await buildTxOverrides();
        const tx = await shariaCompliance.registerShariaCoin(
          entry.symbol,
          entry.name,
          entry.symbol,
          entry.address,
          entry.complianceReason,
          overrides
        );
        await tx.wait();
        console.log(`✅ Registered ${displayLabel} (${entry.name}) in ShariaCompliance`);
        registeredCount++;
      } catch (error: any) {
        if (
          error.message?.includes("CoinAlreadyExists") ||
          error.reason?.includes("CoinAlreadyExists")
        ) {
          console.log(`⏭️  ${displayLabel} already exists in ShariaCompliance, skipping...`);
          skippedCount++;
        } else {
          console.warn(
            `⚠️  Failed to register ${displayLabel} in ShariaCompliance:`,
            error.message
          );
        }
      }
    }
  }

  return { registered: registeredCount, skipped: skippedCount };
}

async function main() {
  const config = tayebCoinsConfig as TayebCoinsConfig;
  const contractsConfig = deployedContractsConfig as DeployedContracts;

  const [deployer] = await ethers.getSigners();

  console.log("🚀 Deploying ShariaCompliance...\n");
  console.log("Account:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "GLMR\n");

  const txOverrides = await buildTxOverrides();

  const shariaComplianceAddress = await deployOrVerifyContract(
    "ShariaCompliance",
    contractsConfig.main.shariaCompliance,
    async () => {
      const ShariaCompliance = await ethers.getContractFactory("ShariaCompliance");
      return await ShariaCompliance.deploy(txOverrides);
    }
  );
  const shariaCompliance = await ethers.getContractAt("ShariaCompliance", shariaComplianceAddress);
  console.log();

  console.log("📝 Registering coins in ShariaCompliance...");
  const totalEntries = config.coins.reduce((count: number, coin: TayebCoin) => {
    const base = coin.addresses?.moonbeam ? 1 : 0;
    const variants =
      coin.variants?.filter((variant: TayebCoinVariant) => variant.addresses?.moonbeam).length ?? 0;
    return count + base + variants;
  }, 0);
  console.log(`📊 Entries with Moonbeam addresses: ${totalEntries}`);

  const { registered, skipped } = await registerCoins(shariaCompliance, config);
  console.log(`\n📊 Registration summary: ${registered} new, ${skipped} skipped\n`);

  console.log("📝 Updating deployedContracts.json...");
  const contractsPath = path.join(__dirname, "..", "..", "config", "deployedContracts.json");

  const updatedContracts: DeployedContracts = {
    ...contractsConfig,
    network: "moonbeam",
    lastDeployed: new Date().toISOString(),
    main: {
      ...contractsConfig.main,
      shariaCompliance: shariaComplianceAddress,
    },
    metadata: {
      ...contractsConfig.metadata,
      deploymentDate: new Date().toISOString(),
      deployer: deployer.address,
    },
  };

  fs.writeFileSync(contractsPath, JSON.stringify(updatedContracts, null, 2) + "\n");
  console.log("✅ deployedContracts.json updated\n");

  console.log("=".repeat(60));
  console.log("📋 DEPLOYMENT SUMMARY");
  console.log("=".repeat(60));
  console.log("ShariaCompliance:", shariaComplianceAddress);
  console.log("=".repeat(60));
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


