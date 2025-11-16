import { useState } from "react";

export function HydraQuotePage() {
	const [tokenIn, setTokenIn] = useState("GLMR");
	const [tokenOut, setTokenOut] = useState("DOT");
	const [amountIn, setAmountIn] = useState("1000000000000000000"); // 1 GLMR in wei
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<any>(null);
	const [error, setError] = useState<string | null>(null);

	const runQuote = async () => {
		setError(null);
		setResult(null);
		setLoading(true);
		try {
			const mod: any = await import("@galacticcouncil/sdk");
			const GC: any = mod?.default ?? mod;

			const inAsset =
				GC.Registry?.findAssetBySymbol?.(tokenIn) ??
				GC.Registry?.getAsset?.(tokenIn) ??
				{ id: tokenIn, decimals: tokenIn === "GLMR" ? 18 : 12 };
			const outAsset =
				GC.Registry?.findAssetBySymbol?.(tokenOut) ??
				GC.Registry?.getAsset?.(tokenOut) ??
				{ id: tokenOut, decimals: tokenOut === "DOT" ? 10 : 12 };

			const Router = GC.TradeRouter || GC.Router || GC?.default?.Router;
			const router =
				typeof Router === "function" && Router.prototype
					? new Router()
					: typeof Router?.create === "function"
					? await Router.create()
					: Router;

			if (!router) {
				throw new Error("Router not available from @galacticcouncil/sdk");
			}

			let res: any = null;
			if (router.getBestTrade) {
				res = await router.getBestTrade({
					tokenIn: inAsset.id,
					tokenOut: outAsset.id,
					amountIn,
				});
			} else if (router.quote) {
				res = await router.quote({
					tokenIn: inAsset.id,
					tokenOut: outAsset.id,
					amountIn,
				});
			} else if (router.getBestRoute) {
				res = await router.getBestRoute(inAsset.id, outAsset.id, amountIn);
			} else {
				throw new Error("No quote method found on Router");
			}

			const amountOut =
				res?.amountOut || res?.outAmount || res?.route?.amountOut || "0";
			setResult({
				tokenIn: inAsset.id,
				tokenOut: outAsset.id,
				amountIn,
				amountOut,
				route: res?.route || res?.paths || null,
			});
		} catch (e: any) {
			setError(e?.message || String(e));
		} finally {
			setLoading(false);
		}
	};

	return (
		<main className='flex flex-1 justify-center py-10 sm:py-16 px-4'>
			<div className='flex flex-col w-full max-w-xl gap-4 text-white'>
				<h1 className='text-[28px] font-bold text-center'>Hydra Quote (SDK‑only)</h1>

				<div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
					<label className='flex flex-col gap-1'>
						<span className='text-sm text-white/70'>Token In (symbol)</span>
						<input
							className='p-2 rounded bg-[#10261f] border border-[#23483c]'
							value={tokenIn}
							onChange={(e) => setTokenIn(e.target.value)}
						/>
					</label>
					<label className='flex flex-col gap-1'>
						<span className='text-sm text-white/70'>Token Out (symbol)</span>
						<input
							className='p-2 rounded bg-[#10261f] border border-[#23483c]'
							value={tokenOut}
							onChange={(e) => setTokenOut(e.target.value)}
						/>
					</label>
					<label className='flex flex-col gap-1 sm:col-span-2'>
						<span className='text-sm text-white/70'>Amount In (smallest units)</span>
						<input
							className='p-2 rounded bg-[#10261f] border border-[#23483c]'
							value={amountIn}
							onChange={(e) => setAmountIn(e.target.value)}
						/>
					</label>
				</div>

				<button
					onClick={runQuote}
					disabled={loading}
					className='h-12 bg-primary text-black font-bold rounded hover:opacity-90 disabled:opacity-40'
				>
					{loading ? "Quoting..." : "Get Quote"}
				</button>

				{error && <div className='text-red-400 text-sm'>{error}</div>}
				{result && (
					<pre className='whitespace-pre-wrap break-words bg-[#0e221b] p-3 rounded border border-[#23483c] text-xs'>
{JSON.stringify(result, null, 2)}
					</pre>
				)}
			</div>
		</main>
	);
}


