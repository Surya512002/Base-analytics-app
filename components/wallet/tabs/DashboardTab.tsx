"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowRightLeft, BadgeCheck, BarChart3, BrainCircuit, Calendar,
  ChevronDown, ChevronUp, Clock, Coins, CreditCard,
  Database, DollarSign, Droplets, ExternalLink, FileCode, Flame, Gauge, Gift,
  GitBranch, Globe, History, Landmark, Layers, Lock, MousePointerClick,
  Palette, RefreshCcw, Repeat2, Rocket, Send, Share2, ShieldCheck, Smartphone, Sparkles,
  Star, Sun, Swords, Target, TrendingUp, Trophy, Twitter, User, Users, Wifi,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import AnalyticsPaywall from "@/components/wallet/AnalyticsPaywall";
import OnchainScorePanel from "@/components/wallet/OnchainScorePanel";
import PremiumBanner from "@/components/wallet/PremiumBanner";
import PremiumInsightsPanel from "@/components/wallet/PremiumInsightsPanel";
import ReferralPanel from "@/components/wallet/ReferralPanel";
import WatchlistPanel from "@/components/wallet/WatchlistPanel";
import {
  ACHIEVEMENTS_ABI,
  ACHIEVEMENTS_CONTRACT,
  BASE_BRIDGE,
  BOOSTER_CONTRACT,
  CHECKIN_CONTRACT,
  ENTRYPOINT_V06,
  ENTRYPOINT_V07,
  GM_GN_CONTRACT,
} from "@/lib/constants/contracts";
import { DEX_ROUTERS } from "@/lib/constants/protocols";
import { formatDexVolumeUsd } from "@/lib/utils/swap-volume";
import { ACHIEVEMENTS, SEASON_NAME, WEEKLY_QUESTS } from "@/lib/constants/season";
import { getLevelStyle, getTargetTokenId } from "@/lib/utils/achievements";
import { getDaysLeft, getSeasonPct } from "@/lib/utils/season";
import { getAppContractHit, isPaymasterActivity } from "@/lib/utils/app-contracts";
import type { AlchemyTransfer } from "@/lib/types/wallet";
import type { WalletAppState } from "@/hooks/useWalletApp";
import LaunchpadDashboardWidget from "@/components/launchpad/LaunchpadDashboardWidget";
import type { LaunchedToken } from "@/lib/launchpad/types";
import WalletStatsSections from "@/components/wallet/WalletStatsSections";
import {
  formatWalletDisplayLabel,
  resolveMiniAppIdentityForAddress,
  type MiniAppIdentity,
} from "@/lib/utils/mini-app-identity";
import { resolveBasenameClient } from "@/lib/utils/resolve-basename";
import ScoreImprovementTips from "@/components/wallet/ScoreImprovementTips";
import ChallengePromoCard from "@/components/wallet/ChallengePromoCard";
import WeeklyRecapBanner from "@/components/wallet/WeeklyRecapBanner";
import { buildQuestDeepLink, syncTabUrl } from "@/lib/utils/app-url";
import type { AppTab } from "@/hooks/useWalletApp";

const FarcasterAnalytics = dynamic(
  () => import("@/components/wallet/FarcasterAnalytics"),
  { loading: () => <div className="h-48 glass-panel rounded-3xl animate-pulse" /> }
);

