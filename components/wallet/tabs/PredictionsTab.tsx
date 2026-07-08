"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  RefreshCcw,
  TrendingUp,
  Zap,
} from "lucide-react";
import TradingViewChart from "@/components/predictions/TradingViewChart";
import type { TvInterval } from "@/lib/constants/tradingview";
import PredictionDepthChart from "@/components/predictions/PredictionDepthChart";
import QuestProgressBanner from "@/components/wallet/QuestProgressBanner";
import { defaultIntervalForDuration } from "@/lib/constants/tradingview";
import {
  ASSET_COLOR,
  DURATION_LABEL,
  PREDICTION_ASSETS,
  PREDICTION_DURATIONS,
  trackFor,
  type PredictionAsset,
  type PredictionDuration,
} from "@/lib/constants/predictions";
import { POINTS_PER_PREDICTION } from "@/lib/utils/daily-points";
import {
  buyNoShares,
  buyYesShares,
  impliedNoProbability,
  impliedYesProbability,
} from "@/lib/predictions/amm";
import type { LiveMarket, StreakEntry } from "@/lib/predictions/types";
import type { WalletAppState } from "@/hooks/useWalletApp";
import {
  buildPredictionShareText,
  getReferralCode,
  twitterShare,
  warpcast,
} from "@/lib/utils/share";
import { APP_URL_WEB } from "@/lib/constants/env";

