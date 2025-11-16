const mod = await import("@galacticcouncil/sdk");
const GC = mod?.default ?? mod;

async function main() {
  const amountIn = process.env.AMOUNT_IN || "1000000000000000000"; // 1e18 (GLMR, 18 dp)
  const tokenInSymbol = process.env.TOKEN_IN || "GLMR";
  const tokenOutSymbol = process.env.TOKEN_OUT || "DOT";

  // Resolve assets
  const inAsset =
    GC.Registry?.findAssetBySymbol?.(tokenInSymbol) ??
    GC.Registry?.getAsset?.(tokenInSymbol) ??
    { id: tokenInSymbol, decimals: tokenInSymbol === "GLMR" ? 18 : 12 };
  const outAsset =
    GC.Registry?.findAssetBySymbol?.(tokenOutSymbol) ??
    GC.Registry?.getAsset?.(tokenOutSymbol) ??
    { id: tokenOutSymbol, decimals: tokenOutSymbol === "DOT" ? 10 : 12 };

  // Instantiate Router
  const Router = GC.TradeRouter || GC.Router || GC.default?.Router;
  const router =
    typeof Router === "function" && Router.prototype ? new Router() : Router?.create ? await Router.create() : Router;

  if (!router) {
    console.error("Router not available from @galacticcouncil/sdk");
    process.exit(1);
  }

  // Get quote/best trade
  let result;
  if (router.getBestTrade) {
    result = await router.getBestTrade({
      tokenIn: inAsset.id,
      tokenOut: outAsset.id,
      amountIn,
    });
  } else if (router.quote) {
    result = await router.quote({
      tokenIn: inAsset.id,
      tokenOut: outAsset.id,
      amountIn,
    });
  } else if (router.getBestRoute) {
    result = await router.getBestRoute(inAsset.id, outAsset.id, amountIn);
  } else {
    console.error("No quote method found on Router.");
    process.exit(1);
  }

  const outAmount = result?.amountOut || result?.outAmount || result?.route?.amountOut || "0";
  console.log(JSON.stringify({
    tokenIn: inAsset.id,
    tokenOut: outAsset.id,
    amountIn,
    amountOut: outAmount,
    route: result?.route || result?.paths || null,
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


