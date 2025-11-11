import stellaSwap from "@stellaswap/swap-sdk";
import { ethers } from "ethers";
import halaCoinsConfig from "../../config/halaCoins.json";
import { HalaCoinsConfig } from "../../config/types";

interface CliOptions {
  tokenIn?: string;
  tokenOut?: string;
  amount?: string;
  rawAmount?: string;
  slippageBps: number;
  account: string;
  dumpRaw: boolean;
}

interface TokenLookupResult {
  symbol: string;
  name: string;
  decimals: number;
  address: string;
  isVariant: boolean;
  baseSymbol: string;
}

interface QuoteSummary {
  path: string[] | null;
  router: string | null;
  amountOut: string | null;
  raw: any;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function usage(): never {
  console.log(`\nUsage: npm run plan:local-swap -- --token-in USDC_WH --token-out USDT --amount 100 --slippage-bps 100\n`);
  console.log("Options:");
  console.log("  --token-in,  -i    Symbol or variant symbol from halaCoins.json");
  console.log("  --token-out, -o    Symbol or variant symbol from halaCoins.json");
  console.log("  --amount,    -a    Human-readable amount of the input token");
  console.log("  --raw-amount     Amount already in smallest units (overrides --amount)");
  console.log("  --slippage-bps   Slippage in basis points (default 100 = 1%)");
  console.log("  --account        Optional wallet address for quoting (default zero address)");
  console.log("  --dump           Print raw quote payload from StellaSwap SDK");
  console.log();
  process.exit(1);
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    slippageBps: 100,
    account: ZERO_ADDRESS,
    dumpRaw: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--token-in":
      case "--in":
      case "-i":
        options.tokenIn = args[++i];
        break;
      case "--token-out":
      case "--out":
      case "-o":
        options.tokenOut = args[++i];
        break;
      case "--amount":
      case "-a":
        options.amount = args[++i];
        break;
      case "--raw-amount":
        options.rawAmount = args[++i];
        break;
      case "--slippage-bps":
        options.slippageBps = Number(args[++i]);
        break;
      case "--account":
        options.account = args[++i];
        break;
      case "--dump":
        options.dumpRaw = true;
        break;
      case "--help":
      case "-h":
        usage();
        break;
      default:
        if (arg.startsWith("--")) {
          console.error(`Unknown option: ${arg}`);
          usage();
        }
        break;
    }
  }

  if (!options.tokenIn || !options.tokenOut || (!options.amount && !options.rawAmount)) {
    usage();
  }

  if (Number.isNaN(options.slippageBps) || options.slippageBps <= 0) {
    console.error("Invalid --slippage-bps value. Use positive integer basis points.");
    process.exit(1);
  }

  return options;
}

function normaliseSymbol(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function lookupToken(symbol: string, config: HalaCoinsConfig): TokenLookupResult {
  const normalized = normaliseSymbol(symbol);

  for (const coin of config.coins) {
    if (normaliseSymbol(coin.symbol) === normalized) {
      const address = coin.addresses?.moonbeam ?? null;
      if (!address) {
        throw new Error(`Token ${coin.symbol} is missing a Moonbeam address in halaCoins.json`);
      }
      return {
        symbol: coin.symbol,
        name: coin.name,
        decimals: coin.decimals,
        address,
        isVariant: false,
        baseSymbol: coin.symbol,
      };
    }

    if (coin.variants) {
      for (const variant of coin.variants) {
        if (normaliseSymbol(variant.symbol) === normalized) {
          const address = variant.addresses?.moonbeam ?? null;
          if (!address) {
            throw new Error(`Variant ${variant.symbol} is missing a Moonbeam address in halaCoins.json`);
          }
          const decimals = variant.decimals ?? coin.decimals;
          return {
            symbol: variant.symbol,
            name: variant.name ?? `${coin.name} (${variant.symbol})`,
            decimals,
            address,
            isVariant: true,
            baseSymbol: coin.symbol,
          };
        }
      }
    }
  }

  throw new Error(`Unable to find token symbol '${symbol}' in halaCoins.json`);
}

function resolveSymbolByAddress(address: string, config: HalaCoinsConfig): string | null {
  const target = address.toLowerCase();
  for (const coin of config.coins) {
    const coinAddress = coin.addresses?.moonbeam;
    if (coinAddress && coinAddress.toLowerCase() === target) {
      return coin.symbol;
    }

    if (coin.variants) {
      for (const variant of coin.variants) {
        const variantAddress = variant.addresses?.moonbeam;
        if (variantAddress && variantAddress.toLowerCase() === target) {
          return variant.symbol;
        }
      }
    }
  }
  return null;
}

function extractRouter(result: any): string | null {
  if (!result) return null;

  const candidates: Array<unknown> = [
    result.routerAddress,
    result.router,
    result?.execution?.router,
    result?.execution?.routerAddress,
    result?.route?.router,
    result?.bestRoute?.router,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.startsWith("0x")) {
      return candidate;
    }
  }

  if (Array.isArray(result?.routes)) {
    for (const route of result.routes) {
      if (typeof route?.routerAddress === "string" && route.routerAddress.startsWith("0x")) {
        return route.routerAddress;
      }
      if (typeof route?.router === "string" && route.router.startsWith("0x")) {
        return route.router;
      }
    }
  }

  return null;
}