export default function DashboardTab({ app }: { app: WalletAppState }) {
  const {
    wallet, selDay, setSelDay,
    scrollRef, boosts, sponsored, streak,
    challenge, setChallenge,
    challengeResult, challengeLoading, weeklyXP,
    x402PayCount, mintedCount,
    showToast, handleChallenge, shareScore, shareAch,
    shareAll, leaderboard, lbLoading, doneQuests,
    premiumUnlocked, premiumLoading, premiumData, premiumInsights, handlePremiumScan,
    x402Product, setX402Product,
    farcasterUnlocked, farcasterUnlockLoading, handleFarcasterUnlock,
    analyticsUnlocked, analyticsUnlockLoading, handleAnalyticsUnlock,
    walletRefreshing, scanProgress, analyticsSyncing,
    miniAppIdentity, walletDisplayLabel,
    setTab,
  } = app;

  const [displayBasename, setDisplayBasename] = useState<string | null>(null);
  const [resolvedMiniApp, setResolvedMiniApp] = useState<MiniAppIdentity | null>(
    null
  );
  const [resolvingIdentity, setResolvingIdentity] = useState(false);

  useEffect(() => {
    if (!wallet?.address) return;
    if (wallet.basename) {
      setDisplayBasename(wallet.basename);
      return;
    }
    let alive = true;
    setResolvingIdentity(true);
    void Promise.all([
      resolveBasenameClient(wallet.address),
      miniAppIdentity
        ? Promise.resolve(miniAppIdentity)
        : resolveMiniAppIdentityForAddress(wallet.address),
    ])
      .then(([basename, mini]) => {
        if (!alive) return;
        if (basename) setDisplayBasename(basename);
        if (mini) setResolvedMiniApp(mini);
      })
      .finally(() => {
        if (alive) setResolvingIdentity(false);
      });
    return () => {
      alive = false;
    };
  }, [wallet?.address, wallet?.basename, miniAppIdentity]);

  const identityLabel = (() => {
    if (!wallet) return "";
    if (displayBasename || wallet.basename) {
      return displayBasename || wallet.basename || walletDisplayLabel;
    }
    const mini = miniAppIdentity ?? resolvedMiniApp;
    if (mini?.displayName || mini?.username) {
      return formatWalletDisplayLabel(wallet.address, { miniApp: mini });
    }
    if (resolvingIdentity) return "Loading profile…";
    return walletDisplayLabel;
  })();

  const openLaunchpad = (token?: LaunchedToken) => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "launchpad");
      if (token) url.searchParams.set("token", token.address);
      else url.searchParams.delete("token");
      window.history.replaceState({}, "", url);
    }
    setTab("launchpad");
  };

  const navigateFromTip = (nextTab: AppTab, questId?: string) => {
    if (questId && typeof window !== "undefined") {
      window.location.href = buildQuestDeepLink(questId);
      return;
    }
    setTab(nextTab);
    syncTabUrl(nextTab);
  };

  const rankLabel = useMemo(() => {
    if (!wallet?.address) return undefined;
    const entry = leaderboard.find(
      (e) => e.address.toLowerCase() === wallet.address.toLowerCase()
    );
    return entry?.rank != null ? `Rank #${entry.rank}` : undefined;
  }, [leaderboard, wallet]);

