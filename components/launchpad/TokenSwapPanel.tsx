"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Settings2,
  Wallet,
  Zap,
} from "lucide-react";
import { formatUnits, parseAbi } from "viem";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { fetchSwapQuote, fetchProtectionStatus, type LaunchDex } from "@/lib/api/launchpad-client";
import { formatPlatformFeeLabel } from "@/lib/constants/launchpad";
import { captureTokenReferrerFromUrl, readTokenReferrer } from "@/lib/utils/referral";
import {
  aerodromeDepositUrl,
  aerodromeSwapUrl,
  dexLabel,
  dexscreenerTokenUrl,
  type SwapVenue,
} from "@/lib/launchpad/dex";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { formatSubscriptPrice, formatUsd } from "@/lib/launchpad/format";
import { fetchTokenPairs } from "@/lib/api/launchpad-token-client";
import SeedLiquidityPanel from "@/components/launchpad/SeedLiquidityPanel";

const ERC20_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);

const ROUTE_OPTIONS: { id: LaunchDex; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "aerodrome", label: "Aerodrome" },
  { id: "uniswap", label: "Uniswap" },
  { id: "slipstream", label: "Slipstream" },
];

const PCT_PRESETS = [
  { label: "25%", pct: 0.25 },
  { label: "50%", pct: 0.5 },
  { label: "75%", pct: 0.75 },
  { label: "MAX", pct: -1 },
] as const;

/** Leave native ETH for gas when user picks MAX on buy. */
const MAX_ETH_FRACTION = 0.97;

function formatQuoteOut(amountOut: string, decimals: number): string {
  const n = Number(amountOut) / 10 ** decimals;
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (n >= 1) return n.toFixed(4);
  if (n >= 0.0001) return n.toFixed(6);
  return n.toExponential(2);
}

function parseSlippageBps(raw: string): number {
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return 100;
  return Math.round(Math.min(50, Math.max(0.1, n)) * 100);
}

function formatUsdSide(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return formatUsd(value);
}

function TokenAvatar({
  symbol,
  imageUrl,
}: {
  symbol: string;
  imageUrl?: string;
}) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        className="w-9 h-9 rounded-full object-cover border border-white/15 shrink-0"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-[#0052FF]/30 border border-[#0052FF]/40 flex items-center justify-center text-xs font-black text-[#6BA3FF] shrink-0">
      {symbol.slice(0, 2)}
    </div>
  );
}