function extractPath(result: any): string[] | null {
  if (!result) return null;

  const rawCandidates = [
    result.path,
    result?.route?.path,
    result?.bestRoute?.path,
  ];

  for (const candidate of rawCandidates) {
    if (Array.isArray(candidate) && candidate.length > 1) {
      if (typeof candidate[0] === "string") {
        return candidate as string[];
      }
      if (candidate[0] && typeof candidate[0].address === "string") {
        return candidate.map((node: any) => node.address);
      }
    }
  }

  if (Array.isArray(result?.routes)) {
    for (const route of result.routes) {
      if (Array.isArray(route?.path) && route.path.length > 1) {
        if (typeof route.path[0] === "string") {
          return route.path as string[];
        }
        if (route.path[0] && typeof route.path[0].address === "string") {
          return route.path.map((node: any) => node.address);
        }
      }
      if (Array.isArray(route?.steps)) {
        for (const step of route.steps) {
          if (Array.isArray(step?.path) && step.path.length > 1) {
            if (typeof step.path[0] === "string") {
              return step.path as string[];
            }
            if (step.path[0] && typeof step.path[0].address === "string") {
              return step.path.map((node: any) => node.address);
            }
          }
        }
      }
    }
  }

  return null;
}

function extractAmountOut(result: any): string | null {
  if (!result) return null;
  const candidates: Array<unknown> = [
    result.amountOut,
    result?.route?.amountOut,
    result?.bestRoute?.amountOut,
    result?.routes?.[0]?.amountOut,
    result?.execution?.amountOut,
  ];

  for (const candidate of candidates) {
    if (!candidate && candidate !== 0) continue;
    if (typeof candidate === "string") return candidate;
    if (typeof candidate === "number") return candidate.toString();
  }

  return null;
}

async function fetchQuote(
  tokenIn: TokenLookupResult,
  tokenOut: TokenLookupResult,
  amountInRaw: string,
  account: string,
  slippageBps: number
): Promise<QuoteSummary> {
  const originalConsoleError = console.error;
  const suppressedErrors: string[] = [];
  console.error = (...args: unknown[]) => {
    suppressedErrors.push(args.map(String).join(" "));
  };

  try {
    const quote = await stellaSwap.getQuote(
      tokenIn.address,
      tokenOut.address,
      amountInRaw,
      account,
      slippageBps.toString()
    );

    const payload = quote?.result ?? quote;

    if (!payload || quote?.isSuccess === false) {
      const errorMessage = quote?.message ?? "Unknown error from StellaSwap router API";
      throw new Error(errorMessage);
    }

    if (suppressedErrors.length > 0) {
      suppressedErrors.forEach((entry) => {
        console.warn("ℹ️  StellaSwap SDK message:", entry);
      });
    }

    return {
      path: extractPath(payload),
      router: extractRouter(payload),
      amountOut: extractAmountOut(payload),
      raw: payload,
    };
  } catch (error: any) {
    const message = error?.message ?? error?.toString?.() ?? "Unknown error";
    console.warn("⚠️  Failed to fetch quote from StellaSwap SDK:", message);
    if (error?.response?.data) {
      console.warn("   Response payload:", JSON.stringify(error.response.data, null, 2));
    }
    if (suppressedErrors.length > 0) {
      suppressedErrors.forEach((entry) => {
        console.warn("   SDK log:", entry);
      });
    }

    return {
      path: null,
      router: null,
      amountOut: null,
      raw: null,
    };
  } finally {
    console.error = originalConsoleError;
  }
}

