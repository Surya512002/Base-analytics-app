"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  ExternalLink,
  Globe,
  Lock,
  MessageCircle,
  Shield,
  Share2,
  Sparkles,
  Twitter,
} from "lucide-react";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { BUILDER_CODE } from "@/lib/constants/env";
import { formatPlatformFeeLabel, LAUNCHPAD_PLATFORM_FEE_BPS } from "@/lib/constants/launchpad";
import TokenSwapPanel from "@/components/launchpad/TokenSwapPanel";
import QuickGiftCta from "@/components/voucher/QuickGiftCta";
import {
  fetchRecentSwaps,
  fetchTokenPairs,
  fetchTopHolders,
  type EnrichedHolder,
  type RecentSwapRow,
  type TokenPairStats,
} from "@/lib/api/launchpad-token-client";
import { fetchProtectionStatus } from "@/lib/api/launchpad-client";
import { feeShareLabels } from "@/lib/launchpad/fee-split";
import { captureTokenReferrerFromUrl } from "@/lib/utils/referral";
import TokenAnnouncementsPanel from "@/components/launchpad/TokenAnnouncementsPanel";
import TokenChartPanel from "@/components/launchpad/TokenChartPanel";
import TokenSocialProof from "@/components/launchpad/TokenSocialProof";
import { buildExploreTokenPath } from "@/lib/utils/app-url";
import { copyToClipboard } from "@/lib/utils/clipboard";
import {
  buildTokenSharePageUrl,
  buildTokenShareText,
  twitterShare,
  warpcast,
} from "@/lib/utils/share";
import { basescanTxUrl } from "@/lib/utils/tx";
import { isAppLaunched, tokenBadgeLabel } from "@/lib/launchpad/token-meta";
import {
  createdAgo,
  formatCompact,
  formatEth,
  formatSubscriptPrice,
  formatUsd,
  parseSupplyCap,
  shortAddr,
  timeAgo,
} from "@/lib/launchpad/format";

type Tab = "swap" | "chart" | "transactions" | "holders" | "info";

function pickBestPair(pairs: TokenPairStats[]): TokenPairStats | null {
  if (!pairs.length) return null;
  return [...pairs].sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? null;
}