if (!wallet) return null;

  const scoreSyncing =
    wallet.score <= 0 &&
    (walletRefreshing || analyticsSyncing) &&
    (wallet.recommendation.includes("Fetching") ||
      wallet.recommendation.includes("Syncing") ||
      wallet.recommendation.includes("Refining"));

  /** Post-pay: big blur overlay over score/heatmap until full analysis pass settles. */
  const onchainAnalysisLoading =
    analyticsUnlocked &&
    (analyticsUnlockLoading ||
      analyticsSyncing ||
      walletRefreshing ||
      scoreSyncing ||
      wallet.recommendation.includes("Fetching onchain") ||
      wallet.recommendation.includes("Syncing full") ||
      wallet.recommendation.includes("Refining"));

  return (
          <div className="space-y-4">
            <LaunchpadDashboardWidget
              wallet={wallet.address}
              onOpenLaunchpad={openLaunchpad}
            />

            <WeeklyRecapBanner
              weeklyXP={weeklyXP}
              doneQuests={doneQuests}
              totalQuests={WEEKLY_QUESTS.length}
              streak={streak}
              rankLabel={rankLabel}
            />

            <PremiumBanner
              premiumLoading={premiumLoading}
              premiumUnlocked={premiumUnlocked}
              premiumData={premiumData}
              x402PayCount={x402PayCount}
              product={x402Product}
              onProductChange={setX402Product}
              onPay={handlePremiumScan}
            />

            {premiumUnlocked && (
              <PremiumInsightsPanel insights={premiumInsights} unlocked={premiumUnlocked} />
            )}

            <AnalyticsPaywall
              unlocked={analyticsUnlocked}
              unlockLoading={analyticsUnlockLoading}
              analysisLoading={onchainAnalysisLoading}
              onUnlock={handleAnalyticsUnlock}
              scanProgress={scanProgress}
              walletRefreshing={walletRefreshing || analyticsSyncing}
            >
              <OnchainScorePanel
                wallet={wallet}
                streak={streak}
                doneQuests={doneQuests}
                selDay={selDay}
                setSelDay={setSelDay}
                scrollRef={scrollRef}
                onGoCheckIn={() => app.setTab("checkin")}
                onGoQuests={() => app.setTab("checkin")}
                shareScore={shareScore}
                syncing={scoreSyncing || analyticsSyncing}
                scanProgress={scanProgress}
              />
            </AnalyticsPaywall>
            {wallet.topTokens.length > 0 && (
              <div className="glass-panel rounded-2xl p-5">
                <p className="section-eyebrow mb-3">Tokens you&apos;ve traded</p>
                <div className="flex flex-wrap gap-2">
                  {wallet.topTokens.slice(0, 8).map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => openLaunchpad()}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:border-[var(--brand)] hover:text-[var(--brand-dark)] hover:bg-[var(--brand-soft)]"
                    >
                      {sym}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => openLaunchpad()}
                  className="mt-3 text-[11px] font-bold text-[#6BA3FF]"
                >
                  Find them in Explore →
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
              {[
                {label:'Age Percentile',value:wallet.onchainAgePercentile>0?`Top ${Math.min(99,Math.max(1,100-wallet.onchainAgePercentile))}%`:'—',sub:`vs Base median`,icon:<GitBranch size={16} className="analytics-tile-icon"/>,active:wallet.onchainAgePercentile>0},
                {label:'Total Txs',value:wallet.txCount.toLocaleString(),sub:`Lifetime interactions`,icon:<Layers size={16} className="analytics-tile-icon"/>,active:true},
                {label:'AA Txs',value:(wallet.aaTxCount??0).toLocaleString(),sub:'Account abstraction (4337)',icon:<Smartphone size={16} className="analytics-tile-icon"/>,active:(wallet.aaTxCount??0)>0},
                {label:'Base App / gasless',value:wallet.paymasterTxCount.toLocaleString(),sub:'Paymaster · smart wallet',icon:<Droplets size={16} className="analytics-tile-icon"/>,active:wallet.paymasterTxCount>0},
                {label:'Bridge Txs',value:wallet.bridgeTxCount.toString(),sub:'L1 ↔ Base bridge',icon:<Globe size={16} className="analytics-tile-icon"/>,active:wallet.bridgeTxCount>0},
                {label:'Net ETH Flow',value:`${wallet.netETHFlow>=0?'+':''}${wallet.netETHFlow} Ξ`,sub:wallet.netETHFlow>=0?'Net receiver':'Net sender',icon:<TrendingUp size={16} className={wallet.netETHFlow>=0?'text-green-400':'text-red-400'}/>,active:true},
              ].map((s,i)=>(
                <div key={i} className={`analytics-tile p-4 ${s.active?'':'opacity-60'}`}>
                  <div className="mb-2 analytics-tile-icon">{s.icon}</div>
                  <p className={`font-black text-lg leading-tight ${s.active?'text-[var(--ink)]':'text-[var(--ink-muted)]'}`}>{s.value}</p>
                  <p className="text-[9px] text-[var(--ink-muted)] uppercase font-bold tracking-wide mt-0.5">{s.label}</p>
                  <p className="text-[9px] text-[var(--ink-dim)] mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>

            <div className="page-hero mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-[var(--surface-2)] border border-[var(--border-subtle)] rounded-2xl flex items-center justify-center shrink-0">
                  <User size={22} className="analytics-tile-icon"/>
                </div>
                <div className="min-w-0">
                  <p className="font-display page-hero-title truncate">
                    {identityLabel}
                  </p>
                  {(displayBasename || wallet.basename || miniAppIdentity || resolvedMiniApp) && (
                    <p className="text-[11px] text-slate-500 font-mono truncate mt-0.5">
                      {wallet.address.slice(0, 8)}…{wallet.address.slice(-4)}
                    </p>
                  )}
                  <p className="text-[11px] text-[var(--ink-muted)] font-semibold mt-1">{wallet.walletRank}</p>
                </div>
              </div>
            </div>

            <WalletStatsSections
              overview={[
                { label: "Portfolio", value: `$${wallet.portfolioValueUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, icon: <DollarSign size={15} className="analytics-tile-icon" /> },
                { label: "Total Txs", value: wallet.txCount.toLocaleString(), icon: <Layers size={15} className="analytics-tile-icon" /> },
                { label: "AA txs", value: (wallet.aaTxCount ?? 0).toLocaleString(), icon: <Smartphone size={15} className="analytics-tile-icon" />, dim: (wallet.aaTxCount ?? 0) <= 0 },
                { label: "Base App / gasless", value: wallet.paymasterTxCount.toLocaleString(), icon: <Droplets size={15} className="analytics-tile-icon" />, dim: wallet.paymasterTxCount <= 0 },
                { label: "Age percentile", value: wallet.onchainAgePercentile > 0 ? `Top ${Math.min(99, Math.max(1, 100 - wallet.onchainAgePercentile))}%` : "—", icon: <GitBranch size={15} className="analytics-tile-icon" />, dim: wallet.onchainAgePercentile <= 0 },
                { label: "Net ETH flow", value: `${wallet.netETHFlow >= 0 ? "+" : ""}${wallet.netETHFlow} Ξ`, icon: <TrendingUp size={15} className={wallet.netETHFlow >= 0 ? "text-green-400" : "text-red-400"} /> },
                { label: "Bridge txs", value: wallet.bridgeTxCount, icon: <Globe size={15} className="analytics-tile-icon" />, dim: wallet.bridgeTxCount <= 0 },
              ]}
              balances={[
                { label: "ETH balance", value: `${wallet.balance} Ξ`, icon: <CreditCard size={15} className="analytics-tile-icon" /> },
                { label: "USDC balance", value: `$${wallet.usdcBalance ?? "0.00"}`, icon: <DollarSign size={15} className="analytics-tile-icon" /> },
                { label: "x402 payments", value: x402PayCount, icon: <Zap size={15} className="analytics-tile-icon" /> },
                { label: "Days on Base", value: wallet.daysOnBase.toLocaleString(), icon: <Calendar size={15} className="analytics-tile-icon" /> },
              ]}
              activity={[
                { label: "Active days", value: wallet.uniqueDays, icon: <Sun size={15} className="analytics-tile-icon" /> },
                { label: "Active weeks", value: wallet.activeWeeks, icon: <Calendar size={15} className="analytics-tile-icon" /> },
                { label: "Active months", value: wallet.activeMonths, icon: <Calendar size={15} className="analytics-tile-icon" /> },
                { label: "Current streak", value: `${wallet.currentStreak}d`, icon: <Flame size={15} className="analytics-tile-icon" /> },
                { label: "Longest streak", value: `${wallet.longestStreak}d`, icon: <Trophy size={15} className="analytics-tile-icon" /> },
                { label: "Longest gap", value: `${wallet.longestInactiveDays}d`, icon: <Clock size={15} className="analytics-tile-icon" /> },
                { label: "Peak day txs", value: wallet.peakDayTxCount, icon: <Gauge size={15} className="analytics-tile-icon" /> },
                { label: "Peak active day", value: wallet.peakDayDate, icon: <Star size={15} className="analytics-tile-icon" /> },
                { label: "Avg tx / day", value: wallet.avgTxPerDay, icon: <BarChart3 size={15} className="analytics-tile-icon" /> },
                { label: "Avg tx / week", value: wallet.weeklyTxAvg, icon: <Activity size={15} className="analytics-tile-icon" /> },
                { label: "First tx", value: wallet.firstTx, icon: <Star size={15} className="analytics-tile-icon" /> },
                { label: "Last tx", value: wallet.lastTx, icon: <Clock size={15} className="analytics-tile-icon" /> },
                { label: "Most active month", value: wallet.mostActiveMonth, icon: <Clock size={15} className="analytics-tile-icon" /> },
              ]}
              trading={[
                { label: "Swap volume", value: formatDexVolumeUsd(wallet.dexVolumeUSD), icon: <TrendingUp size={15} className="analytics-tile-icon" /> },
                { label: "ETH swap vol", value: formatDexVolumeUsd(wallet.ethSwapVolumeUSD ?? 0), icon: <Coins size={15} className="analytics-tile-icon" /> },
                { label: "Swap count", value: wallet.dexTradeCount.toLocaleString(), icon: <Repeat2 size={15} className="analytics-tile-icon" /> },
                { label: "Token swaps", value: wallet.swapCount.toLocaleString(), icon: <ArrowRightLeft size={15} className="analytics-tile-icon" /> },
                { label: "Unique tokens", value: wallet.tokensSwapped, icon: <Coins size={15} className="analytics-tile-icon" /> },
                { label: "DeFi interactions", value: wallet.defiInteractions.toLocaleString(), icon: <TrendingUp size={15} className="analytics-tile-icon" /> },
                { label: "Unique protocols", value: wallet.uniqueProtocols, icon: <Landmark size={15} className="analytics-tile-icon" /> },
                { label: "Fav protocol", value: wallet.mostUsedProtocol, icon: <Star size={15} className="analytics-tile-icon" /> },
                { label: "ETH sent", value: `${wallet.ethVolume} Ξ`, icon: <ArrowRightLeft size={15} className="analytics-tile-icon" /> },
                { label: "ETH received", value: `${wallet.ethReceived} Ξ`, icon: <Gift size={15} className="analytics-tile-icon" /> },
                { label: "Contract txs", value: wallet.contractInteractions.toLocaleString(), icon: <FileCode size={15} className="analytics-tile-icon" /> },
                { label: "ERC-20 txs", value: wallet.erc20Txs.toLocaleString(), icon: <Coins size={15} className="analytics-tile-icon" /> },
                { label: "NFT txs", value: wallet.erc721Txs.toLocaleString(), icon: <Palette size={15} className="analytics-tile-icon" /> },
                { label: "NFTs held", value: wallet.nftCount.toLocaleString(), icon: <Sparkles size={15} className="analytics-tile-icon" /> },
              ]}
              engagement={[
                { label: "Onchain streak", value: `${streak}d`, icon: <Zap size={15} className="analytics-tile-icon" /> },
                { label: "Check-ins", value: wallet.checkInCount.toLocaleString(), icon: <Flame size={15} className="analytics-tile-icon" /> },
                { label: "GM / GN", value: wallet.gmCount.toLocaleString(), icon: <Star size={15} className="analytics-tile-icon" /> },
                { label: "XP boosts", value: boosts, icon: <Rocket size={15} className="analytics-tile-icon" /> },
                { label: "Minted badges", value: mintedCount, icon: <Trophy size={15} className="analytics-tile-icon" /> },
                { label: "Weekly XP", value: weeklyXP, icon: <Zap size={15} className="analytics-tile-icon" /> },
                { label: "Activity score", value: `${wallet.activityScore}/100`, icon: <Activity size={15} className="analytics-tile-icon" /> },
                { label: "Wallet health", value: `${wallet.walletHealthScore}/100`, icon: <ShieldCheck size={15} className="analytics-tile-icon" /> },
              ]}
            />

            <FarcasterAnalytics
              address={wallet.address}
              unlocked={farcasterUnlocked}
              unlockLoading={farcasterUnlockLoading}
              onUnlock={handleFarcasterUnlock}
            />

            <ScoreImprovementTips wallet={wallet} onNavigate={navigateFromTip} />

            <ChallengePromoCard
              wallet={wallet}
              onChallenge={() => {
                const el = document.getElementById("wallet-challenge-input");
                el?.scrollIntoView({ behavior: "smooth", block: "center" });
                el?.focus();
              }}
            />

            <WatchlistPanel myAddress={wallet.address} />

            <div className="glass-panel rounded-2xl p-5" id="wallet-challenge-section">
              <div className="flex items-center gap-2 mb-3"><Swords size={18} className="analytics-tile-icon"/><span className="font-black text-[var(--ink)]">Wallet Challenge</span></div>
              <p className="text-xs text-[var(--ink-muted)] mb-4">Enter any wallet to compare real onchain scores.</p>
              <div className="flex gap-2 mb-3">
                <input id="wallet-challenge-input" value={challenge} onChange={e=>setChallenge(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleChallenge()}
                  placeholder="0x..." className="flex-1 min-w-0 input-ink rounded-xl px-3 py-2.5 text-xs font-mono placeholder-slate-600"/>
                <button onClick={handleChallenge} disabled={challengeLoading}
                  className="shrink-0 btn-primary disabled:opacity-50 px-5 py-2.5 rounded-xl font-black text-xs transition-all active:scale-95 flex items-center gap-1">
                  {challengeLoading?<RefreshCcw size={12} className="animate-spin"/>:'Go'}
                </button>
              </div>
              {challengeResult&&(
                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded-xl p-3 text-center border ${wallet.score>=challengeResult.score?'bg-[var(--brand-soft)] border-[var(--brand)]/35':'bg-[var(--surface-2)] border-[var(--border-subtle)]'}`}>
                    <p className="text-[10px] text-[var(--ink-muted)] uppercase font-bold">You</p>
                    <p className="text-3xl font-black text-[var(--ink)] my-1">{wallet.score}</p>
                    <p className="text-[9px] text-[var(--ink-dim)]">{wallet.uniqueDays} days</p>
                    {wallet.score>challengeResult.score&&<p className="text-[10px] font-black text-[var(--brand-dark)] mt-1">WINNER 🏆</p>}
                  </div>
                  <div className={`rounded-xl p-3 text-center border ${challengeResult.score>wallet.score?'bg-[var(--brand-soft)] border-[var(--brand)]/35':'bg-[var(--surface-2)] border-[var(--border-subtle)]'}`}>
                    <p className="text-[10px] text-[var(--ink-muted)] uppercase font-bold">{challengeResult.address.slice(0,6)}...</p>
                    <p className="text-3xl font-black text-[var(--ink)] my-1">{challengeResult.score}</p>
                    <p className="text-[9px] text-[var(--ink-dim)]">{challengeResult.days} days</p>
                    {challengeResult.score>wallet.score&&<p className="text-[10px] font-black text-[var(--brand-dark)] mt-1">WINNER 🏆</p>}
                  </div>
                </div>
              )}
            </div>

            <ReferralPanel address={wallet.address} />

            <div className="glass-panel rounded-2xl p-5 border border-[var(--border-subtle)]">
              <p className="section-eyebrow mb-2">Quick help</p>
              <ul className="space-y-2 text-xs text-[var(--ink-dim)]">
                <li>
                  <span className="text-[var(--ink)] font-bold">Explore</span> — search tokens, swap,
                  and earn quest XP.
                </li>
                <li>
                  <span className="text-[var(--ink)] font-bold">Analytics</span> — score, heatmap, and
                  improvement tips update as history syncs.
                </li>
                <li>
                  <span className="text-[var(--ink)] font-bold">⌘K</span> — jump to any tab, token, or
                  voucher from anywhere.
                </li>
              </ul>
            </div>

            <div>
              <p className="text-[10px] font-black text-[var(--ink-muted)] uppercase tracking-widest mb-3 flex items-center gap-2"><History size={12}/>Recent Activity</p>
              <div className="glass-panel-accent rounded-2xl overflow-hidden shadow-lg shadow-black/25">
                {wallet.recentTxs.length>0?wallet.recentTxs.map((tx: AlchemyTransfer, i: number)=>{
                  const toAddr=(tx.to||'').toLowerCase();
                  const wAddr=wallet.address.toLowerCase();
                  const appHit=getAppContractHit(tx,wAddr);
                  const isGM=appHit==='gm';
                  const isBoost=appHit==='booster';
                  const isCI=appHit==='checkin';
                  const isBadge=appHit==='achievements';
                  const isLaunch=appHit==='launchpad';
                  const isDEX=DEX_ROUTERS.has(toAddr);
                  const isBridge=toAddr===BASE_BRIDGE.toLowerCase();
                  const isPaymaster=isPaymasterActivity(tx,wAddr)||toAddr===ENTRYPOINT_V06.toLowerCase()||toAddr===ENTRYPOINT_V07.toLowerCase();
                  let label='Contract Call',badge:string|null=null;
                  let icon=<ArrowRightLeft size={13} className="analytics-tile-icon"/>;
                  if(isGM){label='GM / GN';icon=<Star size={13} className="analytics-tile-icon"/>;badge='☀️ Vibes';}
                  else if(isBoost){label='XP Boost';icon=<Rocket size={13} className="analytics-tile-icon"/>;badge='🚀 Boost';}
                  else if(isCI){label='Check-In';icon=<Flame size={13} className="analytics-tile-icon"/>;badge='🔥 Streak';}
                  else if(isBadge){label='Badge Mint';icon=<Trophy size={13} className="text-yellow-300"/>;badge='🏅 Badge';}
                  else if(isLaunch){label='Launchpad';icon=<TrendingUp size={13} className="analytics-tile-icon"/>;badge='🚀 Launch';}
                  else if(isDEX){label='DEX Swap';icon=<Repeat2 size={13} className="analytics-tile-icon"/>;badge='🔄 Swap';}
                  else if(isBridge){label='Bridge Tx';icon=<Globe size={13} className="analytics-tile-icon"/>;badge='🌉 Bridge';}
                  else if(isPaymaster){label=tx.category==='useroperation'||tx.metadata?.isUserOperation?'AA / Base App Tx':'Gasless Tx';icon=<Droplets size={13} className="analytics-tile-icon"/>;badge=tx.metadata?.isSponsored?'⛽ Sponsored':'⚡ AA';}
                  else if(tx.category==='erc721'||tx.category==='erc1155'){
                    const isMint=(tx.from||'').toLowerCase()==='0x0000000000000000000000000000000000000000';
                    label=isMint?'NFT Mint':'NFT Transfer';
                    icon=<Sparkles size={13} className="analytics-tile-icon"/>;
                  }
                  else if(tx.category==='erc20'){label='Token Transfer';icon=<Coins size={13} className="analytics-tile-icon"/>;}
                  else if(tx.category==='internal'){label='Internal Tx';icon=<Zap size={13} className="analytics-tile-icon"/>;}
                  return(
                    <div key={i} className={`flex items-center justify-between p-3 sm:p-4 gap-3 hover:bg-[var(--surface-2)] transition-colors ${i!==wallet.recentTxs.length-1?'border-b border-[var(--border-subtle)]':''}`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 border rounded-xl flex items-center justify-center shrink-0 ${isGM?'bg-yellow-500/10 border-yellow-500/20':isCI?'bg-orange-500/10 border-orange-500/20':isBadge?'bg-yellow-500/10 border-yellow-500/20':'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'}`}>{icon}</div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-black text-[var(--ink)] uppercase truncate">{label}</p>
                            {badge&&<span className="text-[9px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--ink-muted)] px-1.5 py-0.5 rounded-full font-bold shrink-0">{badge}</span>}
                          </div>
                          <p className="text-[10px] text-slate-500 truncate">{new Date(tx.metadata.blockTimestamp).toLocaleString()}</p>
                          {tx.to&&<p className="text-[9px] text-slate-700 font-mono truncate">{tx.to.slice(0,10)}…</p>}
                        </div>
                      </div>
                      <a href={`https://basescan.org/tx/${tx.hash}`} target="_blank" rel="noreferrer"
                        className="shrink-0 text-[10px] font-black text-[var(--ink-muted)] hover:text-[var(--ink)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-xl flex items-center gap-1 transition-all whitespace-nowrap">
                        <ExternalLink size={9}/>{tx.value&&tx.value>0?`${parseFloat(tx.value.toFixed(4))} ${tx.asset||'ETH'}`:'View ↗'}
                      </a>
                    </div>
                  );
                }):(
                  <p className="text-slate-600 text-sm text-center py-8">
                    {analyticsSyncing || scoreSyncing
                      ? "Syncing your onchain activity…"
                      : "No recent transactions found."}
                  </p>
                )}
              </div>
            </div>
          </div>
  );
}
