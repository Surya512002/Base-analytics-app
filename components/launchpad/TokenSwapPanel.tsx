"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, ExternalLink } from "lucide-react";
import { formatUnits, parseAbi } from "viem";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { fetchSwapQuote, fetchProtectionStatus, type LaunchDex } from "@/lib/api/launchpad-client";
import { formatFeeFromGross } from "@/lib/launchpad/fees";
import { captureTokenReferrerFromUrl, readTokenReferrer } from "@/lib/utils/referral";
import {
  aerodromeDepositUrl,
  dexLabel,
  uniswapPoolUrl,
} from "@/lib/launchpad/dex";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { formatSubscriptPrice, formatUsd } from "@/lib/launchpad/format";
import { fetchTokenPairs } from "@/lib/api/launchpad-token-client";
import SeedLiquidityPanel from "@/components/launchpad/SeedLiquidityPanel";

const DEX_OPTIONS: { id: LaunchDex; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "uniswap", label: "Uniswap" },
  { id: "aerodrome", label: "Aerodrome" },
];

const ERC20_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);

function parseSlippageBps(raw: string): number {
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.round(Math.min(50, Math.max(0.1, n)) * 100);
}

export default function TokenSwapPanel({
  app,
  token,
  guestMode,
  onRequestConnect,
}: {
  app: WalletAppState;
  token: LaunchedToken | null;
  guestMode?: boolean;
  onRequestConnect?: () => void;
}) {
  const { wallet, walletCore, swapLoading, handleTokenSwap, showToast } = app;
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("0.01");
  const [slippage, setSlippage] = useState("1");
  const [dex, setDex] = useState<LaunchDex>("auto");
  const [quoteOut, setQuoteOut] = useState<string | null>(null);
  const [hasLiquidity, setHasLiquidity] = useState<boolean | null>(null);
  const [hasPool, setHasPool] = useState<boolean | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [grossAmount, setGrossAmount] = useState<string | null>(null);
  const [activeDex, setActiveDex] = useState<"uniswap" | "aerodrome" | null>(null);
  const [uniswapHasLiquidity, setUniswapHasLiquidity] = useState<boolean | null>(null);
  const [aerodromeHasLiquidity, setAerodromeHasLiquidity] = useState<boolean | null>(null);
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const [priceEth, setPriceEth] = useState<number | null>(null);
  const [ethUsd, setEthUsd] = useState(2500);
  const [antiSnipeActive, setAntiSnipeActive] = useState(false);
  const [antiSnipeMsg, setAntiSnipeMsg] = useState<string | null>(null);
  const [referrer, setReferrer] = useState<string | null>(null);
  const [routeCompare, setRouteCompare] = useState<{
    uniswap: string | null;
    aerodrome: string | null;
    loading: boolean;
  }>({ uniswap: null, aerodrome: null, loading: false });
  const [poolLiquidityUsd, setPoolLiquidityUsd] = useState<number | null>(null);
  const [highImpactAck, setHighImpactAck] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    setNowMs(Date.now());
  }, [token?.address]);

  useEffect(() => {
    if (!token) return;
    captureTokenReferrerFromUrl(token.address);
    setReferrer(readTokenReferrer(token.address));
  }, [token]);

  const ethBalance = useMemo(() => {
    const bal = walletCore?.balance ?? wallet?.balance;
    if (!bal) return 0;
    const n = parseFloat(bal);
    return Number.isFinite(n) ? n : 0;
  }, [walletCore?.balance, wallet?.balance]);

  useEffect(() => {
    let alive = true;
    void fetch("/api/launchpad/eth-price", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ethUsd?: number }) => {
        if (!alive) return;
        if (d.ethUsd && d.ethUsd > 0) setEthUsd(d.ethUsd);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const payUsd = useMemo(() => {
    const n = parseFloat(amount);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (direction === "buy") return n * ethUsd;
    if (priceUsd) return n * priceUsd;
    return null;
  }, [amount, direction, ethUsd, priceUsd]);

  const receiveUsd = useMemo(() => {
    if (!quoteOut) return null;
    const n = parseFloat(quoteOut);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (direction === "buy" && priceUsd) return n * priceUsd;
    if (direction === "sell") return n * ethUsd;
    return null;
  }, [quoteOut, direction, priceUsd, ethUsd]);

  const setUsdSell = (usd: number) => {
    if (!priceUsd || priceUsd <= 0) return;
    setAmount((usd / priceUsd).toFixed(4));
  };

  const setUsdBuy = (usd: number) => {
    if (ethUsd <= 0) return;
    setAmount((usd / ethUsd).toFixed(6));
  };

  useEffect(() => {
    if (!token || !wallet) {
      setTokenBalance(0);
      return;
    }
    let alive = true;
    const pub = createBasePublicClient();
    void pub
      .readContract({
        address: token.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [wallet.address as `0x${string}`],
      })
      .then((raw) => {
        if (!alive) return;
        setTokenBalance(parseFloat(formatUnits(raw, token.decimals)));
      })
      .catch(() => {
        if (!alive) return;
        setTokenBalance(0);
      });
    return () => {
      alive = false;
    };
  }, [token, wallet]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    void fetchTokenPairs(token.address).then((d) => {
      if (!alive) return;
      const best = [...(d.pairs ?? [])].sort(
        (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
      )[0];
      const poolLiq = (d.pairs ?? []).some((p) => (p.liquidity?.usd ?? 0) > 0);
      setHasPool(poolLiq);
      setPoolLiquidityUsd(best?.liquidity?.usd ?? null);
      if (best?.priceUsd) setPriceUsd(parseFloat(best.priceUsd));
      if (best?.priceNative) setPriceEth(parseFloat(best.priceNative));
    });
    return () => {
      alive = false;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    void fetchProtectionStatus(token.address, direction)
      .then((s) => {
        if (!alive) return;
        setAntiSnipeActive(s.active);
        setAntiSnipeMsg(s.message ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token, direction]);

  useEffect(() => {
    if (!token || !amount || parseFloat(amount) <= 0 || Number.isNaN(parseFloat(amount))) {
      setQuoteOut(null);
      setHasLiquidity(null);
      setQuoteError(null);
      setGrossAmount(null);
      setActiveDex(null);
      setUniswapHasLiquidity(null);
      setAerodromeHasLiquidity(null);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      const q = await fetchSwapQuote({
        token: token.address,
        direction,
        amount,
        decimals: token.decimals,
        slippageBps: parseSlippageBps(slippage),
        dex,
        referrer,
      });
      if (!alive) return;
      setHasLiquidity(q.hasLiquidity);
      setQuoteError(q.error ?? null);
      setGrossAmount(q.grossAmount ?? null);
      setActiveDex(q.dex ?? null);
      setUniswapHasLiquidity(q.uniswapHasLiquidity ?? null);
      setAerodromeHasLiquidity(q.aerodromeHasLiquidity ?? null);
      if (q.antiSnipe?.active) {
        setAntiSnipeActive(true);
        setAntiSnipeMsg(q.antiSnipe.message ?? null);
      }
      if (q.hasLiquidity && q.amountOut) {
        const out =
          direction === "buy"
            ? (Number(q.amountOut) / 10 ** token.decimals).toFixed(4)
            : (Number(q.amountOut) / 1e18).toFixed(6);
        setQuoteOut(out);
      } else {
        setQuoteOut(null);
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [token, direction, amount, slippage, dex, referrer]);

  useEffect(() => {
    if (!token || !amount || parseFloat(amount) <= 0 || direction !== "buy") {
      setRouteCompare({ uniswap: null, aerodrome: null, loading: false });
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      setRouteCompare((r) => ({ ...r, loading: true }));
      const base = {
        token: token.address,
        direction: "buy" as const,
        amount,
        decimals: token.decimals,
        slippageBps: parseSlippageBps(slippage),
        referrer,
      };
      const [uni, aero] = await Promise.all([
        fetchSwapQuote({ ...base, dex: "uniswap" }),
        fetchSwapQuote({ ...base, dex: "aerodrome" }),
      ]);
      if (!alive) return;
      const fmt = (q: typeof uni) => {
        if (!q.hasLiquidity || !q.amountOut) return null;
        return (Number(q.amountOut) / 10 ** token.decimals).toFixed(4);
      };
      setRouteCompare({
        uniswap: fmt(uni),
        aerodrome: fmt(aero),
        loading: false,
      });
    }, 500);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [token, direction, amount, slippage, referrer]);

  const feeBreakdown = useMemo(() => {
    if (!grossAmount || !token) return null;
    try {
      return formatFeeFromGross(grossAmount, direction, token.decimals, {
        creator: token.creator as `0x${string}`,
        referrer: referrer as `0x${string}` | null,
      });
    } catch {
      return null;
    }
  }, [grossAmount, direction, token, referrer]);

  const priceImpactPct = useMemo(() => {
    if (!quoteOut || !priceUsd) return null;
    const quoted = parseFloat(quoteOut);
    const amt = parseFloat(amount);
    if (!Number.isFinite(quoted) || quoted <= 0 || !Number.isFinite(amt) || amt <= 0) {
      return null;
    }
    let expected: number;
    if (direction === "buy") {
      expected = (amt * ethUsd) / priceUsd;
    } else {
      expected = (amt * priceUsd) / ethUsd;
    }
    if (expected <= 0) return null;
    return Math.abs(1 - quoted / expected) * 100;
  }, [quoteOut, priceUsd, amount, direction, ethUsd]);

  const isNewPool = useMemo(() => {
    if (!token?.createdAt || nowMs <= 0) return false;
    return nowMs - token.createdAt < 7 * 24 * 60 * 60 * 1000;
  }, [token?.createdAt, nowMs]);

  const needsImpactAck =
    (priceImpactPct != null && priceImpactPct >= 3) ||
    (poolLiquidityUsd != null && poolLiquidityUsd < 2500);

  useEffect(() => {
    setHighImpactAck(false);
  }, [token?.address, direction, amount, dex]);

  const setPct = (pct: number) => {
    if (direction === "buy") {
      const v = ethBalance * pct;
      setAmount(v > 0 ? v.toFixed(6) : "0");
    } else {
      const v = tokenBalance * pct;
      setAmount(v > 0 ? v.toFixed(4) : "0");
    }
  };

  const onSwap = async () => {
    if (!token) return;
    if (needsImpactAck && !highImpactAck) {
      showToast("Review price impact warning and confirm below", "");
      return;
    }
    if (guestMode || !wallet) {
      onRequestConnect?.();
      return;
    }
    if (!hasLiquidity) {
      showToast(
        quoteError || "No pool on Uniswap or Aerodrome — add liquidity first",
        ""
      );
      return;
    }
    await handleTokenSwap({
      token: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
      direction,
      amount,
      slippageBps: parseSlippageBps(slippage),
      dex,
      referrer,
    });
  };

  if (!token) {
    return (
      <div className="glass-panel rounded-2xl p-6 text-center text-sm text-slate-500">
        Select a token to trade
      </div>
    );
  }

  const swapReady = hasPool !== false;
  const slippageValid = parseSlippageBps(slippage) > 0;

  return (
    <div className="swap-panel overflow-hidden lg:sticky lg:top-[4.5rem]">
      <div className="h-0.5 bg-linear-to-r from-emerald-500 via-[#6BA3FF] to-[#0052FF]" />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 className="font-black text-white flex items-center gap-2">
            <ArrowDownUp size={16} className="text-emerald-400" />
            Swap
          </h3>
          <div className="flex gap-2">
            <a
              href={uniswapPoolUrl(token.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-cyan-400/70 flex items-center gap-1 hover:text-cyan-300"
            >
              Uniswap <ExternalLink size={10} />
            </a>
            <a
              href={aerodromeDepositUrl(token.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-cyan-400/70 flex items-center gap-1 hover:text-cyan-300"
            >
              Aerodrome <ExternalLink size={10} />
            </a>
          </div>
        </div>

        {priceUsd && (
          <p className="text-[10px] text-slate-500 mb-3 text-center">
            1 {token.symbol} = {formatSubscriptPrice(priceUsd)}
            {priceEth ? ` (${priceEth.toExponential(2)} ETH)` : ""}
          </p>
        )}

        {hasPool === false && (
          <SeedLiquidityPanel
            app={app}
            token={token}
            tokenBalance={tokenBalance}
            onSeeded={() => {
              setHasPool(true);
              setHasLiquidity(null);
              setAmount("0.01");
            }}
          />
        )}

        {hasPool === false &&
          (!wallet ||
            wallet.address.toLowerCase() !== token.creator.toLowerCase() ||
            tokenBalance <= 0) && (
            <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-100/90 leading-relaxed">
              No WETH pool on Uniswap or Aerodrome yet. The creator can seed liquidity here, or
              add it on{" "}
              <a
                href={aerodromeDepositUrl(token.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-300 underline"
              >
                Aerodrome
              </a>
              .
            </div>
          )}

        {swapReady && (
        <>
        <div className="flex gap-1 mb-4 p-1 bg-white/[0.04] rounded-xl">
          {(["buy", "sell"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase transition-colors ${
                direction === d
                  ? d === "buy"
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-rose-500/20 text-rose-300"
                  : "text-slate-500"
              }`}
            >
              {d === "buy" ? "Buy" : "Sell"}
            </button>
          ))}
        </div>

        {direction === "buy" && (
          <div className="mb-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
              Quick buy (USD)
            </span>
            <div className="flex flex-wrap gap-2">
              {[10, 25, 50, 100].map((usd) => (
                <button
                  key={usd}
                  type="button"
                  onClick={() => {
                    setDirection("buy");
                    setUsdBuy(usd);
                  }}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-white/10 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors"
                >
                  ${usd}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1.5">
            Route
          </span>
          <div className="flex gap-1 p-1 bg-white/[0.04] rounded-xl">
            {DEX_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDex(opt.id)}
                className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-colors ${
                  dex === opt.id
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {activeDex && hasLiquidity && (
            <p className="mt-2 text-[10px] text-slate-500">
              Via <span className="text-cyan-300">{dexLabel(activeDex)}</span>
              {dex === "auto" ? " · best quote" : ""}
            </p>
          )}
          {direction === "buy" &&
            (routeCompare.uniswap || routeCompare.aerodrome || routeCompare.loading) && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(["uniswap", "aerodrome"] as const).map((id) => {
                  const out = id === "uniswap" ? routeCompare.uniswap : routeCompare.aerodrome;
                  const uniN = parseFloat(routeCompare.uniswap || "0");
                  const aeroN = parseFloat(routeCompare.aerodrome || "0");
                  const isBest =
                    out &&
                    ((id === "uniswap" && uniN >= aeroN && uniN > 0) ||
                      (id === "aerodrome" && aeroN >= uniN && aeroN > 0));
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={!out}
                      onClick={() => setDex(id)}
                      className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                        dex === id || (dex === "auto" && isBest)
                          ? "border-cyan-500/40 bg-cyan-500/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/20"
                      } ${!out ? "opacity-50" : ""}`}
                    >
                      <p className="text-[10px] font-bold uppercase text-slate-500">
                        {dexLabel(id)}
                        {isBest && dex === "auto" ? " · best" : ""}
                      </p>
                      <p className="text-sm font-mono font-bold text-white mt-0.5">
                        {routeCompare.loading ? "…" : out ? `≈ ${out} ${token.symbol}` : "No pool"}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
        </div>

        <div className="mb-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase">
              You pay
            </span>
            <span className="text-[10px] text-slate-500">
              Balance:{" "}
              <span className="text-slate-300 font-mono">
                {direction === "buy"
                  ? `${ethBalance.toFixed(6)} ETH`
                  : `${tokenBalance.toFixed(4)} ${token.symbol}`}
              </span>
            </span>
          </div>
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-3 text-lg text-white font-mono outline-none focus:border-emerald-500/40"
          />
          {payUsd != null && payUsd > 0 ? (
            <p className="swap-usd-line mt-1.5">
              ≈ {formatUsd(payUsd)}
            </p>
          ) : (
            <p className="text-[11px] text-slate-600 mt-1.5">USD value updates with quote</p>
          )}
          <div className="flex gap-1.5 mt-2">
            {direction === "buy"
              ? [5, 10, 25, 100].map((usd) => (
                  <button
                    key={usd}
                    type="button"
                    onClick={() => setUsdBuy(usd)}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold border border-white/10 text-slate-400 hover:text-white hover:border-[#0052FF]/40"
                  >
                    ${usd}
                  </button>
                ))
              : priceUsd
                ? [25, 50, 100, 250].map((usd) => (
                    <button
                      key={usd}
                      type="button"
                      onClick={() => setUsdSell(usd)}
                      className="flex-1 py-1.5 rounded-lg text-[10px] font-bold border border-white/10 text-slate-400 hover:text-white hover:border-rose-500/40"
                    >
                      ${usd}
                    </button>
                  ))
                : [
                  { label: "20%", pct: 0.2 },
                  { label: "50%", pct: 0.5 },
                  { label: "MAX", pct: 0.99 },
                ].map((b) => (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => setPct(b.pct)}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-bold border border-white/10 text-slate-400 hover:text-white hover:border-white/20"
                  >
                    {b.label}
                  </button>
                ))}
          </div>
          {direction === "buy" && (
            <div className="flex gap-1.5 mt-1.5">
              {[
                { label: "20%", pct: 0.2 },
                { label: "50%", pct: 0.5 },
                { label: "MAX", pct: 0.99 },
              ].map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => setPct(b.pct)}
                  className="flex-1 py-1.5 rounded-lg text-[10px] font-bold border border-white/10 text-slate-400 hover:text-white hover:border-white/20"
                >
                  {b.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>You receive</span>
            <span className="font-mono text-slate-400">
              {direction === "buy"
                ? `${tokenBalance.toFixed(4)} ${token.symbol}`
                : `${ethBalance.toFixed(6)} ETH`}
            </span>
          </div>
          <p className="text-lg font-black text-white font-mono tabular-nums">
            {quoteOut ?? "0.00"}{" "}
            <span className="text-sm text-slate-400 font-sans font-semibold">
              {direction === "buy" ? token.symbol : "ETH"}
            </span>
          </p>
          {receiveUsd != null && receiveUsd > 0 ? (
            <p className="swap-receive-usd text-[13px] font-semibold font-mono mt-1.5 tabular-nums">
              ≈ {formatUsd(receiveUsd)}
            </p>
          ) : (
            <p className="text-[11px] text-slate-600 mt-1.5">Receive USD shown when quote loads</p>
          )}
        </div>

        <label className="block mb-4">
          <span className="text-[10px] font-bold text-slate-500 uppercase">
            Max slippage %
          </span>
          <div className="flex gap-1.5 mt-1.5">
            {["0.5", "1", "3"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSlippage(s)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border ${
                  slippage === s
                    ? "border-cyan-400/40 bg-cyan-500/15 text-cyan-300"
                    : "border-white/10 text-slate-500"
                }`}
              >
                {s}%
              </button>
            ))}
            <input
              value={slippage}
              onChange={(e) => setSlippage(e.target.value)}
              className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white text-center outline-none"
            />
          </div>
        </label>

        {feeBreakdown && (
          <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 space-y-1.5 text-[11px]">
            <div className="flex justify-between text-slate-400">
              <span>Platform fee ({feeBreakdown.platformFeeLabel})</span>
              <span className="text-amber-200/90 font-mono">
                {feeBreakdown.platformFeeDisplay}
              </span>
            </div>
            {feeBreakdown.creatorShareDisplay && (
              <div className="flex justify-between text-slate-500">
                <span>→ Creator</span>
                <span className="font-mono text-[#6BA3FF]/90">{feeBreakdown.creatorShareDisplay}</span>
              </div>
            )}
            {feeBreakdown.platformShareDisplay && (
              <div className="flex justify-between text-slate-500">
                <span>→ Platform</span>
                <span className="font-mono text-slate-400">{feeBreakdown.platformShareDisplay}</span>
              </div>
            )}
            {feeBreakdown.referrerShareDisplay && (
              <div className="flex justify-between text-slate-500">
                <span>→ Referrer</span>
                <span className="font-mono text-amber-200/80">{feeBreakdown.referrerShareDisplay}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-400">
              <span>Swap amount</span>
              <span className="text-emerald-300/90 font-mono">
                {feeBreakdown.swapAmountDisplay}
              </span>
            </div>
          </div>
        )}

        {antiSnipeActive && direction === "buy" && antiSnipeMsg && (
          <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            {antiSnipeMsg}
          </div>
        )}

        {quoteError && hasLiquidity === false && (
          <div className="mb-3 rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200">
            {quoteError}
          </div>
        )}

        {hasLiquidity === false && !quoteError && (
          <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            No pool yet — Uniswap: {uniswapHasLiquidity ? "✓" : "✗"} · Aerodrome:{" "}
            {aerodromeHasLiquidity ? "✓" : "✗"}
          </div>
        )}

        {(priceImpactPct != null || poolLiquidityUsd != null || isNewPool) && hasLiquidity && (
          <div
            className={`mb-3 rounded-xl border px-3 py-2.5 text-[11px] space-y-1.5 ${
              needsImpactAck
                ? "border-rose-500/35 bg-rose-500/10 text-rose-100"
                : "border-white/10 bg-white/[0.03] text-slate-300"
            }`}
          >
            <p className="font-bold uppercase tracking-wide text-[10px]">Trade check</p>
            {priceImpactPct != null && (
              <p>
                Price impact:{" "}
                <span className={priceImpactPct >= 3 ? "text-rose-300 font-bold" : ""}>
                  ~{priceImpactPct.toFixed(2)}%
                </span>
              </p>
            )}
            {poolLiquidityUsd != null && (
              <p>
                Pool liquidity:{" "}
                <span className={poolLiquidityUsd < 2500 ? "text-amber-300 font-bold" : ""}>
                  {formatUsd(poolLiquidityUsd)}
                </span>
              </p>
            )}
            {isNewPool && (
              <p className="text-amber-200">New pool — extra slippage risk for large trades.</p>
            )}
            {activeDex && (
              <p>
                Route: <span className="text-cyan-300">{dexLabel(activeDex)}</span>
              </p>
            )}
            {needsImpactAck && (
              <label className="flex items-start gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={highImpactAck}
                  onChange={(e) => setHighImpactAck(e.target.checked)}
                  className="mt-0.5"
                />
                <span>I understand the price impact and want to proceed</span>
              </label>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onSwap}
          disabled={
            swapLoading ||
            !amount ||
            !slippageValid ||
            !hasLiquidity ||
            (needsImpactAck && !highImpactAck) ||
            (antiSnipeActive && direction === "buy" && !guestMode)
          }
          className={`w-full py-3.5 rounded-xl font-black text-sm disabled:opacity-40 ${
            direction === "buy"
              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
              : "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20"
          }`}
        >
          {guestMode || !wallet
            ? "Connect wallet to swap"
            : swapLoading
              ? "Swapping…"
              : direction === "buy"
                ? "Buy with ETH"
                : "Sell for ETH"}
        </button>
        </>
        )}
      </div>
    </div>
  );
}