function isAddressLike(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

export default function TokenDetailPanel({
  app,
  token,
  onBack,
  guestMode,
  onRequestConnect,
}: {
  app: WalletAppState;
  token: LaunchedToken;
  onBack: () => void;
  guestMode?: boolean;
  onRequestConnect?: () => void;
}) {
  const appLaunch = isAppLaunched(token);

  const [tab, setTab] = useState<Tab>("swap");
  const [pairs, setPairs] = useState<TokenPairStats[]>([]);
  const [pairsErr, setPairsErr] = useState<string | null>(null);
  const [loadingPairs, setLoadingPairs] = useState(false);
  const [swaps, setSwaps] = useState<RecentSwapRow[]>([]);
  const [swapsErr, setSwapsErr] = useState<string | null>(null);
  const [holders, setHolders] = useState<EnrichedHolder[]>([]);
  const [holdersErr, setHoldersErr] = useState<string | null>(null);
  const [top10Pct, setTop10Pct] = useState<number | null>(null);
  const [ethUsd, setEthUsd] = useState(2500);
  const [antiSnipeActive, setAntiSnipeActive] = useState(false);
  const [antiSnipeMsg, setAntiSnipeMsg] = useState<string | null>(null);

  useEffect(() => {
    captureTokenReferrerFromUrl(token.address);
  }, [token.address]);

  useEffect(() => {
    let alive = true;
    void fetchProtectionStatus(token.address, "buy")
      .then((s) => {
        if (!alive) return;
        setAntiSnipeActive(s.active);
        setAntiSnipeMsg(s.message ?? null);
      })
      .catch(() => {});
    const t = setInterval(() => {
      void fetchProtectionStatus(token.address, "buy").then((s) => {
        if (!alive) return;
        setAntiSnipeActive(s.active);
        setAntiSnipeMsg(s.message ?? null);
      });
    }, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [token.address]);

  useEffect(() => {
    let alive = true;
    setLoadingPairs(true);
    setPairsErr(null);
    void fetchTokenPairs(token.address)
      .then((d) => {
        if (!alive) return;
        setPairs(d.pairs ?? []);
        setPairsErr(d.error ?? null);
      })
      .catch(() => {
        if (!alive) return;
        setPairsErr("Failed to load pool stats");
      })
      .finally(() => {
        if (!alive) return;
        setLoadingPairs(false);
      });
    return () => {
      alive = false;
    };
  }, [token.address]);

  const best = useMemo(() => pickBestPair(pairs), [pairs]);
  const priceUsd = best?.priceUsd ? parseFloat(best.priceUsd) : undefined;
  const priceEth = best?.priceNative ? parseFloat(best.priceNative) : undefined;
  const mc = (best?.marketCap ?? best?.fdv) || undefined;
  const supply = parseSupplyCap(token.supplyCap);

  const tokenSharePageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${buildExploreTokenPath(token.address)}`
      : buildExploreTokenPath(token.address);

  const tokenShareOgUrl = buildTokenSharePageUrl(token.symbol, token.name, {
    price: priceUsd
      ? `$${priceUsd < 0.01 ? priceUsd.toExponential(2) : priceUsd.toFixed(4)}`
      : undefined,
    change24h: best?.priceChange?.h24,
    mcap: mc
      ? mc >= 1e6
        ? `$${(mc / 1e6).toFixed(2)}M`
        : `$${mc.toFixed(0)}`
      : undefined,
  });

  const tokenShareText = buildTokenShareText(token.symbol, token.name);

  useEffect(() => {
    let alive = true;
    setSwapsErr(null);
    void fetchRecentSwaps(token.address, 30)
      .then((d) => {
        if (!alive) return;
        setSwaps(d.swaps ?? []);
        setSwapsErr(d.error ?? null);
        if (d.ethUsd) setEthUsd(d.ethUsd);
      })
      .catch(() => {
        if (!alive) return;
        setSwapsErr("Failed to load swaps");
      });
    return () => {
      alive = false;
    };
  }, [token.address]);

  useEffect(() => {
    let alive = true;
    setHoldersErr(null);
    void fetchTopHolders(token.address, {
      decimals: token.decimals,
      priceUsd: priceUsd ?? 0,
      supplyCap: token.supplyCap ?? "1B",
      pool: best?.pairAddress,
      creator: token.creator,
    })
      .then((d) => {
        if (!alive) return;
        setHolders(d.holders ?? []);
        setHoldersErr(d.error ?? null);
        setTop10Pct(d.top10Pct ?? null);
      })
      .catch(() => {
        if (!alive) return;
        setHoldersErr("Failed to load holders");
      });
    return () => {
      alive = false;
    };
  }, [token.address, token.decimals, token.supplyCap, token.creator, priceUsd, best?.pairAddress]);

  const referralLink = useMemo(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}${buildExploreTokenPath(token.address)}?ref=${app.wallet?.address ?? ""}`;
  }, [token.address, app.wallet?.address]);

  const copy = async (t: string, label = "Copied") => {
    const ok = await copyToClipboard(t);
    app.showToast(ok ? label : "Copy failed — long-press to select", "");
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "swap", label: "Swap" },
    { id: "chart", label: "Chart" },
    { id: "transactions", label: "Transactions" },
    { id: "holders", label: "Holders" },
    { id: "info", label: "Info" },
  ];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="rounded-3xl border border-[#0052FF]/25 bg-linear-to-br from-[#0052FF]/12 via-[#0a1220]/90 to-black/40 overflow-hidden">
        <div className="h-1 bg-linear-to-r from-[#0052FF] via-[#3B7FFF] to-emerald-400" />
        <div className="p-5 sm:p-6">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-bold text-[#6BA3FF] hover:text-white mb-4"
          >
            ← All tokens
          </button>

          <div className="flex flex-col lg:flex-row lg:items-start gap-5">
            <div className="flex items-start gap-4 min-w-0 flex-1">
              {token.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={token.imageUrl}
                  alt=""
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border border-white/10 shadow-lg shadow-[#0052FF]/20"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#0052FF]/25 border border-[#0052FF]/40 flex items-center justify-center text-xl font-black text-[#6BA3FF]">
                  {token.symbol.slice(0, 2)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-white truncate">
                    {token.name}
                  </h1>
                  <span className="text-lg sm:text-xl font-black text-[#6BA3FF]">
                    ${token.symbol}/ETH
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void copy(token.address, "Contract address copied")}
                  className="text-[11px] text-slate-400 font-mono mt-1 flex items-center gap-1.5 hover:text-white transition-colors group"
                  title="Tap to copy full address"
                >
                  <Copy size={11} className="opacity-60 group-hover:opacity-100 shrink-0" />
                  <span className="truncate">{token.address}</span>
                </button>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-[#0052FF]/20 text-[#6BA3FF] border border-[#0052FF]/30">
                    {tokenBadgeLabel(token)}
                  </span>
                  {appLaunch && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                      Immutable
                    </span>
                  )}
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-300 border border-white/10">
                    ETH
                  </span>
                  {token.launchPreset && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-200 border border-violet-500/25">
                      {token.launchPreset}
                    </span>
                  )}
                  {antiSnipeActive && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-500/30">
                      Anti-snipe
                    </span>
                  )}
                </div>
                {antiSnipeActive && antiSnipeMsg && (
                  <p className="text-[11px] text-amber-200/90 mt-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2">
                    {antiSnipeMsg}
                  </p>
                )}
                {token.description && (
                  <p className="text-sm text-slate-400 mt-3 max-w-2xl leading-relaxed">
                    {token.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => void copy(referralLink, "Referral link copied")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[11px] font-bold text-amber-200 hover:text-white"
                  >
                    <Copy size={12} /> Referral link
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        twitterShare(tokenShareText, tokenSharePageUrl),
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-white/10 text-[11px] font-bold text-slate-200 hover:text-white"
                  >
                    <Twitter size={12} /> X
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      window.open(
                        warpcast(tokenShareText, tokenShareOgUrl),
                        "_blank",
                        "noopener,noreferrer"
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/30 text-[11px] font-bold text-purple-200 hover:text-white"
                  >
                    <MessageCircle size={12} /> Farcaster
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator
                        .share?.({
                          title: `$${token.symbol} on Base`,
                          text: tokenShareText,
                          url: tokenSharePageUrl,
                        })
                        .catch(() => void copy(tokenSharePageUrl, "Share link copied"));
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/30 text-[11px] font-bold text-violet-200 hover:text-white"
                  >
                    <Share2 size={12} /> Share
                  </button>
                  <button
                    type="button"
                    onClick={() => void copy(token.address, "Contract address copied")}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] text-slate-300 hover:text-white"
                  >
                    <Copy size={12} /> Copy address
                  </button>
                  <a
                    href={`https://dexscreener.com/base/${token.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] text-cyan-300 hover:text-white"
                  >
                    DexScreener <ExternalLink size={12} />
                  </a>
                  {token.website && (
                    <a
                      href={token.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] text-slate-400 hover:text-white"
                    >
                      <Globe size={12} /> Web
                    </a>
                  )}
                  {token.twitter && (
                    <a
                      href={token.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] text-slate-400 hover:text-white"
                    >
                      <Twitter size={12} /> X
                    </a>
                  )}
                  {token.telegram && (
                    <a
                      href={token.telegram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] text-slate-400 hover:text-white"
                    >
                      <MessageCircle size={12} /> TG
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2 w-full lg:w-[420px] shrink-0">
              {[
                {
                  label: "Price",
                  value: priceUsd ? formatSubscriptPrice(priceUsd) : loadingPairs ? "…" : "—",
                  sub: priceEth ? formatEth(priceEth) : "",
                },
                {
                  label: "Market cap",
                  value: mc ? formatUsd(mc) : "—",
                  sub: mc && ethUsd ? formatEth(mc / ethUsd) : "",
                },
                {
                  label: "Volume 24h",
                  value: formatUsd(best?.volume?.h24),
                  sub: best?.volume?.h24 && ethUsd ? formatEth(best.volume.h24 / ethUsd) : "",
                },
                {
                  label: "Liquidity",
                  value: formatUsd(best?.liquidity?.usd),
                  sub: best?.dexId ? `via ${best.dexId}` : "",
                },
                {
                  label: "Supply",
                  value: formatCompact(supply, 0),
                  sub: "Fixed cap",
                },
                {
                  label: "Created",
                  value: createdAgo(token.createdAt),
                  sub: `by ${shortAddr(token.creator)}`,
                },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5"
                >
                  <p className="text-[9px] font-bold text-slate-500 uppercase">{s.label}</p>
                  <p className="text-sm font-black text-white mt-0.5">{s.value}</p>
                  {s.sub && <p className="text-[9px] text-slate-500 mt-0.5 truncate">{s.sub}</p>}
                </div>
              ))}
            </div>
          </div>

          {pairsErr && <p className="text-[11px] text-rose-200 mt-3">{pairsErr}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[88px] py-2.5 rounded-lg text-xs font-black transition-colors ${
              tab === t.id
                ? "bg-[#0052FF]/25 text-[#6BA3FF] border border-[#0052FF]/40"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <TokenSocialProof
        creator={token.creator}
        holders={holders}
        swaps={swaps}
        holderCount={holders.length}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className={`${tab === "swap" ? "lg:col-span-5" : "lg:col-span-12"} space-y-5`}>
          {tab === "swap" && (
            <>
              <QuickGiftCta
                recipientAddress={token.creator}
                guest={guestMode}
                onConnect={onRequestConnect}
                compact
              />
              <TokenSwapPanel
                app={app}
                token={token}
                guestMode={guestMode}
                onRequestConnect={onRequestConnect}
              />
            </>
          )}
        </div>

        <div className={`${tab === "swap" ? "lg:col-span-7" : "lg:col-span-12"} space-y-5`}>
          {tab === "swap" && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase mb-3">Pool activity (24h)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Buys", value: best?.txns?.h24?.buys ?? 0 },
                  { label: "Sells", value: best?.txns?.h24?.sells ?? 0 },
                  {
                    label: "1h change",
                    value:
                      best?.priceChange?.h1 !== undefined
                        ? `${best.priceChange.h1.toFixed(2)}%`
                        : "—",
                  },
                  {
                    label: "24h change",
                    value:
                      best?.priceChange?.h24 !== undefined
                        ? `${best.priceChange.h24.toFixed(2)}%`
                        : "—",
                  },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-white/10 bg-black/20 p-3">
                    <p className="text-[10px] text-slate-500">{s.label}</p>
                    <p className="text-sm font-black text-white mt-1">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "chart" && (
            <TokenChartPanel
              pairAddress={best?.pairAddress}
              tokenAddress={token.address}
              swaps={swaps}
              swapsLoading={swaps.length === 0 && !swapsErr}
            />
          )}

          {tab === "transactions" && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <p className="text-sm font-black text-white">Transactions</p>
                <span className="text-[10px] text-slate-500">Recent pool swaps</span>
              </div>
              {swapsErr && (
                <p className="text-[11px] text-rose-200 px-4 py-3">{swapsErr}</p>
              )}
              {swaps.length === 0 && !swapsErr ? (
                <p className="text-sm text-slate-500 px-4 py-8 text-center">
                  No swaps yet — add liquidity and trade to populate this feed.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-[11px]">
                    <thead>
                      <tr className="text-slate-500 border-b border-white/5">
                        <th className="text-left font-bold py-3 px-4">Time</th>
                        <th className="text-left font-bold py-3 px-2">Type</th>
                        <th className="text-right font-bold py-3 px-2">Price</th>
                        <th className="text-right font-bold py-3 px-2">Amount</th>
                        <th className="text-right font-bold py-3 px-2">Value</th>
                        <th className="text-left font-bold py-3 px-2">Trader</th>
                        <th className="text-left font-bold py-3 px-4">Tx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {swaps.map((s, idx) => {
                        const tokenAmt =
                          Number(s.amountToken) / 10 ** (token.decimals || 18);
                        const ethAmt = Number(s.amountEth) / 1e18;
                        const price = s.priceUsd ?? (s.priceEth ? s.priceEth * ethUsd : 0);
                        const value = s.valueUsd ?? ethAmt * ethUsd;
                        const txUrl = s.txHash ? basescanTxUrl(s.txHash) : null;
                        return (
                          <tr
                            key={`${s.txHash || idx}`}
                            className="border-t border-white/[0.04] hover:bg-white/[0.02]"
                          >
                            <td className="py-2.5 px-4 text-slate-400 whitespace-nowrap">
                              {timeAgo(s.timestamp)}
                            </td>
                            <td
                              className={`py-2.5 px-2 font-black ${
                                s.side === "buy" ? "text-emerald-300" : "text-rose-300"
                              }`}
                            >
                              {s.side === "buy" ? "Buy" : "Sell"}
                            </td>
                            <td className="py-2.5 px-2 text-right text-slate-300">
                              <div>{formatSubscriptPrice(price)}</div>
                              <div className="text-[9px] text-slate-600">
                                {s.priceEth ? formatEth(s.priceEth) : "—"}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right text-white font-mono">
                              {formatCompact(tokenAmt)} {token.symbol}
                            </td>
                            <td className="py-2.5 px-2 text-right">
                              <div className="text-white font-mono">{formatEth(ethAmt)}</div>
                              <div className="text-[9px] text-slate-500">{formatUsd(value)}</div>
                            </td>
                            <td className="py-2.5 px-2 text-slate-400 font-mono">
                              {isAddressLike(s.trader) ? shortAddr(s.trader) : "—"}
                            </td>
                            <td className="py-2.5 px-4">
                              {txUrl ? (
                                <a
                                  href={txUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan-300 hover:text-white font-mono"
                                >
                                  {shortAddr(s.txHash!)}
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "holders" && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-white">Holders</p>
                <div className="flex gap-3 text-[10px] text-slate-500">
                  <span>
                    Top 10:{" "}
                    <span className="text-white font-bold">
                      {top10Pct !== null ? `${top10Pct.toFixed(2)}%` : "—"}
                    </span>
                  </span>
                  <span>{holders.length} shown</span>
                </div>
              </div>
              {holdersErr && (
                <p className="text-[11px] text-amber-200 px-4 py-3">{holdersErr}</p>
              )}
              {holders.length === 0 ? (
                <p className="text-sm text-slate-500 px-4 py-8 text-center">
                  Holder list unavailable — upgrade BaseScan API tier or check back later.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-[11px]">
                    <thead>
                      <tr className="text-slate-500 border-b border-white/5">
                        <th className="text-left font-bold py-3 px-4">#</th>
                        <th className="text-left font-bold py-3 px-2">Holder</th>
                        <th className="text-right font-bold py-3 px-2">Balance</th>
                        <th className="text-right font-bold py-3 px-2">Supply %</th>
                        <th className="text-right font-bold py-3 px-2">Value</th>
                        <th className="text-left font-bold py-3 px-4">Tag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {holders.map((h, i) => (
                        <tr
                          key={h.address}
                          className="border-t border-white/[0.04] hover:bg-white/[0.02]"
                        >
                          <td className="py-2.5 px-4 text-slate-500">{i + 1}</td>
                          <td className="py-2.5 px-2">
                            <a
                              href={`https://basescan.org/address/${h.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-300 hover:text-white font-mono"
                            >
                              {shortAddr(h.address)}
                            </a>
                          </td>
                          <td className="py-2.5 px-2 text-right text-white font-mono">
                            {formatCompact(h.balance)} {token.symbol}
                          </td>
                          <td className="py-2.5 px-2 text-right text-[#6BA3FF] font-bold">
                            {h.pctSupply.toFixed(2)}%
                          </td>
                          <td className="py-2.5 px-2 text-right text-emerald-300/90">
                            {formatUsd(h.valueUsd)}
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                                h.tag === "Pool liquidity"
                                  ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
                                  : h.tag === "Creator"
                                    ? "bg-[#0052FF]/15 text-[#6BA3FF] border border-[#0052FF]/25"
                                    : "bg-white/[0.06] text-slate-400 border border-white/10"
                              }`}
                            >
                              {h.tag}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "info" && (
            <div className="space-y-4">
              {appLaunch && (
                <TokenAnnouncementsPanel
                  token={token}
                  walletAddress={app.wallet?.address}
                  showToast={app.showToast}
                />
              )}

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Shield size={16} className="text-[#6BA3FF]" />
                  <p className="text-sm font-black text-white">Token facts</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[11px]">
                  {(appLaunch
                    ? [
                        ["Total supply", formatCompact(supply, 0)],
                        ["Quote", "ETH"],
                        ["Admin", "Renounced"],
                        ["Creator", shortAddr(token.creator)],
                        ["Builder", BUILDER_CODE],
                        ["Platform fee", formatPlatformFeeLabel(LAUNCHPAD_PLATFORM_FEE_BPS)],
                        ["Creator share", `${feeShareLabels().creator} of fee`],
                        ["Referrer share", `${feeShareLabels().referrer} of fee`],
                        ["Anti-snipe", `${token.antiSnipeBlocks ?? 8} blocks`],
                      ]
                    : [
                        ["Source", "DexScreener · Base"],
                        ["Type", tokenBadgeLabel(token) ?? "Base"],
                        ["Quote", "ETH"],
                        ["Platform fee", formatPlatformFeeLabel(LAUNCHPAD_PLATFORM_FEE_BPS)],
                        ["Builder", BUILDER_CODE],
                        ["Routing", "Uniswap + Aerodrome"],
                      ]
                  ).map(([k, v]) => (
                    <div key={k} className="rounded-xl border border-white/10 bg-black/20 p-3">
                      <p className="text-slate-500">{k}</p>
                      <p className="text-white font-mono mt-1 break-all">{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              {appLaunch ? (
                <div className="rounded-2xl border border-violet-500/25 bg-violet-500/[0.06] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={16} className="text-violet-200" />
                    <p className="text-sm font-black text-violet-100">Why we beat typical launchpads</p>
                  </div>
                  <ul className="space-y-2 text-[11px] text-violet-100/80">
                    <li>$0 launch fee — pay Base gas only</li>
                    <li>
                      {formatPlatformFeeLabel()} swap fee — split on-chain:{" "}
                      {feeShareLabels().creator} creator · {feeShareLabels().platform} platform ·{" "}
                      {feeShareLabels().referrer} referrer
                    </li>
                    <li>Dual-DEX auto-routing (Uniswap + Aerodrome)</li>
                    <li>Vanity 0xB200… addresses + true unminted vesting</li>
                    <li>Every on-app tx includes builder code {BUILDER_CODE}</li>
                  </ul>
                </div>
              ) : (
                <div className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={16} className="text-cyan-200" />
                    <p className="text-sm font-black text-cyan-100">External token</p>
                  </div>
                  <ul className="space-y-2 text-[11px] text-cyan-100/80">
                    <li>Discovered via DexScreener — not launched in this app</li>
                    <li>Trade via Uniswap + Aerodrome with platform fee</li>
                    <li>Creator fee split / anti-snipe apply only to app launches</li>
                  </ul>
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Lock size={16} className="text-slate-400" />
                  <p className="text-sm font-black text-white">Disclosures</p>
                </div>
                <ul className="space-y-2 text-[11px] text-slate-400">
                  <li>
                    <span className="text-white font-bold">Immutable token</span> — no live admin by
                    default. Metadata fixed at launch unless you opted in.
                  </li>
                  <li>
                    <span className="text-white font-bold">Dual-DEX</span> — swaps route through
                    Uniswap V3 or Aerodrome with auto best-quote.
                  </li>
                  <li>
                    <span className="text-white font-bold">Liquidity</span> — add WETH pools on
                    Uniswap or Aerodrome after launch to enable trading.
                  </li>
                  <li>
                    <span className="text-white font-bold">Anti-snipe</span> — buys blocked via
                    Base Analytics for {token.antiSnipeBlocks ?? 8} blocks after pool opens. Direct
                    Uniswap/Aerodrome trades are not blocked.
                  </li>
                  <li>
                    <span className="text-white font-bold">Referrals</span> — share your link to earn{" "}
                    {feeShareLabels().referrer} of swap fees when others trade through the app.
                  </li>
                  {token.vestingSchedule && token.vestingSchedule.length > 0 && (
                    <li>
                      <span className="text-white font-bold">Vested allocations</span> —{" "}
                      {token.vestingSchedule.length} schedule(s) recorded; tokens stay unminted until
                      vault ships.
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