function formatUsd(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function timeLeft(ms: number): string {
  if (ms <= 0) return "Resolving…";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

export default function PredictionsTab({ app }: { app: WalletAppState }) {
  const {
    wallet,
    predictionLoading,
    handlePredictionTrade,
    predictionStreak,
    showToast,
    doneQuests,
    setTab,
  } = app;

  const [asset, setAsset] = useState<PredictionAsset>("BTC");
  const [duration, setDuration] = useState<PredictionDuration>("4h");
  const [markets, setMarkets] = useState<LiveMarket[]>([]);
  const [onChainMode, setOnChainMode] = useState(false);
  const [contractAddress, setContractAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("5");
  const [tvInterval, setTvInterval] = useState<TvInterval>("1");
  const [localPool, setLocalPool] = useState<{ yesReserve: number; noReserve: number } | null>(null);

  useEffect(() => {
    setTvInterval(defaultIntervalForDuration(duration));
  }, [duration]);

  const loadMarkets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/predictions");
      const data = (await res.json()) as {
        markets: LiveMarket[];
        onChain?: boolean;
        contract?: string | null;
      };
      setMarkets(data.markets ?? []);
      setOnChainMode(Boolean(data.onChain));
      setContractAddress(data.contract ?? null);
    } catch {
      showToast("❌ Could not load markets", "");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadMarkets();
    const id = setInterval(() => void loadMarkets(), 60_000);
    return () => clearInterval(id);
  }, [loadMarkets]);

  const market = useMemo(() => {
    const track = trackFor(asset, duration);
    return markets.find((m) => m.trackId === track?.id) ?? null;
  }, [markets, asset, duration]);

  const pool =
    onChainMode || !localPool
      ? market?.pool ?? { yesReserve: 10_000, noReserve: 10_000 }
      : localPool;
  const yesProb = impliedYesProbability(pool);
  const noProb = impliedNoProbability(pool);

  const preview = useMemo(() => {
    const usdc = parseFloat(amount) || 0;
    return {
      yes: buyYesShares(pool, usdc),
      no: buyNoShares(pool, usdc),
    };
  }, [amount, pool]);

  const onTrade = async (side: "yes" | "no") => {
    if (!wallet || !market) return;
    const usdc = parseFloat(amount);
    if (!usdc || usdc < 0.1) {
      showToast("❌ Min trade 0.10 USDC", "");
      return;
    }
    if (onChainMode && !market.onChainMarketId) {
      showToast("⏳ On-chain market syncing — refresh in a moment", "");
      void loadMarkets();
      return;
    }
    const next = side === "yes" ? preview.yes.nextPool : preview.no.nextPool;
    const ok = await handlePredictionTrade({
      asset,
      duration,
      side,
      usdcAmount: usdc,
      marketId: market.onChainMarketId ?? 0,
    });
    if (ok) {
      if (onChainMode) {
        setLocalPool(null);
        void loadMarkets();
      } else {
        setLocalPool(next);
      }
    }
  };

  const shareText = useMemo(() => {
    if (!market) return "";
    return buildPredictionShareText({
      asset: market.asset,
      duration: DURATION_LABEL[market.duration],
      yesPct: Math.round(yesProb * 100),
      price: formatUsd(market.currentPrice),
      openPrice: formatUsd(market.openPrice),
      ref: getReferralCode(wallet?.address ?? ""),
    });
  }, [market, yesProb, wallet?.address]);

  const shareOnX = () => {
    if (!shareText || !wallet) return;
    const url = `${APP_URL_WEB}?tab=predictions&ref=${getReferralCode(wallet.address)}`;
    window.open(twitterShare(shareText, url), "_blank", "noopener,noreferrer");
  };

  const shareOnFarcaster = () => {
    if (!shareText) return;
    const url = `${APP_URL_WEB}?tab=predictions`;
    window.open(warpcast(shareText, url), "_blank", "noopener,noreferrer");
  };

  if (!wallet) return null;

  return (
    <div className="w-full space-y-4 tab-content-enter">
      <QuestProgressBanner
        doneQuests={doneQuests}
        onGoQuests={() => setTab("checkin")}
      />

      {/* Hero */}
      <div className="terminal-panel rounded-2xl border border-emerald-500/20 overflow-hidden">
        <div className="h-0.5 bg-linear-to-r from-emerald-500 via-cyan-400 to-emerald-600" />
        <div className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black text-emerald-400/80 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp size={12} className="text-emerald-400" />
              Live prediction terminal
            </p>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-1">
              Predictions <span className="text-trade-yes">Market</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1.5 max-w-xl">
              BTC · ETH · SOL — 4h & daily rounds. CPMM YES/NO pricing on Base.
              Each trade +{POINTS_PER_PREDICTION} activity PP.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px]">
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-bold">
              6 live tracks
            </span>
            {onChainMode && (
              <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-bold">
                On-chain
              </span>
            )}
            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold">
              Chainlink resolve
            </span>
          </div>
        </div>
      </div>

      {/* Asset + duration tabs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 glass-panel p-1 rounded-xl flex-1">
          {PREDICTION_ASSETS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => { setAsset(a); setLocalPool(null); }}
              className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-colors ${
                asset === a ? "tab-active" : "text-slate-400 hover:bg-white/8"
              }`}
              style={asset === a ? { borderColor: ASSET_COLOR[a] } : undefined}
            >
              {a}
            </button>
          ))}
        </div>
        <div className="flex gap-1 glass-panel p-1 rounded-xl">
          {PREDICTION_DURATIONS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => { setDuration(d.id); setLocalPool(null); }}
              className={`px-3 py-2.5 rounded-lg text-xs font-black whitespace-nowrap transition-colors ${
                duration === d.id ? "tab-active" : "text-slate-400 hover:bg-white/8"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !market ? (
        <div className="py-16 text-center text-slate-500 font-bold text-sm animate-pulse">
          Loading markets…
        </div>
      ) : market ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Chart + market info */}
          <div className="xl:col-span-2 terminal-panel rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {market.asset} / USD · {DURATION_LABEL[market.duration]} · #{market.roundId}
                </p>
                <p className="text-4xl font-black text-white tabular-nums mt-1 tracking-tight">
                  {formatUsd(market.currentPrice)}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="text-xs text-slate-400 font-bold">
                    Open <span className="text-white">{formatUsd(market.openPrice)}</span>
                  </span>
                  <span
                    className={`text-xs font-black px-2 py-0.5 rounded-md ${
                      market.currentPrice >= market.openPrice
                        ? "prob-pill-yes text-trade-yes"
                        : "prob-pill-no text-trade-no"
                    }`}
                  >
                    {market.currentPrice >= market.openPrice ? "▲ ABOVE OPEN" : "▼ BELOW OPEN"}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex gap-2">
                  <div className="prob-pill-yes rounded-xl px-3 py-2 text-center min-w-[72px]">
                    <p className="text-[9px] font-black text-trade-yes uppercase">YES</p>
                    <p className="text-xl font-black text-white tabular-nums">{Math.round(yesProb * 100)}%</p>
                  </div>
                  <div className="prob-pill-no rounded-xl px-3 py-2 text-center min-w-[72px]">
                    <p className="text-[9px] font-black text-trade-no uppercase">NO</p>
                    <p className="text-xl font-black text-white tabular-nums">{Math.round(noProb * 100)}%</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                  <Clock size={11} /> {timeLeft(market.closeTime - Date.now())} left ·{" "}
                  <span className="text-cyan-400 uppercase">{market.phase}</span>
                  {market.isOnChain && market.onChainMarketId && (
                    <span className="text-emerald-500">· #{market.onChainMarketId}</span>
                  )}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={shareOnX}
                    className="share-btn-x text-[10px] font-black px-2.5 py-1 rounded-lg inline-flex items-center gap-1"
                  >
                    <XIcon size={12} /> X
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadMarkets()}
                    className="text-[10px] text-slate-500 hover:text-white inline-flex items-center gap-1"
                  >
                    <RefreshCcw size={10} /> Refresh
                  </button>
                </div>
              </div>
            </div>

            <TradingViewChart
              asset={asset}
              interval={tvInterval}
              onIntervalChange={setTvInterval}
              openPrice={market.openPrice}
              height={440}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl prob-pill-yes p-3">
                <p className="text-[10px] font-black text-trade-yes uppercase">YES · price &gt; open</p>
                <p className="text-2xl font-black text-white tabular-nums">{Math.round(yesProb * 100)}%</p>
                <PredictionDepthChart pool={pool} side="yes" />
              </div>
              <div className="rounded-xl prob-pill-no p-3">
                <p className="text-[10px] font-black text-trade-no uppercase">NO · price ≤ open</p>
                <p className="text-2xl font-black text-white tabular-nums">{Math.round(noProb * 100)}%</p>
                <PredictionDepthChart pool={pool} side="no" />
              </div>
            </div>
          </div>

          {/* Trade panel */}
          <div className="terminal-panel rounded-2xl p-4 sm:p-5 flex flex-col gap-4 border border-white/12">
            <p className="text-[10px] font-black text-emerald-400/90 uppercase tracking-widest">Trade panel</p>
            <div>
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">USDC amount</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="trade-input mt-1.5 w-full rounded-xl px-3 py-3 text-lg font-black"
              />
              <div className="flex gap-1.5 mt-2">
                {["5", "10", "25", "50"].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(p)}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-black bg-white/5 border border-white/10 text-slate-400 hover:border-emerald-500/30 hover:text-emerald-300"
                  >
                    ${p}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl bg-white/[0.03] border border-white/8 p-3 text-[11px] space-y-1.5 text-slate-400">
              <p>YES est. shares: <span className="text-emerald-400 font-bold">{preview.yes.sharesOut.toFixed(2)}</span></p>
              <p>NO est. shares: <span className="text-rose-400 font-bold">{preview.no.sharesOut.toFixed(2)}</span></p>
              <p className="text-slate-500 pt-1 border-t border-white/8">Winning shares redeem $1 USDC each · auto on resolve</p>
            </div>

            <button
              type="button"
              disabled={
                predictionLoading ||
                market.phase !== "open" ||
                (onChainMode && !market.onChainMarketId)
              }
              onClick={() => void onTrade("yes")}
              className="trade-btn-yes w-full py-3.5 rounded-xl font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {predictionLoading ? <RefreshCcw className="animate-spin" size={16} /> : <ArrowUp size={16} />}
              Buy YES · {Math.round(yesProb * 100)}%
            </button>
            <button
              type="button"
              disabled={
                predictionLoading ||
                market.phase !== "open" ||
                (onChainMode && !market.onChainMarketId)
              }
              onClick={() => void onTrade("no")}
              className="trade-btn-no w-full py-3.5 rounded-xl font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {predictionLoading ? <RefreshCcw className="animate-spin" size={16} /> : <ArrowDown size={16} />}
              Buy NO · {Math.round(noProb * 100)}%
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={shareOnX}
                className="share-btn-x py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5"
              >
                <XIcon size={14} /> Share on X
              </button>
              <button
                type="button"
                onClick={shareOnFarcaster}
                className="share-btn-farcaster py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5"
              >
                <FarcasterIcon size={14} /> Farcaster
              </button>
            </div>

            <p className="text-[9px] text-slate-600 leading-snug">
              {onChainMode && contractAddress ? (
                <>
                  Settled on-chain via{" "}
                  <code className="text-slate-500">{contractAddress.slice(0, 10)}…</code>
                  . Winning shares auto-redeem on resolve.
                </>
              ) : (
                <>
                  Demo mode — deploy{" "}
                  <code className="text-slate-500">NEXT_PUBLIC_PREDICTIONS_CONTRACT</code> and set{" "}
                  <code className="text-slate-500">PREDICTIONS_KEEPER_PRIVATE_KEY</code> for live markets.
                </>
              )}
            </p>
          </div>
        </div>
      ) : null}

      {/* Streak leaderboard */}
      <div className="glass-panel rounded-2xl border border-white/8 overflow-hidden">
        <div className="px-4 sm:p-5 py-3 border-b border-white/8 flex items-center justify-between">
          <p className="text-sm font-black text-white flex items-center gap-2">
            <Zap size={15} className="text-amber-400" /> Prediction streak leaderboard
          </p>
        </div>
        <div className="p-4 sm:p-5">
          {predictionStreak.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6">Win rounds to climb the streak board.</p>
          ) : (
            <div className="space-y-2">
              {predictionStreak.map((row, i) => (
                <StreakRow key={row.address} rank={i + 1} row={row} isMe={row.address === wallet.address.toLowerCase()} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* All 9 tracks grid */}
      <div className="glass-panel rounded-2xl border border-white/8 p-4 sm:p-5">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">All 6 concurrent markets</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {markets.map((m) => (
            <button
              key={m.trackId}
              type="button"
              onClick={() => { setAsset(m.asset); setDuration(m.duration); setLocalPool(null); }}
              className={`text-left rounded-xl p-3 border transition-colors ${
                m.trackId === market?.trackId
                  ? "border-cyan-500/40 bg-cyan-500/10"
                  : "border-white/8 bg-white/[0.02] hover:border-white/15"
              }`}
            >
              <p className="text-xs font-black text-white">{m.asset} · {DURATION_LABEL[m.duration]}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">{formatUsd(m.currentPrice)} · {m.phase}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FarcasterIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4.5 3h15v12.75L15 21l-3-3.75L9 21 4.5 15.75V3z" />
    </svg>
  );
}

function StreakRow({
  rank,
  row,
  isMe,
}: {
  rank: number;
  row: StreakEntry;
  isMe: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl px-3 py-2.5 border ${
        isMe ? "border-cyan-500/30 bg-cyan-500/8" : "border-white/8 bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-sm font-black text-slate-500 w-6">#{rank}</span>
        <span className="text-sm font-bold text-white truncate">
          {row.basename || `${row.address.slice(0, 6)}…${row.address.slice(-4)}`}
        </span>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-black text-amber-300">{row.streak}🔥</p>
        <p className="text-[9px] text-slate-500">{row.wins} wins</p>
      </div>
    </div>
  );
}