async function main() {
  const options = parseArgs();

  const config = halaCoinsConfig as HalaCoinsConfig;

  let tokenIn: TokenLookupResult;
  let tokenOut: TokenLookupResult;

  try {
    tokenIn = lookupToken(options.tokenIn!, config);
    tokenOut = lookupToken(options.tokenOut!, config);
  } catch (error: any) {
    console.error("❌", error.message ?? error);
    process.exit(1);
    return;
  }

  let amountInRaw: string;

  if (options.rawAmount) {
    amountInRaw = options.rawAmount;
  } else {
    try {
      amountInRaw = ethers.parseUnits(options.amount!, tokenIn.decimals).toString();
    } catch (error: any) {
      console.error("❌ Failed to parse --amount:", error.message ?? error);
      process.exit(1);
      return;
    }
  }

  console.log("🔍 StellaSwap Route Planner\n");

  console.log("Input token:");
  console.log(`  Symbol:       ${tokenIn.symbol}${tokenIn.isVariant ? ` (variant of ${tokenIn.baseSymbol})` : ""}`);
  console.log(`  Name:         ${tokenIn.name}`);
  console.log(`  Address:      ${tokenIn.address}`);
  console.log(`  Decimals:     ${tokenIn.decimals}`);

  console.log("\nOutput token:");
  console.log(`  Symbol:       ${tokenOut.symbol}${tokenOut.isVariant ? ` (variant of ${tokenOut.baseSymbol})` : ""}`);
  console.log(`  Name:         ${tokenOut.name}`);
  console.log(`  Address:      ${tokenOut.address}`);
  console.log(`  Decimals:     ${tokenOut.decimals}`);

  console.log("\nQuote parameters:");
  console.log(`  Amount (human):   ${options.amount ?? "(raw units supplied)"}`);
  console.log(`  Amount (raw):     ${amountInRaw}`);
  console.log(`  Slippage (bps):   ${options.slippageBps}`);
  console.log(`  Account:          ${options.account}`);

  const quoteSummary = await fetchQuote(
    tokenIn,
    tokenOut,
    amountInRaw,
    options.account,
    options.slippageBps
  );

  if (!quoteSummary.router || !quoteSummary.path || quoteSummary.path.length < 2) {
    console.error("\n❌ StellaSwap SDK did not return a usable route. Tayeb only executes swaps that are planned by external router SDKs.");
    console.error("   Please retry later or contact StellaSwap support if the issue persists.");
    process.exit(1);
  }

  console.log("\n✅ Router suggested by StellaSwap SDK:");
  console.log(`  ${quoteSummary.router}`);

  if (quoteSummary.path && quoteSummary.path.length > 1) {
    console.log("\n🛣️  Suggested swap path:");
    quoteSummary.path.forEach((address, index) => {
      const symbol = resolveSymbolByAddress(address, config);
      console.log(`  [${index}] ${address}${symbol ? ` (${symbol})` : ""}`);
    });
  }

  if (quoteSummary.amountOut) {
    try {
      const human = ethers.formatUnits(quoteSummary.amountOut, tokenOut.decimals);
      console.log("\n📈 Estimated output:");
      console.log(`  Raw:    ${quoteSummary.amountOut}`);
      console.log(`  Human:  ${human}`);
    } catch {
      console.log("\n📈 Estimated output (raw units):");
      console.log(`  ${quoteSummary.amountOut}`);
    }
  }

  if (options.dumpRaw && quoteSummary.raw) {
    console.log("\n🧾 Raw response payload:");
    console.log(JSON.stringify(quoteSummary.raw, null, 2));
  }

  console.log("\nNext steps:");
  console.log("  1. Ensure the output symbol is registered and permissible in ShariaCompliance.");
  console.log("  2. Use the path and router above when calling ShariaLocalSwap.swapShariaCompliant or swapGLMRForToken.");
  console.log("  3. If routing fails again, wait for the external DEX SDK to respond; Tayeb will not execute swaps without it.");

  console.log("\n✅ Route planning complete.\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Unexpected error:", error);
    process.exit(1);
  });
