import { useEffect, useMemo, useState } from "react";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { moonbeam } from "wagmi/chains";
import { assets, handleSwapExecuteTransfer, isForeignAsset } from "@paraspell/sdk";
import { parseUnits } from "viem";

type QuoteResult = {
  routeSummary?: unknown;
  minReceive?: string;
};

export function CrossChainOneClickCard() {
  const { address: evmAddress, isConnected, chain } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  const [destinationChain] = useState("Hydration" as const);
  const [recipient, setRecipient] = useState<string>("");
  const [confirmRecipient, setConfirmRecipient] = useState(false);
  const [amount, setAmount] = useState<string>(""); // smallest units (auto-derived)
  const [amountHuman, setAmountHuman] = useState<string>(""); // GLMR (18 d.p.)
  const [currencyKey, setCurrencyKey] = useState<string>(""); // locked to GLMR internally
  const [slippageBps, setSlippageBps] = useState<number>(50); // 0.50% default
  const outSymbol = "DOT"; // lock swap output to DOT on Hydra
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  const supportedAssets = useMemo(
    () => assets.getSupportedAssets("Moonbeam", destinationChain),
    [destinationChain]
  );

  const currencyMap = useMemo(() => {
    return supportedAssets.reduce((map: Record<string, any>, asset) => {
      const key = `${asset.symbol ?? "NO_SYMBOL"}-${"assetId" in asset ? asset.assetId : "Location"}`;
      map[key] = asset;
      return map;
    }, {});
  }, [supportedAssets]);

  useEffect(() => {
    if (supportedAssets.length > 0 && !currencyKey) {
      // Lock to GLMR as the only send asset
      const glmr = supportedAssets.find((a: any) => a?.symbol === "GLMR") || supportedAssets[0];
      // IMPORTANT: key must match how we build currencyMap where non-assetId uses "Location"
      const key = `${glmr.symbol ?? "GLMR"}-${"assetId" in glmr ? (glmr as any).assetId : "Location"}`;
      setCurrencyKey(key);
    }
  }, [supportedAssets, currencyKey]);

  // Derive smallest units from human GLMR input
  useEffect(() => {
    try {
      if (!amountHuman || Number(amountHuman) <= 0) {
        setAmount("");
        return;
      }
      const wei = parseUnits(amountHuman as `${number}`, 18);
      setAmount(wei.toString());
    } catch {
      // On parse error, keep previous smallest amount but do not crash
    }
  }, [amountHuman]);

  const runQuote = async () => {
    setError(null);
    setQuote(null);
    setQuoting(true);
    try {
      if (!amountHuman || Number(amountHuman) <= 0) {
        throw new Error("Enter a valid GLMR amount before quoting");
      }
      // Lazy-load Galactic SDK to obtain a swap route on HydraDX
      const gc: any = await import("@galacticcouncil/sdk");
      // Try to resolve HydraDX asset ids via SDK registry/helpers
      const registry = gc?.registry || gc?.Registry || gc?.default?.registry;
      const Router = gc?.Router || gc?.default?.Router || gc?.router;

      // Resolve in/out assets on Hydra
      // We assume input asset on Hydra equals the symbol selected on origin (if native mapping exists)
      // For precise mapping, you'd transform XCM incoming asset into Hydra asset id here.
      const selected = currencyMap[currencyKey];
      const inSymbol = selected?.symbol || "GLMR";

      const findAsset = (sym: string) =>
        (registry?.findAssetBySymbol?.(sym) ||
          registry?.getAsset?.(sym) ||
          registry?.assets?.find?.((a: any) => a?.symbol === sym) ||
          null);

      const inAsset = findAsset(inSymbol) || { id: inSymbol, decimals: 18 };
      const outAsset = findAsset(outSymbol) || { id: outSymbol, decimals: 12 };

      // Instantiate router if needed
      // Instantiate router - many SDKs export a class that must be constructed with `new`
      const routerInstance =
        Router
          ? (typeof Router === "function" && Router.prototype
              ? new Router()
              : typeof Router?.create === "function"
              ? await Router.create()
              : Router)
          : null;
      if (!routerInstance) {
        throw new Error("Hydra router is not available");
      }

      // Compute quote using common method names if available
      const amountBn = BigInt(amount || "0");
      let best: any = null;
      if (routerInstance?.getBestTrade) {
        best = await routerInstance.getBestTrade({
          tokenIn: inAsset.id,
          tokenOut: outAsset.id,
          amountIn: amountBn.toString(),
        });
      } else if (routerInstance?.quote) {
        best = await routerInstance.quote({
          tokenIn: inAsset.id,
          tokenOut: outAsset.id,
          amountIn: amountBn.toString(),
        });
      } else if (routerInstance?.getBestRoute) {
        best = await routerInstance.getBestRoute(inAsset.id, outAsset.id, amountBn.toString());
      }

      // Derive minReceive using slippage from returned outAmount if present
      let minReceive: string | undefined;
      if (best?.amountOut || best?.outAmount || best?.route?.amountOut) {
        const outAmountStr =
          best.amountOut || best.outAmount || best.route?.amountOut || "0";
        try {
          const outAmount = BigInt(outAmountStr);
          const bps = Number.isFinite(slippageBps) ? slippageBps : 50;
          minReceive = ((outAmount * BigInt(10000 - bps)) / 10000n).toString();
        } catch {
          minReceive = undefined;
        }
      } else {
        // Fallback: apply slippage directly on input as conservative floor
        try {
          const bps = Number.isFinite(slippageBps) ? slippageBps : 50;
          minReceive = ((amountBn * BigInt(10000 - bps)) / 10000n).toString();
        } catch {
          minReceive = undefined;
        }
      }

      const routeSummary =
        best?.route ||
        best?.paths ||
        best || { tokenIn: inAsset.id, tokenOut: outAsset.id, amountIn: amountBn.toString() };

      setQuote({ routeSummary, minReceive });
      // Simple console feedback for debugging
      // eslint-disable-next-line no-console
      console.log("Hydra route", { routeSummary, minReceive });
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setQuoting(false);
    }
  };

  const onSubmit = async () => {
    setError(null);
    setTxHash(null);

    if (!isConnected || !walletClient) {
      setError("Connect MetaMask first");
      return;
    }
    if (!recipient) {
      setError("Recipient address is required (HydraDX SS58)");
      return;
    }
    // Basic SS58 validation (prefix 63) - lightweight check:
    if (!/^5[0-9A-Za-z]{47,48}$/.test(recipient)) {
      setError("Invalid HydraDX address format (SS58).");
      return;
    }
    if (!confirmRecipient) {
      setError("Please confirm the recipient address is yours");
      return;
    }
    if (!amountHuman || Number(amountHuman) <= 0) {
      setError("Enter a valid GLMR amount");
      return;
    }
    if (chain?.id !== moonbeam.id) {
      try {
        await switchChainAsync({ chainId: moonbeam.id });
      } catch {
        setError("Please switch network to Moonbeam in your wallet");
        return;
      }
    }

    const asset = currencyMap[currencyKey];
    if (!asset) {
      setError("Invalid currency selection");
      return;
    }
    const currency = isForeignAsset(asset) && (asset as any).assetId
      ? { id: (asset as any).assetId, amount }
      : { symbol: asset.symbol || "", amount };

    // Use ParaSpell combined flow: deposit → swap via XCM-transact on Hydra → return to EVM
    // Supply swap route/minReceive (best-effort for now) built above.
    const options: any = {
      from: "Moonbeam",
      to: destinationChain,
      currency,
      address: recipient, // Substrate address on HydraDX for the mid-step
      swap: {
        route: quote?.routeSummary || {},
        minReceive: quote?.minReceive,
        slippageBps,
      },
      // result return-to address (Moonbeam EVM)
      returnAddress: evmAddress,
      // lock desired return asset to DOT (xcDOT on Moonbeam)
      returnCurrency: { symbol: "DOT" },
    };

    setSubmitting(true);
    try {
      // For EVM-origin, use EvmBuilder to construct and send from MetaMask WalletClient.
      // This executes the origin leg (Moonbeam -> Hydra recipient). The swap+return can be
      // run after confirmation or via relayer path if required.
      const { EvmBuilder } = await import("@paraspell/sdk");
      const hash = await EvmBuilder()
        .from("Moonbeam")
        .to(destinationChain)
        .currency(currency)
        .address(recipient)
        .signer(walletClient as any)
        .build();
      setTxHash(typeof hash === "string" ? hash : JSON.stringify(hash));
      // Kick off relayer job
      const relayerUrl = import.meta.env.VITE_RELAYER_URL || "http://localhost:8787/remote-swap";
      const resp = await fetch(relayerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Moonbeam",
          to: destinationChain,
          txHash: hash,
          recipient,
          amount,
          swap: { in: "GLMR", out: "DOT", slippageBps },
          returnAddress: evmAddress,
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setJobId(data.jobId);
        setJobStatus(data.status);
        // Start polling
        pollJobStatus(data.jobId);
      } else {
        const errText = await resp.text();
        setError(`Relayer error: ${errText}`);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const pollJobStatus = async (id: string) => {
    const base = (import.meta.env.VITE_RELAYER_URL || "http://localhost:8787/remote-swap").replace(/\/remote-swap$/, "");
    const statusUrl = `${base}/remote-swap/${id}`;
    let attempts = 0;
    const maxAttempts = 60;
    const interval = 3000;
    const tick = async () => {
      attempts++;
      try {
        const r = await fetch(statusUrl);
        if (r.ok) {
          const j = await r.json();
          setJobStatus(j.status);
          if (j.status === "completed" || j.status === "error") return;
        }
      } catch (_) {}
      if (attempts < maxAttempts) {
        setTimeout(tick, interval);
      }
    };
    setTimeout(tick, interval);
  };

  return (
    <div className='bg-[#1a3a2f] p-4 sm:p-6 rounded-xl border border-solid border-[#23483c] shadow-lg text-white'>
      <h2 className='text-xl font-bold mb-4'>One‑Click Cross‑Chain Swap (Moonbeam → Hydration → Moonbeam)</h2>
      <div className='space-y-4'>
        <div className='text-sm text-white/80'>
          From asset: <span className='font-bold'>GLMR</span> (locked)
        </div>

        <div>
          <label className='block text-sm mb-1'>Amount (GLMR)</label>
          <input
            className='w-full p-2 rounded bg-[#10261f] border border-[#23483c]'
            placeholder='e.g. 1.5'
            value={amountHuman}
            onChange={(e) => setAmountHuman(e.target.value)}
            required
          />
          <div className='text-xs text-white/50 mt-1'>
            Smallest units: {amount || "0"}
          </div>
        </div>

        <div>
          <label className='block text-sm mb-1'>Slippage (bps)</label>
          <input
            className='w-full p-2 rounded bg-[#10261f] border border-[#23483c]'
            type='number'
            min={1}
            max={1000}
            value={slippageBps}
            onChange={(e) => setSlippageBps(Math.max(1, Math.min(1000, Number(e.target.value) || 50)))}
          />
        </div>

        <div className='text-sm text-white/80'>
          Swap on Hydra: <span className='font-bold'>GLMR → DOT</span> (locked)
        </div>

        <div>
          <label className='block text-sm mb-1'>Intermediate Recipient (HydraDX SS58)</label>
          <input
            className='w-full p-2 rounded bg-[#10261f] border border-[#23483c]'
            placeholder='Hydration address (prefix 63)'
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            required
          />
        </div>

        <div className='flex items-center gap-2'>
          <input
            type='checkbox'
            checked={confirmRecipient}
            onChange={(e) => setConfirmRecipient(e.target.checked)}
          />
          <span className='text-sm'>I confirm the HydraDX recipient address is mine</span>
        </div>

        <div className='flex gap-2'>
          <button
            onClick={runQuote}
            disabled={quoting}
            className='flex-1 h-12 bg-[#23483c] text-white font-bold rounded hover:opacity-90 disabled:opacity-40'
          >
            {quoting ? "Quoting..." : "Get Hydra Route"}
          </button>
          <button
            onClick={onSubmit}
            disabled={!isConnected || submitting}
            className='flex-1 h-12 bg-primary text-black font-bold rounded hover:opacity-90 disabled:opacity-40'
          >
            {!isConnected ? "Connect Wallet" : submitting ? "Submitting..." : "Execute One‑Click"}
          </button>
        </div>

        {quote && (
          <div className='text-sm text-white/80 bg-[#143328] border border-[#23483c] rounded p-3'>
            <div>Hydra route computed.</div>
            <div className='mt-1'>Min receive (DOT, smallest units): <span className='font-bold'>{quote.minReceive || "n/a"}</span></div>
          </div>
        )}
        {error && <div className='text-red-400 text-sm'>{error}</div>}
        {txHash && <div className='text-green-400 text-sm break-all'>Tx sent: {txHash}</div>}
        {jobId && (
          <div className='text-sm text-white/80'>
            Relayer job: <span className='font-bold'>{jobId}</span> — status: <span className='font-bold'>{jobStatus || "pending"}</span>
          </div>
        )}
        {evmAddress && <div className='text-white/60 text-xs'>Connected: {evmAddress}</div>}
      </div>
    </div>
  );
}