function SwapUsdColumn({ usd, loading }: { usd: number | null; loading?: boolean }) {
  return (
    <div className="swap-usd-column">
      <span className="swap-usd-label">USD</span>
      {loading ? (
        <Loader2 size={16} className="animate-spin text-slate-500 ml-auto" />
      ) : (
        <span className="swap-usd-value">{formatUsdSide(usd)}</span>
      )}
    </div>
  );
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
  const [showSettings, setShowSettings] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteOut, setQuoteOut] = useState<string | null>(null);
  const [minReceive, setMinReceive] = useState<string | null>(null);
  const [hasLiquidity, setHasLiquidity] = useState<boolean | null>(null);
  const [hasPool, setHasPool] = useState<boolean | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [activeDex, setActiveDex] = useState<SwapVenue | null>(null);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [priceUsd, setPriceUsd] = useState<number | null>(null);
  const [ethUsd, setEthUsd] = useState(2500);
  const [antiSnipeActive, setAntiSnipeActive] = useState(false);
  const [antiSnipeMsg, setAntiSnipeMsg] = useState<string | null>(null);
  const [referrer, setReferrer] = useState<string | null>(null);
  const [poolLiquidityUsd, setPoolLiquidityUsd] = useState<number | null>(null);
  const [highImpactAck, setHighImpactAck] = useState(false);
  const [balanceTick, setBalanceTick] = useState(0);
  const [activePct, setActivePct] = useState<string | null>(null);

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

  const refreshBalances = useCallback(() => {
    setBalanceTick((n) => n + 1);
  }, []);

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
  }, [token, wallet, balanceTick]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    void fetchTokenPairs(token.address).then((d) => {
      if (!alive) return;
      const best = [...(d.pairs ?? [])].sort(
        (a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0)
      )[0];
      setHasPool((d.pairs ?? []).some((p) => (p.liquidity?.usd ?? 0) > 0));
      setPoolLiquidityUsd(best?.liquidity?.usd ?? null);
      if (best?.priceUsd) setPriceUsd(parseFloat(best.priceUsd));
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
    if (!token || !amount || parseFloat(amount) <= 0) {
      setQuoteOut(null);
      setMinReceive(null);
      setHasLiquidity(null);
      setQuoteError(null);
      setActiveDex(null);
      setQuoteLoading(false);
      return;
    }
    let alive = true;
    setQuoteLoading(true);
    const t = setTimeout(async () => {
      const q = await fetchSwapQuote({
        token: token.address,
        direction,
        amount,
        decimals: token.decimals,
        slippageBps: parseSlippageBps(slippage),
        dex,
        referrer,
        taker: wallet?.address,
        payAsset: "eth",
        receiveAsset: "eth",
      });
      if (!alive) return;
      setQuoteLoading(false);
      setHasLiquidity(q.hasLiquidity);
      setQuoteError(q.error ?? null);
      setActiveDex(q.dex ?? null);
      if (q.antiSnipe?.active) {
        setAntiSnipeActive(true);
        setAntiSnipeMsg(q.antiSnipe.message ?? null);
      }
      const outDec = q.outDecimals ?? (direction === "buy" ? token.decimals : 18);
      if (q.hasLiquidity && q.amountOut) {
        setQuoteOut(formatQuoteOut(q.amountOut, outDec));
        setMinReceive(
          q.amountOutMinimum ? formatQuoteOut(q.amountOutMinimum, outDec) : null
        );
      } else {
        setQuoteOut(null);
        setMinReceive(null);
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [token, direction, amount, slippage, dex, referrer, wallet?.address]);

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

  const exchangeRate = useMemo(() => {
    const pay = parseFloat(amount);
    const out = parseFloat(quoteOut ?? "0");
    if (!Number.isFinite(pay) || pay <= 0 || !Number.isFinite(out) || out <= 0) return null;
    if (direction === "buy") {
      return `1 ETH = ${(out / pay).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${token?.symbol ?? ""}`;
    }
    return `1 ${token?.symbol ?? ""} = ${(out / pay).toFixed(8)} ETH`;
  }, [amount, quoteOut, direction, token?.symbol]);

  const priceImpactPct = useMemo(() => {
    if (!quoteOut || !priceUsd) return null;
    const quoted = parseFloat(quoteOut);
    const amt = parseFloat(amount);
    if (!Number.isFinite(quoted) || quoted <= 0 || !Number.isFinite(amt) || amt <= 0) {
      return null;
    }
    const expected =
      direction === "buy" ? (amt * ethUsd) / priceUsd : (amt * priceUsd) / ethUsd;
    if (expected <= 0) return null;
    return Math.abs(1 - quoted / expected) * 100;
  }, [quoteOut, priceUsd, amount, direction, ethUsd]);

  const needsImpactAck =
    (priceImpactPct != null && priceImpactPct >= 3) ||
    (poolLiquidityUsd != null && poolLiquidityUsd < 2500);

  useEffect(() => {
    setHighImpactAck(false);
  }, [token?.address, direction, amount, dex]);

  const setDirectionSafe = (d: "buy" | "sell") => {
    setDirection(d);
    setAmount(d === "buy" ? "0.01" : "");
    setQuoteOut(null);
    setMinReceive(null);
    setActivePct(null);
  };

  const flipDirection = () => {
    setDirectionSafe(direction === "buy" ? "sell" : "buy");
  };

  const setPct = (pct: number, label: string) => {
    setActivePct(label);
    if (direction === "buy") {
      const fraction = pct < 0 ? MAX_ETH_FRACTION : pct;
      const v = ethBalance * fraction;
      setAmount(v > 0 ? v.toFixed(6) : "0");
    } else {
      const fraction = pct < 0 ? 0.99 : pct;
      const v = tokenBalance * fraction;
      setAmount(v > 0 ? v.toFixed(4) : "0");
    }
  };

  const onAmountChange = (raw: string) => {
    setAmount(raw);
    setActivePct(null);
  };

  const onSwap = async () => {
    if (!token) return;
    if (needsImpactAck && !highImpactAck) {
      showToast("Check the box to confirm high price impact", "");
      return;
    }
    if (guestMode || !wallet) {
      onRequestConnect?.();
      return;
    }
    if (!hasLiquidity) {
      showToast(
        quoteError || "No swap route — try Aerodrome or wait for indexing",
        ""
      );
      return;
    }
    const ok = await handleTokenSwap({
      token: token.address,
      symbol: token.symbol,
      decimals: token.decimals,
      direction,
      amount,
      slippageBps: parseSlippageBps(slippage),
      dex,
      referrer,
      payAsset: "eth",
      receiveAsset: "eth",
    });
    if (ok) {
      setAmount(direction === "buy" ? "0.01" : "");
      setActivePct(null);
      refreshBalances();
    }
  };

  if (!token) {
    return (
      <div className="swap-panel p-8 text-center text-sm text-slate-500">
        Select a token to trade
      </div>
    );
  }

  const swapReady = hasPool !== false || hasLiquidity === true;
  const slippageValid = parseSlippageBps(slippage) > 0;
  const paySymbol = direction === "buy" ? "ETH" : token.symbol;
  const receiveSymbol = direction === "buy" ? token.symbol : "ETH";
  const canSwap =
    Boolean(amount) &&
    parseFloat(amount) > 0 &&
    slippageValid &&
    hasLiquidity &&
    !(needsImpactAck && !highImpactAck) &&
    !(antiSnipeActive && direction === "buy" && !guestMode);

  const statusLabel = quoteLoading
    ? "Getting price…"
    : hasLiquidity
      ? "Ready"
      : hasLiquidity === false
        ? "No route"
        : "Enter amount";

  const statusTone = quoteLoading
    ? "swap-status-loading"
    : hasLiquidity
      ? "swap-status-ready"
      : hasLiquidity === false
        ? "swap-status-warn"
        : "swap-status-idle";

  const ctaLabel = (() => {
    if (guestMode || !wallet) return "Connect wallet";
    if (swapLoading) return "Confirm in wallet…";
    if (!amount || parseFloat(amount) <= 0) return "Enter an amount";
    if (!hasLiquidity) return "No route available";
    if (needsImpactAck && !highImpactAck) return "Confirm price impact";
    if (antiSnipeActive && direction === "buy") return "Buys paused";
    const usd = payUsd;
    if (usd != null && usd > 0) {
      return direction === "buy"
        ? `Buy ${formatUsd(usd)} of ${token.symbol}`
        : `Sell ${formatUsd(usd)} of ${token.symbol}`;
    }
    return direction === "buy" ? `Buy ${token.symbol}` : `Sell ${token.symbol}`;
  })();

  return (
    <div className="swap-panel swap-panel-lg overflow-hidden">
      <div className="swap-panel-inner">
        <div className="swap-mode-tabs">
          {(["buy", "sell"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirectionSafe(d)}
              className={`swap-mode-tab ${direction === d ? (d === "buy" ? "swap-mode-buy-active" : "swap-mode-sell-active") : ""}`}
            >
              {d === "buy" ? "Buy" : "Sell"}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className={`swap-status-pill ${statusTone}`}>
            {quoteLoading ? (
              <Loader2 size={12} className="animate-spin shrink-0" />
            ) : hasLiquidity ? (
              <CheckCircle2 size={12} className="shrink-0" />
            ) : (
              <Zap size={12} className="shrink-0" />
            )}
            <span>{statusLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings((s) => !s)}
            className="swap-settings-btn"
            aria-label="Swap settings"
          >
            <Settings2 size={15} />
            <span>{slippage}% slip</span>
          </button>
        </div>

        {wallet && !guestMode && (
          <div className="swap-wallet-row">
            <Wallet size={14} className="text-slate-500 shrink-0" />
            <span>{ethBalance.toFixed(4)} ETH</span>
            <span className="text-slate-600">·</span>
            <span>
              {tokenBalance.toFixed(2)} {token.symbol}
            </span>
          </div>
        )}

        {showSettings && (
          <div className="swap-settings-panel">
            <p className="swap-settings-label">Route</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {ROUTE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDex(opt.id)}
                  className={`swap-route-chip ${dex === opt.id ? "swap-route-chip-active" : ""}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="swap-settings-label">Slippage</p>
            <div className="flex gap-2">
              {["0.5", "1", "3", "5"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlippage(s)}
                  className={`swap-route-chip flex-1 ${slippage === s ? "swap-route-chip-active" : ""}`}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>
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

        {swapReady && (
          <>
            <div className="swap-token-box">
              <div className="swap-field-header">
                <span className="swap-field-label">You pay</span>
                <span className="swap-balance-hint">
                  Balance{" "}
                  {direction === "buy"
                    ? `${ethBalance.toFixed(4)} ETH`
                    : `${tokenBalance.toFixed(2)} ${token.symbol}`}
                </span>
              </div>
              <div className="swap-amount-row">
                <div className="swap-token-pill">
                  {direction === "sell" ? (
                    <TokenAvatar symbol={token.symbol} imageUrl={token.imageUrl} />
                  ) : (
                    <span className="swap-eth-icon">Ξ</span>
                  )}
                  <span>{paySymbol}</span>
                </div>
                <input
                  value={amount}
                  onChange={(e) => onAmountChange(e.target.value)}
                  placeholder="0"
                  inputMode="decimal"
                  className="swap-amount-input"
                />
                <SwapUsdColumn usd={payUsd} />
              </div>
            </div>

            <div className="swap-presets">
              {PCT_PRESETS.map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => setPct(b.pct, b.label)}
                  className={`swap-preset-btn ${activePct === b.label ? "swap-preset-active" : ""}`}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div className="swap-mid-row">
              <button type="button" onClick={flipDirection} className="swap-flip-btn" aria-label="Flip">
                <ArrowDownUp size={20} />
              </button>
              {exchangeRate && hasLiquidity && !quoteLoading && (
                <p className="swap-rate-line">{exchangeRate}</p>
              )}
            </div>

            <div className="swap-token-box swap-token-box-receive">
              <div className="swap-field-header">
                <span className="swap-field-label">You receive</span>
                {minReceive && hasLiquidity && !quoteLoading && (
                  <span className="swap-balance-hint">
                    Min {minReceive} {receiveSymbol}
                  </span>
                )}
              </div>
              <div className="swap-amount-row">
                <div className="swap-token-pill">
                  {direction === "buy" ? (
                    <TokenAvatar symbol={token.symbol} imageUrl={token.imageUrl} />
                  ) : (
                    <span className="swap-eth-icon">Ξ</span>
                  )}
                  <span>{receiveSymbol}</span>
                </div>
                <p className="swap-amount-display">
                  {quoteLoading ? "…" : quoteOut ?? "0"}
                </p>
                <SwapUsdColumn usd={receiveUsd} loading={quoteLoading} />
              </div>
            </div>

            {hasLiquidity && activeDex && !quoteLoading && (
              <div className="swap-summary-strip">
                <span>
                  Route <strong>{dexLabel(activeDex)}</strong>
                </span>
                <span className="swap-summary-dot">·</span>
                <span>{formatPlatformFeeLabel()} fee</span>
                {priceImpactPct != null && (
                  <>
                    <span className="swap-summary-dot">·</span>
                    <span className={priceImpactPct >= 3 ? "text-rose-300 font-semibold" : ""}>
                      {priceImpactPct.toFixed(1)}% impact
                    </span>
                  </>
                )}
              </div>
            )}

            {priceUsd && (
              <p className="swap-meta-line">
                1 {token.symbol} = {formatSubscriptPrice(priceUsd)}
                {poolLiquidityUsd != null && poolLiquidityUsd > 0 && (
                  <> · {formatUsd(poolLiquidityUsd)} pool liquidity</>
                )}
              </p>
            )}

            {direction === "buy" && activePct === "MAX" && (
              <p className="swap-gas-hint">MAX keeps a small ETH buffer for network fees.</p>
            )}

            {antiSnipeActive && direction === "buy" && antiSnipeMsg && (
              <div className="swap-alert swap-alert-warn">{antiSnipeMsg}</div>
            )}

            {(quoteError || hasLiquidity === false) && !quoteLoading && (
              <div className="swap-alert swap-alert-warn">
                {quoteError ?? "No in-app route yet."}{" "}
                <a
                  href={aerodromeSwapUrl(token.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#6BA3FF] underline inline-flex items-center gap-1"
                >
                  Aerodrome <ExternalLink size={10} />
                </a>
              </div>
            )}

            {needsImpactAck && hasLiquidity && (
              <label className="swap-impact-ack">
                <input
                  type="checkbox"
                  checked={highImpactAck}
                  onChange={(e) => setHighImpactAck(e.target.checked)}
                />
                <span>High price impact — I understand and want to continue</span>
              </label>
            )}

            <div className="swap-cta-wrap">
              <button
                type="button"
                onClick={onSwap}
                disabled={swapLoading || Boolean(wallet && !guestMode && !canSwap)}
                className={`swap-submit-btn ${direction === "buy" ? "swap-submit-buy" : "swap-submit-sell"}`}
              >
                {swapLoading && <Loader2 size={20} className="animate-spin" />}
                {ctaLabel}
              </button>
            </div>

            <div className="swap-footer-links">
              <a href={aerodromeSwapUrl(token.address)} target="_blank" rel="noopener noreferrer">
                Aerodrome <ExternalLink size={10} />
              </a>
              <a href={aerodromeDepositUrl(token.address)} target="_blank" rel="noopener noreferrer">
                Add liquidity <ExternalLink size={10} />
              </a>
              <a href={dexscreenerTokenUrl(token.address)} target="_blank" rel="noopener noreferrer">
                Chart <ExternalLink size={10} />
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
