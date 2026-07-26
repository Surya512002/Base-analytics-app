"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { connectAppWallet } from "@/lib/utils/mini-app-connect";
import { getEip1193Provider } from "@/app/connection";
import { fetchWalletAnalysis, fetchWalletAnalysisQuick, fetchWalletBootstrap, pollWalletHistorySync } from "@/lib/api/wallet-analysis-client";
import { fetchLeaderboard, saveLeaderboard } from "@/lib/api/leaderboard";
import { fetchWalletTransfers } from "@/lib/api/wallet-txs";
import {
  formatWalletDisplayLabel,
  persistMiniAppIdentity,
  readPersistedMiniAppIdentity,
  resolveMiniAppIdentity,
  type MiniAppIdentity,
} from "@/lib/utils/mini-app-identity";
import { resolveBasenameClient } from "@/lib/utils/resolve-basename";
import {
  fetchCheckInStatus,
  patchCheckInInWalletCache,
  readLocalCheckInToday,
  recordCheckInSuccess,
} from "@/lib/utils/check-in-status";
import { clearWalletCache } from "@/lib/utils/wallet-cache";
import { buildPendingWalletShell } from "@/lib/wallet/pending-shell";
import { mergeWalletMetricsMax } from "@/lib/wallet/merge-metrics";
import { applyPartialSyncPatch } from "@/lib/wallet/merge-partial-sync";
import { fetchMintedLevelsFromChain } from "@/lib/wallet/minted-badges";
import { createBasePublicClient, createPublicOnlyBaseClient, isRpcInfrastructureError, withRpcRetry } from "@/lib/utils/base-rpc";
import { applyBasenameScore } from "@/lib/wallet/apply-basename-score";
import { rollupWalletActivity } from "@/lib/utils/wallet-activity";
import type { AnalyzeWalletResult, ConnectionType, DayStats, WalletData } from "@/lib/types/wallet";
import {
  ACHIEVEMENTS_ABI,
  ACHIEVEMENTS_CONTRACT,
  BOOSTER_ABI,
  BOOSTER_CONTRACT,
  CHECKIN_ABI,
  CHECKIN_CONTRACT,
  GM_GN_ABI,
  GM_GN_CONTRACT,
} from "@/lib/constants/contracts";
import { getCatValue, sumMintedBadges } from "@/lib/utils/achievements";
import { getISOWeekNumber } from "@/lib/utils/dates";
import {
  getCalendarKeys,
  msUntilNextUtcDay,
} from "@/lib/utils/calendar-rollover";
import { computeChallengeScore, computeWalletRank } from "@/lib/utils/score";
import { getCapabilities } from "@/lib/utils/paymaster";
import { WEEKLY_QUESTS } from "@/lib/constants/season";
import {
  buildAppQuestContext,
  computeWeeklyXP,
  countDoneQuests,
} from "@/lib/utils/season";
import {
  readAppBadgeLevels,
  recordAppBadgeClaims,
  writeAppBadgeLevels,
} from "@/lib/utils/app-badge-levels";
import {
  getBadgeMintXpTotal,
  mergeMintedLevelsMax,
  readPersistedMintedLevels,
  recordBadgeMints,
  syncBadgeMintCountFromLevels,
  writePersistedMintedLevels,
} from "@/lib/utils/badge-mint-xp";
import {
  buildBadgeShareText,
  buildBadgesShareText,
  buildShareBody,
  buildShareCardData,
  buildSharePageUrl,
  buildScoreShareText,
  getReferralCode,
  twitterShare,
  warpcast,
} from "@/lib/utils/share";
import {
  buildB20Call,
  buildContractCall,
  buildExternalSwapCall,
  buildNativeTransferCall,
  encodeContractCall,
  normalizeTxHash,
} from "@/lib/utils/tx";
import {
  clearConnType,
  inferConnType,
  persistConnType,
  readConnType,
  resolveActiveConnType,
} from "@/lib/utils/wallet-connection";
import type { PremiumInsights } from "@/lib/premium/build-insights";
import type { X402ProductId } from "@/lib/constants/x402-products";
import {
  readStoredReferrer,
  registerReferralJoin,
  fetchReferralStats,
} from "@/lib/utils/referral";
import { loadLocalBatches } from "@/lib/utils/voucher";
import { lockX402PremiumSession, x402StorageKeys } from "@/lib/utils/x402-session";
import {
  readFarcasterUnlocked,
  writeFarcasterUnlocked,
  clearFarcasterUnlocked,
} from "@/lib/utils/farcaster-unlock";
import {
  bumpBoostCount,
  bumpWeeklyTxKey,
  currentWeekKey,
  DEFAULT_TX_KEYS,
  deriveTxKeysFromAnalysis,
  ensureSessionStorageVersion,
  mergeTxKeyCounters,
  readPersistedTxKeys,
  readReferralBonusXpForAddress,
  setReferralBonusXpForAddress,
  syncSessionFromAnalysis,
  writePersistedTxKeys,
} from "@/lib/utils/wallet-session";
import { recordCheckInPointsOnce,
  recordConfirmedInAppAction,
  recordInAppTransaction,
  syncActivityPointsFromSession,
  tryAwardSevenDayAllTasksBonus,
} from "@/lib/utils/daily-points";
import { BASE_RPC } from "@/lib/constants/env";
import {
  ERC20_ABI,
} from "@/lib/constants/contracts";
import { parseUnits, parseEther, formatUnits, maxUint256 } from "viem";
import type { LeaderboardEntry } from "@/lib/types/leaderboard";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";
import {
  extractB20TokenFromReceipt,
  isInvalidLaunchTokenAddress,
} from "@/lib/b20/launch-receipt";
import {
  encodeCreateB20Calldata,
  encodeB20ApproveCalldata,
  mergeMintAllocations,
  predictB20Address,
  type MintAllocation,
} from "@/lib/b20/encode";
import {
  encodeExactInputSingle,
  encodeExactInputSingleToEth,
  encodeWethWithdrawCalldata,
  SWAP_ROUTER_02,
  WETH_BASE,
} from "@/lib/launchpad/uniswap";
import { routerHasCode } from "@/lib/launchpad/router-guard";
import {
  encodeAerodromeBuy,
  encodeAerodromeSell,
  AERODROME_ROUTER,
} from "@/lib/launchpad/aerodrome";
import {
  encodeSlipstreamBuy,
  encodeSlipstreamSell,
} from "@/lib/launchpad/slipstream";
import { dexLabel } from "@/lib/launchpad/dex";
import type { LaunchDex } from "@/lib/launchpad/dex";
import {
  buildSeedLiquidityCalls,
  computeLiquiditySeedAmounts,
  seedDexLabel,
  type SeedDex,
} from "@/lib/launchpad/seed-liquidity";
import { USDC_BASE, USDC_DECIMALS, type SwapAsset } from "@/lib/launchpad/tokens-base";
import { registerLaunchedToken, fetchSwapQuote, fetchB20ActivationStatus } from "@/lib/api/launchpad-client";
import { sendAppTransaction, sendAppTransactions } from "@/lib/utils/send-app-tx";
import { preflightB20Launch, simulateB20Create } from "@/lib/b20/preflight";
import { LAUNCHPAD_TREASURY } from "@/lib/constants/launchpad";
import { splitGrossAmount } from "@/lib/launchpad/fees";
import { splitPlatformFee } from "@/lib/launchpad/fee-split";
import { fetchOnchainStake, tierToReferrerBoostBps } from "@/lib/wallet/onchain-stake";
import { encodeErc20TransferCalldata } from "@/lib/b20/encode";
import { fetchErc20Decimals } from "@/lib/launchpad/erc20-meta";
import { syncTabUrl, resolveTabFromUrl } from "@/lib/utils/app-url";
import {
  readGuestResume,
  clearGuestResume,
} from "@/lib/utils/guest-resume";

function pushFeeSplitCalls(
  calls: ReturnType<typeof buildContractCall>[],
  fee: bigint,
  opts: {
    native: boolean;
    token: `0x${string}`;
    creator?: `0x${string}` | null;
    referrer?: `0x${string}` | null;
    referrerBoostBps?: number;
    /** Skip fee transfers back to the payer (avoids a useless self-send popup). */
    payer?: `0x${string}`;
  }
) {
  if (fee <= BigInt(0)) return;

  const skipSelf = (to: string) =>
    Boolean(opts.payer && to.toLowerCase() === opts.payer.toLowerCase());

  if (!opts.creator) {
    if (opts.native) {
      if (!skipSelf(LAUNCHPAD_TREASURY)) {
        calls.push(buildNativeTransferCall(LAUNCHPAD_TREASURY, fee));
      }
    } else {
      calls.push(
        buildContractCall(opts.token, encodeErc20TransferCalldata(LAUNCHPAD_TREASURY, fee))
      );
    }
    return;
  }

  const split = splitPlatformFee(fee, {
    creator: opts.creator,
    referrer: opts.referrer ?? null,
    referrerBoostBps: opts.referrerBoostBps,
  });
  for (const t of split.transfers) {
    if (skipSelf(t.to)) continue;
    if (opts.native) {
      calls.push(buildNativeTransferCall(t.to, t.amount));
    } else {
      calls.push(buildContractCall(opts.token, encodeErc20TransferCalldata(t.to, t.amount)));
    }
  }
}

export type WalletAppState = ReturnType<typeof useWalletApp>;

export type AppTab =
  | "launchpad"
  | "dashboard"
  | "checkin"
  | "achievements"
  | "leaderboard"
  | "basehub"
  | "rewards";

function resolveInitialTab(): AppTab {
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/explore")) {
    return "launchpad";
  }
  const fromUrl = resolveTabFromUrl();
  if (fromUrl) return fromUrl;
  return "launchpad";
}

function analysisNeedsActivityRefresh(
  result: AnalyzeWalletResult & { historyComplete?: boolean }
): boolean {
  const w = result.wallet;
  if (!w?.address) return true;
  if (result.historyComplete !== true) return true;
  if (w.recommendation === "Fetching onchain data…") return true;
  if ((w.txCount ?? 0) > 0 && (w.recentTxs?.length ?? 0) === 0) return true;
  if (w.firstTx === "Syncing…" || w.lastTx === "Syncing…") return true;
  return false;
}

export function useWalletApp() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [connType, setConnType] = useState<ConnectionType | null>(() =>
    typeof window !== "undefined" ? readConnType() : null
  );
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<AppTab>("launchpad");
  const [minting, setMinting] = useState<string | null>(null);
  const [mintedLevels, setMintedLevels] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selDay, setSelDay] = useState<DayStats | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sharingRef = useRef(false);
  const pendingTx = useRef<Set<string>>(new Set());
  const connectingRef = useRef(false);
  const historySyncGen = useRef(0);
  const pendingChallengeRef = useRef<string | null>(null);
  const latestDaysRef = useRef(0);
  const x402Paying = useRef(false);
  const handledActionTxs = useRef<Set<string>>(new Set());
  const calendarRef = useRef(getCalendarKeys());
  const [boosts, setBoosts] = useState(0);
  const [miniAppIdentity, setMiniAppIdentity] = useState<MiniAppIdentity | null>(
    null
  );
  const [sponsored, setSponsored] = useState(0);
  const [txKeys, setTxKeys] = useState<Record<string, number>>({
    ...DEFAULT_TX_KEYS,
  });
  const [toast, setToast] = useState<{ msg: string; hash: string } | null>(
    null
  );
  const [streak, setStreak] = useState(0);
  const [checkedToday, setCheckedToday] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(true);
  const [challenge, setChallenge] = useState("");
  const [challengeResult, setChallengeResult] = useState<{
    address: string;
    score: number;
    rank: string;
    days: number;
    txs: number;
  } | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [refCopied, setRefCopied] = useState(false);
  const [weeklyXP, setWeeklyXP] = useState(0);
  const [pointsRevision, setPointsRevision] = useState(0);
  const [scanProgress, setScanProgress] = useState("");
  const [walletRefreshing, setWalletRefreshing] = useState(false);
  const [analyticsSyncing, setAnalyticsSyncing] = useState(false);
  const [walletCore, setWalletCore] = useState<{
    address: string;
    balance: string;
    usdcBalance?: string;
    portfolioValueUSD: number;
    basename: string | null;
  } | null>(null);
  const tabRef = useRef<AppTab>("launchpad");
  const balancesLockedRef = useRef<string | null>(null);
  const pendingHistorySyncRef = useRef<string | null>(null);
  const historyCompleteRef = useRef(false);
  const historySyncRunningRef = useRef(false);
  const walletOpGenRef = useRef(0);
  const syncCompleteToastRef = useRef(false);
  const startHistorySyncRef = useRef<((basename?: string | null) => void) | null>(null);
  const leaderboardSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [farcasterUnlocked, setFarcasterUnlocked] = useState(false);
  const [farcasterUnlockLoading, setFarcasterUnlockLoading] = useState(false);
  const [launchLoading, setLaunchLoading] = useState(false);
  const [swapLoading, setSwapLoading] = useState(false);
  const [b20Activated, setB20Activated] = useState<boolean | null>(null);
  const [premiumData, setPremiumData] = useState<{
    message: string;
    transaction?: string;
  } | null>(null);
  const [premiumInsights, setPremiumInsights] = useState<PremiumInsights | null>(null);
  const [x402Product, setX402Product] = useState<X402ProductId>("scan");
  const [referralBonusXp, setReferralBonusXp] = useState(0);
  const [referralInvites, setReferralInvites] = useState(0);
  const [x402PayCount, setX402PayCount] = useState(0);

  const boostCall = [encodeContractCall(BOOSTER_CONTRACT as `0x${string}`, BOOSTER_ABI, "boost")];
  const gmCall = [encodeContractCall(GM_GN_CONTRACT as `0x${string}`, GM_GN_ABI, "gm")];
  const gnCall = [encodeContractCall(GM_GN_CONTRACT as `0x${string}`, GM_GN_ABI, "gn")];
  const ciCall = [encodeContractCall(CHECKIN_CONTRACT as `0x${string}`, CHECKIN_ABI, "checkIn")];
  const txCaps = getCapabilities();

  const showToast = useCallback((msg: string, hash: string) => {
    setToast({ msg, hash });
    setTimeout(() => setToast(null), 6000);
  }, []);

  const loadX402PremiumState = useCallback((address: string) => {
    const keys = x402StorageKeys(address);
    const savedCount = parseInt(
      localStorage.getItem(keys.count) || "0",
      10
    );
    lockX402PremiumSession(address);
    setX402PayCount(savedCount);
    setPremiumUnlocked(false);
    setPremiumData(null);
    setPremiumInsights(null);
    setFarcasterUnlocked(readFarcasterUnlocked(address));
    setReferralBonusXp(readReferralBonusXpForAddress(address));
    void fetchReferralStats(address).then((s) => {
      const local = readReferralBonusXpForAddress(address);
      const bonus = Math.max(local, s.bonusXp);
      if (bonus > local) setReferralBonusXpForAddress(address, bonus);
      setReferralBonusXp(bonus);
      setReferralInvites(s.invites ?? 0);
    });
  }, []);

  useEffect(() => {
    let onPopState: (() => void) | undefined;

    if (typeof window !== "undefined") {
      if (sdk?.actions?.ready) {
        try {
          sdk.actions.ready();
        } catch (e) {
          console.error(e);
        }
      }
      setReady(true);
      setTab(resolveInitialTab());
      ensureSessionStorageVersion();
      const p = new URLSearchParams(window.location.search);
      const r = p.get("ref");
      if (r) localStorage.setItem("base_referrer", r);
      const card = p.get("card");
      if (card) localStorage.setItem("base_redeem_card", card);
      const challengeAddr = p.get("challenge")?.trim().toLowerCase();
      if (
        challengeAddr?.startsWith("0x") &&
        challengeAddr.length === 42
      ) {
        pendingChallengeRef.current = challengeAddr;
        setChallenge(challengeAddr);
        p.delete("challenge");
        const qs = p.toString();
        const nextUrl = qs
          ? `${window.location.pathname}?${qs}`
          : window.location.pathname;
        window.history.replaceState({}, "", nextUrl);
      }

      onPopState = () => {
        const next = resolveTabFromUrl();
        if (next) setTab(next);
      };
      window.addEventListener("popstate", onPopState);
    }
    fetchLeaderboard().then((d) => {
      setLeaderboard(d);
      setLbLoading(false);
    });
    return () => {
      if (onPopState) window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (wallet && tab === "dashboard" && scrollRef.current)
      setTimeout(() => {
        if (scrollRef.current)
          scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      }, 100);
  }, [wallet, tab]);

  useEffect(() => {
    if (!wallet?.address) {
      setMiniAppIdentity(null);
      return;
    }
    const cached = readPersistedMiniAppIdentity(wallet.address);
    if (cached) {
      setMiniAppIdentity(cached);
      return;
    }
    let alive = true;
    void resolveMiniAppIdentity().then((identity) => {
      if (!alive || !identity) return;
      persistMiniAppIdentity(wallet.address, identity);
      setMiniAppIdentity(identity);
    });
    return () => {
      alive = false;
    };
  }, [wallet?.address]);

  /** Refresh on-chain badge mint tiers only (Achievements tab — does not touch score). */
  useEffect(() => {
    if (!wallet || tab !== "achievements") return;
    let cancelled = false;
    void (async () => {
      try {
        const pub = createBasePublicClient();
        const chain = await fetchMintedLevelsFromChain(pub, wallet.address);
        if (cancelled) return;
        setMintedLevels((prev) => {
          const merged = mergeMintedLevelsMax(
            mergeMintedLevelsMax(prev, readPersistedMintedLevels(wallet.address)),
            chain
          );
          writePersistedMintedLevels(wallet.address, merged);
          syncBadgeMintCountFromLevels(wallet.address, merged);
          return merged;
        });
      } catch {
        /* RPC optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wallet?.address, tab]);

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    const onPoints = (e: Event) => {
      const detail = (e as CustomEvent<{ address?: string }>).detail;
      if (
        wallet?.address &&
        detail?.address?.toLowerCase() === wallet.address.toLowerCase()
      ) {
        setPointsRevision((n) => n + 1);
      }
    };
    window.addEventListener("base-points-updated", onPoints);
    return () => window.removeEventListener("base-points-updated", onPoints);
  }, [wallet?.address]);

  useEffect(() => {
    if (tab !== "dashboard" || !wallet?.address) return;
    if (historyCompleteRef.current || historySyncRunningRef.current) return;
    startHistorySyncRef.current?.(wallet.basename);
  }, [tab, wallet?.address, wallet?.basename]);

  useEffect(() => {
    if (!wallet) return;
    syncBadgeMintCountFromLevels(wallet.address, mintedLevels);
    const activitySynced = syncActivityPointsFromSession(
      wallet.address,
      txKeys,
      streak,
      checkedToday,
      x402PayCount,
      loadLocalBatches(wallet.address).length,
      Boolean(challengeResult)
    );
    if (activitySynced) setPointsRevision((n) => n + 1);
    const questCtx = buildAppQuestContext({
      wallet,
      streak,
      checkedToday,
      txKeys,
      x402PayCount,
      referralInvites,
      didChallenge: Boolean(challengeResult),
    });
    const questXp = computeWeeklyXP(questCtx, boosts);
    const badgeMintXp = getBadgeMintXpTotal(wallet.address);
    const xp = questXp + referralBonusXp;
    setWeeklyXP(xp);
    const mintedCount = sumMintedBadges(mintedLevels);
    if (leaderboardSaveRef.current) clearTimeout(leaderboardSaveRef.current);
    leaderboardSaveRef.current = setTimeout(() => {
      void saveLeaderboard({
        address: wallet.address,
        basename: wallet.basename,
        score: wallet.score,
        rank: wallet.walletRank,
        boosts,
        badges: mintedCount,
        weeklyXP: questXp,
        badgeMintXp,
        weekNumber: getISOWeekNumber(),
      }).then(() => fetchLeaderboard().then((d) => setLeaderboard(d)));
    }, 4000);
    return () => {
      if (leaderboardSaveRef.current) clearTimeout(leaderboardSaveRef.current);
    };
  }, [
    wallet?.address,
    wallet?.score,
    wallet?.walletRank,
    wallet?.basename,
    boosts,
    mintedLevels,
    streak,
    checkedToday,
    txKeys,
    referralBonusXp,
    referralInvites,
    x402PayCount,
    challengeResult,
    pointsRevision,
  ]);

  useEffect(() => {
    if (!wallet) return;
    const questCtx = buildAppQuestContext({
      wallet,
      streak,
      checkedToday,
      txKeys,
      x402PayCount,
      referralInvites,
      didChallenge: Boolean(challengeResult),
    });
    const done = countDoneQuests(questCtx);
    const awarded = tryAwardSevenDayAllTasksBonus(
      wallet.address,
      streak,
      done
    );
    if (awarded > 0) setPointsRevision((n) => n + 1);
  }, [
    wallet,
    streak,
    checkedToday,
    txKeys,
    x402PayCount,
    referralInvites,
    challengeResult,
  ]);

  const handlePremiumScan = async (product: X402ProductId = x402Product) => {
    if (!wallet || x402Paying.current) return;

    let activeConn = connType;
    if (!activeConn) {
      activeConn = await inferConnType(wallet.address);
      if (activeConn) {
        setConnType(activeConn);
        persistConnType(activeConn);
      }
    }
    if (!activeConn) {
      showToast("❌ Reconnect wallet to continue", "");
      return;
    }

    x402Paying.current = true;
    setPremiumLoading(true);
    try {
      const provider = await getEip1193Provider(activeConn);
      const { getX402Fetch } = await import("@/lib/x402-client");
      const x402Fetch = await getX402Fetch(provider);

      const res = await x402Fetch("/api/premium-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet.address, product }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          message: string;
          transaction?: string;
          insights?: PremiumInsights;
        };
        setPremiumData(data);
        setPremiumUnlocked(true);
        if (data.insights) {
          setPremiumInsights(data.insights);
        }
        const keys = x402StorageKeys(wallet.address);
        const prev = parseInt(
          localStorage.getItem(keys.count) || "0",
          10
        );
        const next = prev + 1;
        localStorage.setItem(keys.count, next.toString());
        setX402PayCount(next);
        const nextKeys = bumpWeeklyTxKey(wallet.address, "x402");
        setTxKeys((k) => ({ ...k, ...nextKeys }));
        recordConfirmedInAppAction(
          wallet.address,
          "x402",
          nextKeys.x402 ?? next
        );
        setPointsRevision((n) => n + 1);
        const txHash = data.transaction
          ? normalizeTxHash(data.transaction)
          : null;
        showToast(
          txHash
            ? `✅ x402 payment confirmed! Tx: ${txHash.slice(0, 10)}…`
            : "✅ x402 payment confirmed on Base!",
          txHash ?? ""
        );
      } else {
        let errMsg = `HTTP ${res.status}`;
        const text = await res.text().catch(() => "");
        try {
          const err = JSON.parse(text) as { error?: string; detail?: string };
          errMsg = [err.error, err.detail].filter(Boolean).join(": ") || errMsg;
        } catch {
          if (text && !text.startsWith("<!")) errMsg = text.slice(0, 120);
        }
        showToast(`❌ Payment failed: ${errMsg}`, "");
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message.split("\n")[0] : "Payment error";
      if (!msg.includes("rejected")) showToast(`❌ ${msg}`, "");
    } finally {
      x402Paying.current = false;
      setPremiumLoading(false);
    }
  };

  const handleFarcasterUnlock = async () => {
    if (!wallet || x402Paying.current) return;

    let activeConn = connType;
    if (!activeConn) {
      activeConn = await inferConnType(wallet.address);
      if (activeConn) {
        setConnType(activeConn);
        persistConnType(activeConn);
      }
    }
    if (!activeConn) {
      showToast("❌ Reconnect wallet to continue", "");
      return;
    }

    x402Paying.current = true;
    setFarcasterUnlockLoading(true);
    try {
      const provider = await getEip1193Provider(activeConn);
      const { getX402Fetch } = await import("@/lib/x402-client");
      const x402Fetch = await getX402Fetch(provider);

      const res = await x402Fetch("/api/farcaster-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet.address }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          message?: string;
          transaction?: string;
        };
        setFarcasterUnlocked(true);
        writeFarcasterUnlocked(wallet.address);
        const keys = x402StorageKeys(wallet.address);
        const prev = parseInt(localStorage.getItem(keys.count) || "0", 10);
        const next = prev + 1;
        localStorage.setItem(keys.count, next.toString());
        setX402PayCount(next);
        const nextKeys = bumpWeeklyTxKey(wallet.address, "x402");
        setTxKeys((k) => ({ ...k, ...nextKeys }));
        recordConfirmedInAppAction(
          wallet.address,
          "x402",
          nextKeys.x402 ?? next
        );
        setPointsRevision((n) => n + 1);
        const txHash = data.transaction
          ? normalizeTxHash(data.transaction)
          : null;
        showToast(
          txHash
            ? `✅ Farcaster unlocked! Tx: ${txHash.slice(0, 10)}…`
            : "✅ Farcaster analysis unlocked!",
          txHash ?? ""
        );
      } else {
        let errMsg = `HTTP ${res.status}`;
        const text = await res.text().catch(() => "");
        try {
          const err = JSON.parse(text) as { error?: string; detail?: string };
          errMsg = [err.error, err.detail].filter(Boolean).join(": ") || errMsg;
        } catch {
          if (text && !text.startsWith("<!")) errMsg = text.slice(0, 120);
        }
        if (res.status === 404) {
          errMsg = "Payment service unavailable — refresh the page and try again";
        }
        showToast(`❌ Payment failed: ${errMsg}`, "");
      }
    } catch (e) {
      const msg =
        e instanceof Error ? e.message.split("\n")[0] : "Payment error";
      if (!msg.includes("rejected")) showToast(`❌ ${msg}`, "");
    } finally {
      x402Paying.current = false;
      setFarcasterUnlockLoading(false);
    }
  };

  useEffect(() => {
    void fetchB20ActivationStatus().then(setB20Activated);
  }, []);

  const handleLaunchB20 = useCallback(
    async (args: {
      name: string;
      symbol: string;
      decimals: number;
      supplyCap: string;
      salt: `0x${string}`;
      imageUrl?: string;
      description?: string;
      website?: string;
      twitter?: string;
      telegram?: string;
      discord?: string;
      metadataEditable?: boolean;
      /** Vanity grind preview — fallback if RPC address prediction fails */
      predictedAddress?: string;
      mints: MintAllocation[];
      poolSeedPct?: number;
      quoteToken?: string;
      startPriceUsd?: string;
      launchPreset?: string;
      vestingSchedule?: Array<{
        address: string;
        pct: number;
        cliffMonths: number;
        vestMonths: number;
      }>;
      antiSnipeBlocks?: number;
      seedLiquidityEth?: string;
      autoSeedLiquidity?: boolean;
      seedDex?: SeedDex;
      ethUsd?: number;
    }): Promise<{
      ok: boolean;
      address?: string;
      symbol?: string;
      name?: string;
      imageUrl?: string;
      txHash?: string;
    }> => {
      if (!wallet) return { ok: false };

      setLaunchLoading(true);
      try {
        const activated = await fetchB20ActivationStatus();
        setB20Activated(activated);
        if (!activated) {
          showToast("B20 is not activated on Base mainnet yet", "");
          return { ok: false };
        }

        const activeConn = await resolveActiveConnType(connType, wallet.address);
        if (activeConn && activeConn !== connType) {
          setConnType(activeConn);
          persistConnType(activeConn);
        }
        if (!activeConn) {
          showToast("❌ Reconnect wallet to launch", "");
          return { ok: false };
        }

        const creator = wallet.address as `0x${string}`;

        let seedEthWei = BigInt(0);
        if (
          args.autoSeedLiquidity !== false &&
          args.seedLiquidityEth &&
          args.startPriceUsd
        ) {
          try {
            seedEthWei = parseEther(args.seedLiquidityEth);
          } catch {
            seedEthWei = BigInt(0);
          }
        }

        const preflight = await preflightB20Launch(creator, { seedEthWei });
        if (!preflight.hasMinGas) {
          const bal = Number(preflight.balanceEth);
          showToast(
            `Need ≥${preflight.minEth} ETH on Base (gas${seedEthWei > BigInt(0) ? " + liquidity seed" : ""}). Balance: ${bal.toFixed(6)} ETH`,
            ""
          );
          return { ok: false };
        }

        const supplyCap = parseUnits(args.supplyCap, args.decimals);
        const mergedMints = mergeMintAllocations(args.mints);
        const mintTotal = mergedMints.reduce((s, m) => s + m.amount, BigInt(0));
        if (mintTotal > supplyCap) {
          showToast("Allocations exceed fixed 1B supply", "");
          return { ok: false };
        }

        const salt = args.salt;

        let tokenAddr: `0x${string}` =
          (await predictB20Address(creator, salt)) ??
          (args.predictedAddress?.startsWith("0x")
            ? (args.predictedAddress as `0x${string}`)
            : (`0xB2000000000000000000000000000000000000` as `0x${string}`));

        const createData = encodeCreateB20Calldata({
          name: args.name,
          symbol: args.symbol,
          creator,
          decimals: args.decimals,
          supplyCap,
          salt,
          adminless: true,
          metadataEditable: args.metadataEditable,
          description: args.description,
          website: args.website,
          twitter: args.twitter,
          telegram: args.telegram,
          mints: mergedMints,
        });

        const createCall = buildB20Call(B20_FACTORY_ADDRESS, createData);

        const simulation = await simulateB20Create(creator, createData);
        if (!simulation.ok) {
          showToast(simulation.reason, "");
          return { ok: false };
        }

        const hash = await sendAppTransactions(activeConn, wallet.address, [createCall], {
          skipBuilderCompanion: true,
        });

        let launchBlock: number | undefined;
        let receipt: import("viem").TransactionReceipt | null = null;
        try {
          const pub = createPublicOnlyBaseClient();
          receipt = await withRpcRetry(() =>
            pub.getTransactionReceipt({ hash: hash as `0x${string}` })
          );
          if (!receipt || receipt.status !== "success") {
            throw new Error(
              "Token launch reverted — check allocations and retry with a new salt"
            );
          }
          launchBlock = Number(receipt.blockNumber);
          const fromEvent = extractB20TokenFromReceipt(receipt);
          if (fromEvent) {
            tokenAddr = fromEvent;
          } else if (isInvalidLaunchTokenAddress(tokenAddr)) {
            const retryPredict = await predictB20Address(creator, salt);
            if (retryPredict && !isInvalidLaunchTokenAddress(retryPredict)) {
              tokenAddr = retryPredict;
            }
          }
        } catch (receiptErr) {
          if (isRpcInfrastructureError(receiptErr)) {
            console.warn("[launch] receipt fetch skipped (RPC error)", receiptErr);
            // Tx hash is valid — register token; block will backfill from explorer later.
          } else {
            const msg =
              receiptErr instanceof Error ? receiptErr.message : "Launch not confirmed on Base";
            throw new Error(msg);
          }
        }

        const saved = await registerLaunchedToken({
          address: tokenAddr,
          name: args.name,
          symbol: args.symbol,
          decimals: args.decimals,
          creator: wallet.address,
          txHash: hash,
          imageUrl: args.imageUrl,
          description: args.description,
          website: args.website,
          twitter: args.twitter,
          telegram: args.telegram,
          discord: args.discord,
          supplyCap: args.supplyCap,
          launchPreset: args.launchPreset,
          vestingSchedule: args.vestingSchedule,
          launchBlock,
          antiSnipeBlocks: args.antiSnipeBlocks ?? 8,
          startPriceUsd: args.startPriceUsd,
          source: "launched",
        });
        if (!saved) {
          showToast(
            "Token is live on Base — app catalog save failed; paste your address to trade",
            hash
          );
        }

        if (
          args.autoSeedLiquidity !== false &&
          args.seedLiquidityEth &&
          args.startPriceUsd
        ) {
          const seed = computeLiquiditySeedAmounts({
            seedEth: args.seedLiquidityEth,
            startPriceUsd: args.startPriceUsd,
            ethUsd: args.ethUsd ?? 2500,
            decimals: args.decimals,
          });
          if (seed) {
            try {
              const seedCalls = buildSeedLiquidityCalls({
                token: tokenAddr,
                creator,
                tokenAmount: seed.tokenWei,
                ethAmount: seed.ethWei,
                dex: args.seedDex ?? "aerodrome",
              });
              await sendAppTransactions(activeConn, wallet.address, seedCalls);
              showToast(
                `💧 Liquidity seeded on ${seedDexLabel(args.seedDex ?? "aerodrome")} — ${args.symbol} is tradable in-app`,
                ""
              );
            } catch (seedErr) {
              const seedMsg =
                seedErr instanceof Error ? seedErr.message.split("\n")[0] : "LP seed failed";
              showToast(
                `Token live — add liquidity manually to enable swaps (${seedMsg}). If approve failed first, retry seed from the token page.`,
                ""
              );
            }
          }
        }

        const nextKeys = bumpWeeklyTxKey(wallet.address, "launch");
        setTxKeys((k) => ({ ...k, ...nextKeys }));
        const { credited, hitCap } = recordConfirmedInAppAction(
          wallet.address,
          "launch",
          nextKeys.launch ?? 0
        );
        setPointsRevision((n) => n + 1);
        if (hitCap && credited === 0) {
          showToast(`${args.symbol} launched — daily point cap reached`, hash);
        } else if (credited > 0) {
          showToast(`🚀 ${args.symbol} launched · +${credited} pts`, hash);
        } else {
          showToast(`🚀 ${args.symbol} launched on Base`, hash);
        }
        return {
          ok: true,
          address: tokenAddr,
          symbol: args.symbol,
          name: args.name,
          imageUrl: args.imageUrl,
          txHash: hash,
        };
      } catch (e) {
        const msg =
          e instanceof Error ? e.message.split("\n")[0] : "Launch failed";
        const friendly =
          isRpcInfrastructureError(e) ||
          /rpc request failed|fetch failed|429|capacity|rate limit/i.test(msg)
            ? "Base RPC is busy — if you approved the tx, check BaseScan in 30s or retry"
            : msg.includes("Number") || msg.includes("underflow") || msg.includes("overflow")
            ? "Invalid supply or mint amount"
            : msg.includes("TokenAlreadyExists")
              ? "Token already exists — change name/symbol and retry"
              : msg.includes("FeatureNotActivated")
                ? "B20 is not activated on Base mainnet yet"
                : msg.includes("not confirmed") || msg.includes("not broadcast")
                  ? "Launch not confirmed — approve the tx in your wallet, keep the tab open, ensure ≥0.0001 ETH on Base, and retry with a new salt"
                  : msg;
        if (!friendly.toLowerCase().includes("reject")) {
          showToast(`❌ ${friendly}`, "");
        }
        return { ok: false };
      } finally {
        setLaunchLoading(false);
      }
    },
    [connType, showToast, wallet]
  );

  const handleTokenSwap = useCallback(
    async (args: {
      token: string;
      symbol: string;
      decimals: number;
      direction: "buy" | "sell";
      amount: string;
      slippageBps: number;
      dex?: LaunchDex;
      referrer?: string | null;
      payAsset?: SwapAsset;
      receiveAsset?: SwapAsset;
      payToken?: string | null;
      receiveToken?: string | null;
      counterDecimals?: number;
    }): Promise<boolean> => {
      if (!wallet) return false;

      const payAsset = args.payAsset ?? "eth";
      const receiveAsset = args.receiveAsset ?? "eth";
      const payDecimals =
        payAsset === "usdc"
          ? USDC_DECIMALS
          : payAsset === "token"
            ? (args.counterDecimals ?? 18)
            : 18;

      setSwapLoading(true);
      try {
        const tokenAddr = args.token as `0x${string}`;
        const tokenDecimals =
          args.direction === "sell" || payAsset === "token"
            ? await fetchErc20Decimals(tokenAddr, args.decimals)
            : args.decimals;

        const quote = await fetchSwapQuote({
          token: args.token,
          direction: args.direction,
          amount: args.amount,
          decimals: tokenDecimals,
          slippageBps: args.slippageBps,
          dex: args.dex ?? "auto",
          referrer: args.referrer ?? null,
          taker: wallet.address,
          payAsset,
          receiveAsset,
          payToken: args.payToken,
          receiveToken: args.receiveToken,
          counterDecimals: args.counterDecimals,
        });

        if (!quote.hasLiquidity) {
          showToast(
            quote.error ||
              quote.antiSnipe?.message ||
              "No swap route found — trade on Aerodrome or add a WETH pool",
            ""
          );
          return false;
        }

        const activeConn = await resolveActiveConnType(connType, wallet.address);
        if (activeConn && activeConn !== connType) {
          setConnType(activeConn);
          persistConnType(activeConn);
        }
        if (!activeConn) {
          showToast("❌ Reconnect wallet to swap", "");
          return false;
        }

        const token = args.token as `0x${string}`;
        const recipient = wallet.address as `0x${string}`;
        const swapDex = quote.dex ?? "uniswap";
        const isAggregator = swapDex === "aggregator";
        const router = (quote.router ??
          (swapDex === "aerodrome" ? AERODROME_ROUTER : SWAP_ROUTER_02)) as `0x${string}`;
        const weth = WETH_BASE as `0x${string}`;
        const minOut = BigInt(quote.amountOutMinimum);
        const uniFee = quote.uniswapFeeTier ?? 3000;
        const aeroStable = quote.aerodromeStable ?? false;
        const aeroHops = quote.aerodromeHops?.map((h) => ({
          from: h.from as `0x${string}`,
          to: h.to as `0x${string}`,
          stable: h.stable,
        }));
        const slipTick = quote.slipstreamTickSpacing ?? 200;
        const creator = quote.creator as `0x${string}` | undefined;
        const referrer = (quote.referrer || args.referrer) as `0x${string}` | null;

        if (isAggregator && (!quote.tx?.to || !quote.tx.data)) {
          showToast("Aggregator route unavailable — try again", "");
          return false;
        }

        if (!(await routerHasCode(router))) {
          showToast("❌ Router unavailable on Base — try another route", "");
          return false;
        }

        let referrerBoostBps = 0;
        if (referrer) {
          const stake = await fetchOnchainStake(referrer);
          if (stake && Date.now() < stake.unlockAt) {
            referrerBoostBps = tierToReferrerBoostBps(stake.tier);
          }
        }
        const calls = [];

        if (args.direction === "buy") {
          const gross = parseUnits(args.amount, payDecimals);
          const { net, fee } = splitGrossAmount(gross);
          if (net <= BigInt(0)) {
            showToast("Amount too small after platform fee", "");
            return false;
          }
          const payIsNative = payAsset === "eth";
          const payTokenAddr = (
            payAsset === "usdc"
              ? USDC_BASE
              : payAsset === "token" && args.payToken
                ? args.payToken
                : token
          ) as `0x${string}`;
          const spender = (
            isAggregator ? quote.allowanceSpender ?? quote.tx?.to : router
          ) as `0x${string}` | undefined;

          if (!payIsNative && BASE_RPC && spender) {
            const pub = createBasePublicClient();
            const allowance = await pub.readContract({
              address: payTokenAddr,
              abi: ERC20_ABI,
              functionName: "allowance",
              args: [recipient, spender],
            });
            if (allowance < gross) {
              calls.push(
                buildContractCall(
                  payTokenAddr,
                  encodeB20ApproveCalldata(spender, maxUint256)
                )
              );
            }
          }

          if (!payIsNative) {
            pushFeeSplitCalls(calls, fee, {
              native: false,
              token: payTokenAddr,
              creator,
              referrer,
              referrerBoostBps,
              payer: recipient,
            });
          }

          if (payIsNative) {
            pushFeeSplitCalls(calls, fee, {
              native: true,
              token,
              creator,
              referrer,
              referrerBoostBps,
              payer: recipient,
            });
          }

          if (isAggregator && quote.tx) {
            calls.push(
              buildExternalSwapCall(
                quote.tx.to as `0x${string}`,
                quote.tx.data as `0x${string}`,
                BigInt(quote.tx.value || "0")
              )
            );
          } else if (!isAggregator) {
            const swapData =
              swapDex === "aerodrome"
                ? encodeAerodromeBuy({
                    tokenOut: token,
                    recipient,
                    amountOutMinimum: minOut,
                    stable: aeroStable,
                    hops: aeroHops,
                  })
                : swapDex === "slipstream"
                  ? encodeSlipstreamBuy({
                      tokenOut: token,
                      recipient,
                      amountIn: net,
                      amountOutMinimum: minOut,
                      tickSpacing: slipTick,
                    })
                  : encodeExactInputSingle({
                      tokenIn: weth,
                      tokenOut: token,
                      recipient,
                      amountIn: net,
                      amountOutMinimum: minOut,
                      fee: uniFee,
                    });
            calls.push(buildContractCall(router, swapData, net));
          }
        } else {
          const gross = parseUnits(args.amount, tokenDecimals);
          const { net, fee } = splitGrossAmount(gross);
          if (net <= BigInt(0)) {
            showToast("Amount too small after platform fee", "");
            return false;
          }
          // The aggregator signs calldata for `net` server-side, so its input is
          // fixed. Direct DEX routes sell the whole balance and pay the platform
          // fee out of the ETH proceeds instead, so a MAX sell leaves no dust.
          const sellAmount = isAggregator ? net : gross;
          const spender = (
            isAggregator ? quote.allowanceSpender ?? quote.tx?.to : router
          ) as `0x${string}` | undefined;
          if (BASE_RPC && spender) {
            const pub = createBasePublicClient();
            const allowance = await pub.readContract({
              address: token,
              abi: ERC20_ABI,
              functionName: "allowance",
              args: [recipient, spender],
            });
            if (allowance < sellAmount) {
              calls.push(
                buildContractCall(
                  token,
                  encodeB20ApproveCalldata(spender, maxUint256)
                )
              );
            }
          }
          if (isAggregator && quote.tx) {
            calls.push(
              buildExternalSwapCall(
                quote.tx.to as `0x${string}`,
                quote.tx.data as `0x${string}`,
                BigInt(quote.tx.value || "0")
              )
            );
          } else {
            const swapData =
              swapDex === "aerodrome"
                ? encodeAerodromeSell({
                    tokenIn: token,
                    recipient,
                    amountIn: sellAmount,
                    amountOutMinimum: minOut,
                    stable: aeroStable,
                    hops: aeroHops,
                  })
                : swapDex === "slipstream"
                  ? encodeSlipstreamSell({
                      tokenIn: token,
                      recipient,
                      amountIn: sellAmount,
                      amountOutMinimum: minOut,
                      tickSpacing: slipTick,
                    })
                  : encodeExactInputSingleToEth({
                      tokenIn: token,
                      recipient,
                      amountIn: sellAmount,
                      amountOutMinimum: minOut,
                      fee: uniFee,
                    });
            calls.push(buildContractCall(router, swapData));
          }

          const amountOut = BigInt(quote.amountOut ?? 0);
          const feeEth =
            net > BigInt(0) && amountOut > BigInt(0)
              ? (amountOut * fee) / net
              : BigInt(0);
          pushFeeSplitCalls(calls, feeEth, {
            native: true,
            token,
            creator,
            referrer,
            referrerBoostBps,
            payer: recipient,
          });
        }

        const hash = await sendAppTransactions(activeConn, wallet.address, calls, {
          atomicBatch: true,
        });
        setSponsored((s) => s + 1);

        const nextKeys = bumpWeeklyTxKey(wallet.address, "swap");
        setTxKeys((k) => ({ ...k, ...nextKeys }));
        const { credited, hitCap } = recordConfirmedInAppAction(
          wallet.address,
          "swap",
          nextKeys.swap ?? 0
        );
        setPointsRevision((n) => n + 1);
        const label = args.direction === "buy" ? "Buy" : "Sell";
        const via = dexLabel(swapDex);
        if (hitCap && credited === 0) {
          showToast(`${label} ${args.symbol} via ${via} — daily point cap reached`, hash);
        } else if (credited > 0) {
          showToast(`${label} ${args.symbol} via ${via} · +${credited} pts`, hash);
        } else {
          showToast(`✅ ${label} ${args.symbol} via ${via}`, hash);
        }
        return true;
      } catch (e) {
        const msg =
          e instanceof Error ? e.message.split("\n")[0] : "Swap failed";
        if (!msg.toLowerCase().includes("reject")) {
          showToast(`❌ ${msg}`, "");
        }
        return false;
      } finally {
        setSwapLoading(false);
      }
    },
    [connType, showToast, wallet]
  );

  const handleSeedLiquidity = useCallback(
    async (args: {
      token: string;
      symbol: string;
      decimals: number;
      tokenAmount: string;
      seedEth: string;
      startPriceUsd?: string;
      seedDex?: SeedDex;
    }): Promise<boolean> => {
      if (!wallet) return false;

      setSwapLoading(true);
      try {
        const activeConn = await resolveActiveConnType(connType, wallet.address);
        if (activeConn && activeConn !== connType) {
          setConnType(activeConn);
          persistConnType(activeConn);
        }
        if (!activeConn) {
          showToast("❌ Reconnect wallet to seed liquidity", "");
          return false;
        }

        const token = args.token as `0x${string}`;
        const creator = wallet.address as `0x${string}`;
        let tokenWei = parseUnits(args.tokenAmount, args.decimals);
        let ethWei = parseEther(args.seedEth);

        if (args.startPriceUsd) {
          const computed = computeLiquiditySeedAmounts({
            seedEth: args.seedEth,
            startPriceUsd: args.startPriceUsd,
            ethUsd: 2500,
            decimals: args.decimals,
          });
          if (computed) {
            tokenWei = computed.tokenWei;
            ethWei = computed.ethWei;
          }
        }

        if (tokenWei <= BigInt(0) || ethWei <= BigInt(0)) {
          showToast("Invalid liquidity amounts", "");
          return false;
        }

        const calls = buildSeedLiquidityCalls({
          token,
          creator,
          tokenAmount: tokenWei,
          ethAmount: ethWei,
          dex: args.seedDex ?? "aerodrome",
        });
        const hash = await sendAppTransactions(activeConn, wallet.address, calls, {
          atomicBatch: true,
        });
        recordInAppTransaction(wallet.address);
        setPointsRevision((n) => n + 1);
        showToast(`💧 ${args.symbol} pool seeded on ${seedDexLabel(args.seedDex ?? "aerodrome")}`, hash);
        return true;
      } catch (e) {
        const msg = e instanceof Error ? e.message.split("\n")[0] : "Seed failed";
        if (!msg.toLowerCase().includes("reject")) {
          showToast(`❌ ${msg}`, "");
        }
        return false;
      } finally {
        setSwapLoading(false);
      }
    },
    [connType, showToast, wallet]
  );

  /** Withdraw the wallet's full WETH balance back to native ETH. */
  const handleUnwrapWeth = useCallback(async (): Promise<boolean> => {
    if (!wallet) return false;

    setSwapLoading(true);
    try {
      const activeConn = await resolveActiveConnType(connType, wallet.address);
      if (activeConn && activeConn !== connType) {
        setConnType(activeConn);
        persistConnType(activeConn);
      }
      if (!activeConn) {
        showToast("❌ Reconnect wallet to unwrap", "");
        return false;
      }

      const pub = createBasePublicClient();
      const balance = await pub.readContract({
        address: WETH_BASE,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [wallet.address as `0x${string}`],
      });
      if (balance <= BigInt(0)) {
        showToast("No WETH to unwrap", "");
        return false;
      }

      const hash = await sendAppTransactions(
        activeConn,
        wallet.address,
        [buildContractCall(WETH_BASE, encodeWethWithdrawCalldata(balance))],
        { atomicBatch: true }
      );
      showToast(`✅ Unwrapped ${formatUnits(balance, 18)} WETH to ETH`, hash);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message.split("\n")[0] : "Unwrap failed";
      if (!msg.toLowerCase().includes("reject")) {
        showToast(`❌ ${msg}`, "");
      }
      return false;
    } finally {
      setSwapLoading(false);
    }
  }, [connType, showToast, wallet]);

  const handleChallenge = useCallback(async () => {
    const addr = challenge.trim().toLowerCase();
    if (!addr || !addr.startsWith("0x") || addr.length !== 42) {
      showToast("❌ Invalid address", "");
      return;
    }
    setChallengeLoading(true);
    try {
      const merged = await fetchWalletTransfers(addr);
      const activity = rollupWalletActivity(merged, addr);
      const txCount = activity.participatingHashes.size;
      const days = activity.uDays;
      const months = activity.uMonths;
      const weeks = activity.uWeeks;
      const s = computeChallengeScore(
        txCount,
        days.size,
        months.size,
        weeks.size
      );
      const rank = computeWalletRank(s);
      setChallengeResult({
        address: addr,
        score: s,
        rank,
        days: days.size,
        txs: txCount,
      });
      if (wallet) {
        setTxKeys((k) => {
          const next = { ...k, challenge: 1 };
          writePersistedTxKeys(wallet.address, next);
          return next;
        });
        recordConfirmedInAppAction(wallet.address, "challenge", 1);
        setPointsRevision((n) => n + 1);
      }
    } catch {
      showToast("❌ Lookup failed", "");
    } finally {
      setChallengeLoading(false);
    }
  }, [challenge, showToast, wallet]);

  useEffect(() => {
    const addr = pendingChallengeRef.current;
    if (!addr) return;
    pendingChallengeRef.current = null;
    if (challengeResult?.address === addr) return;
    setChallenge(addr);
    void handleChallenge();
  }, [wallet?.address, challengeResult, handleChallenge]);

  const applyAnalysis = useCallback((result: AnalyzeWalletResult) => {
    const address = result.wallet.address;
    const session =
      typeof window !== "undefined"
        ? syncSessionFromAnalysis(address, result)
        : {
            boosts: result.boosts,
            checkInCount: result.wallet.checkInCount,
            txKeys: deriveTxKeysFromAnalysis(result),
          };
    setStreak(result.streak);
    setCheckedToday(
      result.checkedToday || readLocalCheckInToday(address)
    );
    setBoosts((prev) => Math.max(prev, session.boosts));
    setWallet((prev) => {
      const base: WalletData = {
        ...result.wallet,
        basename: result.wallet.basename || prev?.basename || null,
        checkInCount: Math.max(
          prev?.checkInCount ?? 0,
          session.checkInCount
        ),
      };
      if (!prev || prev.address.toLowerCase() !== base.address.toLowerCase()) {
        return base;
      }
      return mergeWalletMetricsMax(prev, base);
    });
    setReferralBonusXp(readReferralBonusXpForAddress(address));
    const week = currentWeekKey();
    const weekChanged = calendarRef.current.week !== week;
    calendarRef.current = getCalendarKeys();
    setTxKeys((prev) =>
      weekChanged
        ? session.txKeys
        : mergeTxKeyCounters(session.txKeys, prev)
    );
    void fetchReferralStats(address);
    if (typeof window !== "undefined") {
      localStorage.setItem("base_has_connected", "1");
    }
  }, []);

  const syncCheckInStatus = useCallback(async (address: string) => {
    const status = await fetchCheckInStatus(address);
    setCheckedToday(status.checkedToday);
    setStreak(status.streak);
    patchCheckInInWalletCache(address, status.checkedToday, status.streak);
    return status;
  }, []);

  /** Refresh daily check-in state and weekly quest counters at UTC day/week boundaries. */
  useEffect(() => {
    if (!wallet) return;

    const applyRollover = (next: ReturnType<typeof getCalendarKeys>) => {
      const prev = calendarRef.current;
      if (next.day === prev.day && next.week === prev.week) return;

      calendarRef.current = next;

      if (next.day !== prev.day) {
        setCheckedToday(readLocalCheckInToday(wallet.address));
        void syncCheckInStatus(wallet.address);
      }

      if (next.week !== prev.week) {
        setTxKeys(readPersistedTxKeys(wallet.address));
        setChallengeResult(null);
      }

      setPointsRevision((n) => n + 1);
    };

    const tick = () => applyRollover(getCalendarKeys());

    let midnightTimer: number | undefined;
    const scheduleMidnight = () => {
      midnightTimer = window.setTimeout(() => {
        tick();
        scheduleMidnight();
      }, msUntilNextUtcDay());
    };
    scheduleMidnight();
    const intervalId = window.setInterval(tick, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (midnightTimer !== undefined) window.clearTimeout(midnightTimer);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [wallet, syncCheckInStatus]);

  const handleCheckInSuccess = useCallback(
    async (address: string, txHash?: string) => {
      if (txHash) {
        const h = (normalizeTxHash(txHash) ?? txHash).toLowerCase();
        const key = `checkin:${h}`;
        if (handledActionTxs.current.has(key)) return;
        handledActionTxs.current.add(key);
      }
      const floor =
        wallet?.address.toLowerCase() === address.toLowerCase()
          ? wallet.checkInCount
          : 0;
      const count = recordCheckInSuccess(address, floor);
      setCheckedToday(true);
      setTxKeys((k) => {
        const next = { ...k, checkin: (k.checkin || 0) + 1 };
        writePersistedTxKeys(address, next);
        return next;
      });
      setWallet((current) => {
      if (!current || current.address.toLowerCase() !== address.toLowerCase()) {
        return current;
      }
      return {
        ...current,
        checkInCount: Math.max(current.checkInCount, count),
      };
    });
      const status = await syncCheckInStatus(address);
      patchCheckInInWalletCache(
        address,
        status.checkedToday,
        status.streak,
        true
      );
      recordInAppTransaction(address);
      const { credited } = recordCheckInPointsOnce(address);
      setPointsRevision((n) => n + 1);
      if (txHash) {
        if (credited > 0) {
          showToast(`✅ Check-in secured! +${credited} weekly streak PP`, txHash);
        } else {
          showToast("✅ Onchain check-in secured!", txHash);
        }
      }
    },
    [showToast, syncCheckInStatus, wallet]
  );

  const handleBoostSuccess = useCallback(
    (address: string, txHash?: string) => {
      if (txHash) {
        const h = (normalizeTxHash(txHash) ?? txHash).toLowerCase();
        const key = `boost:${h}`;
        if (handledActionTxs.current.has(key)) return;
        handledActionTxs.current.add(key);
      }
      setBoosts((current) => bumpBoostCount(address, current));
      const nextKeys = bumpWeeklyTxKey(address, "boost");
      setTxKeys((k) => ({ ...k, ...nextKeys }));
      const { credited, hitCap } = recordConfirmedInAppAction(
        address,
        "boost",
        nextKeys.boost ?? 0
      );
      setPointsRevision((n) => n + 1);
      if (txHash) {
        if (hitCap && credited === 0) {
          showToast("Boost recorded — daily point cap reached", txHash);
        } else if (credited > 0) {
          showToast(`Boosted! +${credited} pts 🎉`, txHash);
        } else {
          showToast("Boosted! 🎉", txHash);
        }
      }
    },
    [showToast]
  );

  const lockWalletCore = useCallback((w: WalletData) => {
    balancesLockedRef.current = w.address.toLowerCase();
    setWalletCore({
      address: w.address,
      balance: w.balance,
      usdcBalance: w.usdcBalance,
      portfolioValueUSD: w.portfolioValueUSD,
      basename: w.basename,
    });
    setWalletRefreshing(false);
    setScanProgress("");
  }, []);

  const analyzeWallet = useCallback(
    async (address: string, opts?: { background?: boolean }) => {
      const background = opts?.background === true;
      const opGen = walletOpGenRef.current;
      const stale = () => walletOpGenRef.current !== opGen;
      if (
        !address ||
        !address.startsWith("0x") ||
        address.length !== 42
      ) {
        showToast("❌ Invalid EVM Address", "");
        setLoading(false);
        return;
      }
      loadX402PremiumState(address);

      let referralRegistered = false;
      const registerReferralOnce = () => {
        if (referralRegistered) return;
        referralRegistered = true;
        const ref = readStoredReferrer();
        void registerReferralJoin(address, ref).then((r) => {
          if (r.bonusXp > 0) {
            setReferralBonusXpForAddress(address, r.bonusXp);
            setReferralBonusXp(r.bonusXp);
            showToast(`🎉 +${r.bonusXp} referral XP!`, "");
          }
        });
      };

      let bgSyncStarted = false;

      const mergeAndApply = (
        result: AnalyzeWalletResult,
        ci: { checkedToday: boolean; streak: number },
        priorBasename?: string | null
      ) => {
        const basename =
          result.wallet.basename || priorBasename || null;
        applyAnalysis({
          ...result,
          wallet: { ...result.wallet, basename },
          checkedToday:
            ci.checkedToday ||
            result.checkedToday ||
            readLocalCheckInToday(address),
          streak: ci.streak || result.streak,
        });
        latestDaysRef.current = result.wallet.uniqueDays;
        registerReferralOnce();

        if (!basename) {
          void resolveBasenameClient(address).then((name) => {
            if (!name) return;
            setWallet((prev) => {
              if (prev?.address.toLowerCase() !== address.toLowerCase()) {
                return prev;
              }
              return applyBasenameScore(prev, name);
            });
          });
        }

        return result;
      };

      const startBackgroundHistorySync = (priorBasename?: string | null) => {
        if (historySyncRunningRef.current) return;
        bgSyncStarted = true;
        historySyncRunningRef.current = true;
        const gen = ++historySyncGen.current;
        setAnalyticsSyncing(true);

        const runSync = () => {
          if (historySyncGen.current !== gen || stale()) return;
          void pollWalletHistorySync(
          address,
          {
          reset: false,
          onProgress: (msg) => {
            if (tabRef.current === "dashboard") setScanProgress(msg);
          },
          shouldCancel: () => historySyncGen.current !== gen,
          onUpdate: (syncResult: AnalyzeWalletResult & {
            historyComplete?: boolean;
            partial?: boolean;
            wallet?: Partial<AnalyzeWalletResult["wallet"]>;
          }) => {
            if (historySyncGen.current !== gen) return;
            if (syncResult.partial && syncResult.wallet) {
              const p = syncResult.wallet;
              const nextDays = Math.max(latestDaysRef.current, p.uniqueDays ?? 0);
              if (tabRef.current === "dashboard") {
                setScanProgress(`Syncing full history… ${nextDays} active days`);
              }
              setWallet((prev) =>
                prev?.address.toLowerCase() === address.toLowerCase()
                  ? applyPartialSyncPatch(prev, address, p)
                  : prev
              );
              latestDaysRef.current = nextDays;
              if (syncResult.historyComplete !== true) return;
            }
            historyCompleteRef.current = true;
            if (!syncCompleteToastRef.current) {
              syncCompleteToastRef.current = true;
              showToast("✓ Full history synced — heatmap is up to date", "");
            }
            void fetchCheckInStatus(address).then((ci) => {
              mergeAndApply(syncResult, ci, priorBasename);
            });
          },
        }
        )
          .catch((e) => console.error(e))
          .finally(() => {
            if (historySyncGen.current === gen) {
              historySyncRunningRef.current = false;
              setAnalyticsSyncing(false);
              if (tabRef.current === "dashboard") setScanProgress("");
            }
          });
        };

        runSync();
      };

      startHistorySyncRef.current = startBackgroundHistorySync;

      const failScan = (message: string) => {
        if (!background) showToast(message, "");
        else showToast(message.replace(/^❌\s*/, ""), "");
        setWallet((prev) =>
          prev?.address.toLowerCase() === address.toLowerCase()
            ? {
                ...prev,
                recommendation:
                  prev.recommendation === "Fetching onchain data…"
                    ? "Analytics sync incomplete — open Analytics to retry"
                    : prev.recommendation,
              }
            : prev
        );
        if (!background) setLoading(false);
        setScanProgress("");
        setWalletRefreshing(false);
        setAnalyticsSyncing(false);
      };

      setScanProgress("Calculating wallet score…");

      const maybeStartHistorySync = (
        result: AnalyzeWalletResult,
        priorBasename?: string | null
      ) => {
        if (result.historyComplete === true) {
          historyCompleteRef.current = true;
          pendingHistorySyncRef.current = null;
          if (!syncCompleteToastRef.current) {
            syncCompleteToastRef.current = true;
            showToast("✓ Full history synced — heatmap is up to date", "");
          }
          return;
        }
        historyCompleteRef.current = false;
        const basename = priorBasename ?? result.wallet.basename;
        pendingHistorySyncRef.current = null;
        startBackgroundHistorySync(basename);
      };

      try {
        const ciP = fetchCheckInStatus(address).catch(() => ({
          checkedToday: false,
          streak: 0,
        }));

        if (!background) {
          setLoading(true);
        } else {
          setAnalyticsSyncing(true);
          setScanProgress("Syncing wallet analytics…");
        }
        setScanProgress(background ? "Syncing wallet analytics…" : "Calculating wallet score…");

        const ci = await ciP;

        const balancesReady =
          balancesLockedRef.current === address.toLowerCase();

        if (background && !balancesReady) {
          const bootstrap = await fetchWalletBootstrap(address).catch(() => null);
          if (bootstrap) {
            mergeAndApply(bootstrap, ci);
            lockWalletCore(bootstrap.wallet);
            setScanProgress("Refining analytics…");
          }
        }

        const skipBootstrap =
          balancesLockedRef.current === address.toLowerCase();

        // 1) Cache + bootstrap + quick score — all in parallel for fastest first paint
        setScanProgress(background ? "Loading score…" : "Calculating wallet score…");
        const [cached, bootstrap, quick] = await Promise.all([
          fetchWalletAnalysis(address, false),
          skipBootstrap ? Promise.resolve(null) : fetchWalletBootstrap(address),
          fetchWalletAnalysisQuick(address, false),
        ]);
        if (stale()) return;
        let result = cached;

        const isUsableAnalysis = (
          r: (AnalyzeWalletResult & { cached?: boolean }) | null | undefined
        ): boolean => {
          if (!r?.wallet?.address) return false;
          const w = r.wallet;
          if (w.recommendation === "Fetching onchain data…") return false;
          if ((w.score ?? 0) <= 0) return false;
          if ((w.uniqueDays ?? 0) === 0 && (w.txCount ?? 0) < 10) return false;
          const txs = w.txCount ?? 0;
          const days = w.uniqueDays ?? 0;
          if (txs > 200 && days > 100) {
            const eth = parseFloat(w.ethVolume || "0");
            const swap = w.dexVolumeUSD ?? 0;
            if (eth < 0.5 && swap < 500) return false;
          }
          return true;
        };

        const hasFastScore = (
          r: (AnalyzeWalletResult & { cached?: boolean }) | null | undefined
        ): boolean =>
          Boolean(
            r?.wallet?.address &&
              (r.wallet.score ?? 0) > 0 &&
              r.wallet.recommendation !== "Fetching onchain data…"
          );

        const pickBestFast = (
          a: (AnalyzeWalletResult & { cached?: boolean }) | null,
          b: (AnalyzeWalletResult & { cached?: boolean }) | null
        ) => {
          if (isUsableAnalysis(a)) return a;
          if (isUsableAnalysis(b)) return b;
          if (hasFastScore(a) && hasFastScore(b)) {
            return (a!.wallet.score ?? 0) >= (b!.wallet.score ?? 0) ? a : b;
          }
          return hasFastScore(a) ? a : hasFastScore(b) ? b : null;
        };

        if (isUsableAnalysis(result) && !analysisNeedsActivityRefresh(result!)) {
          if (stale()) return;
          mergeAndApply(result!, ci);
          if (background) lockWalletCore(result!.wallet);
          if (!background) {
            setLoading(false);
            setScanProgress("");
          } else {
            setAnalyticsSyncing(false);
            setScanProgress("");
          }
          maybeStartHistorySync(result!);
          return;
        }

        // 2) Best fast score from parallel fetch
        setScanProgress("Calculating score…");
        const fast = pickBestFast(pickBestFast(quick, bootstrap), cached);
        if (fast) {
          mergeAndApply(fast, ci);
          if (background) lockWalletCore(fast.wallet);
          setScanProgress("Refining analytics…");
        }

        // 3) Full analyze — skip heavy refresh in background when fast score exists
        if (!isUsableAnalysis(result) && !background) {
          setScanProgress("Fetching onchain data…");
          result = await fetchWalletAnalysis(address, true);
        } else if (!isUsableAnalysis(result) && background && !fast) {
          setScanProgress("Fetching onchain data…");
          result = await fetchWalletAnalysis(address, true);
        }

        if (!result && !fast) {
          setScanProgress("Retrying wallet scan…");
          await new Promise((r) => setTimeout(r, 400));
          result = await fetchWalletAnalysis(address, true);
        }

        if (!result && !fast) {
          failScan(
            background
              ? "Wallet analytics sync failed — open Analytics to retry"
              : "❌ Could not load wallet data — check connection and retry"
          );
          return;
        }

        if (result && (isUsableAnalysis(result) || hasFastScore(result))) {
          mergeAndApply(result, ci);
          if (background) lockWalletCore(result.wallet);
        }

        if (!background) {
          setLoading(false);
          setScanProgress("");
        } else {
          setAnalyticsSyncing(false);
          setScanProgress("");
        }

        maybeStartHistorySync((result ?? fast)!);
      } catch (e) {
        console.error(e);
        failScan(
          background
            ? "Wallet analytics sync failed — open Analytics to retry"
            : "❌ Wallet scan failed — check connection and retry"
        );
      } finally {
        if (!background) setLoading(false);
        if (!bgSyncStarted && background) {
          setAnalyticsSyncing(false);
          setScanProgress("");
        } else if (!bgSyncStarted && !background) {
          setWalletRefreshing(false);
          setScanProgress("");
        }
      }
    },
    [applyAnalysis, loadX402PremiumState, lockWalletCore, showToast, syncCheckInStatus]
  );

  const handleConnect = async (type: ConnectionType) => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    try {
      setShowModal(false);
      setLoading(true);
      setScanProgress("Connecting wallet…");

      if (type === "farcaster") {
        showToast("⏳ Connecting Base App wallet...", "");
      }

      const { address: addr, connType: resolvedType } = await connectAppWallet(type);
      setConnType(resolvedType);
      persistConnType(resolvedType);
      clearWalletCache(addr);
      loadX402PremiumState(addr);
      setMintedLevels(readPersistedMintedLevels(addr));

      // Enter app immediately — analytics continues in background.
      const shell = buildPendingWalletShell(addr);
      historyCompleteRef.current = false;
      syncCompleteToastRef.current = false;
      pendingHistorySyncRef.current = null;
      historySyncRunningRef.current = false;
      walletOpGenRef.current += 1;
      historySyncGen.current += 1;
      const connectGen = walletOpGenRef.current;
      balancesLockedRef.current = null;
      setWalletCore(null);
      setWallet(shell);
      const resume = readGuestResume() ?? {};
      const resumeTab =
        (resume.tab && resolveTabFromUrl(`?tab=${resume.tab}`)) || "launchpad";
      setTab(resumeTab);
      syncTabUrl(resumeTab, { token: resume.token ?? null });
      if (resume.card) localStorage.setItem("base_redeem_card", resume.card);
      if (resume.challenge) {
        pendingChallengeRef.current = resume.challenge;
        setChallenge(resume.challenge);
      }
      clearGuestResume();
      setLoading(false);
      setScanProgress("Loading balance…");
      setWalletRefreshing(true);
      setAnalyticsSyncing(false);

      void (async () => {
        const [basename, bootstrap, quick, miniIdentity] = await Promise.all([
          resolveBasenameClient(addr).catch(() => null),
          fetchWalletBootstrap(addr).catch(() => null),
          fetchWalletAnalysisQuick(addr, false).catch(() => null),
          resolveMiniAppIdentity().catch(() => null),
        ]);
        if (walletOpGenRef.current !== connectGen) return;
        if (miniIdentity) {
          persistMiniAppIdentity(addr, miniIdentity);
          setMiniAppIdentity(miniIdentity);
        }
        const fastWallet = quick?.wallet ?? bootstrap?.wallet;
        if (!fastWallet) {
          setWalletRefreshing(false);
          setScanProgress("");
          if (basename) {
            setWallet((prev) =>
              prev?.address.toLowerCase() === addr.toLowerCase()
                ? applyBasenameScore(prev, basename)
                : prev
            );
          }
          return;
        }
        const withBasename = {
          ...fastWallet,
          basename: basename ?? fastWallet.basename ?? bootstrap?.wallet?.basename ?? null,
        };
        setWallet((prev) => {
          if (prev?.address.toLowerCase() !== addr.toLowerCase()) return prev;
          return mergeWalletMetricsMax(prev, withBasename);
        });
        const merged = mergeWalletMetricsMax(shell, withBasename);
        lockWalletCore(merged);
      })();

      void analyzeWallet(addr, { background: true });
    } catch (e) {
      const msg =
        e instanceof Error ? e.message.split("\n")[0] : "Connection failed";
      showToast(
        msg.includes("timed out")
          ? `❌ ${msg}`
          : "❌ Connection failed. Switch to Base network and try again.",
        ""
      );
      setLoading(false);
      setScanProgress("");
    } finally {
      connectingRef.current = false;
    }
  };

  const resetSessionState = useCallback(() => {
    historySyncGen.current += 1;
    walletOpGenRef.current += 1;
    balancesLockedRef.current = null;
    pendingHistorySyncRef.current = null;
    historyCompleteRef.current = false;
    historySyncRunningRef.current = false;
    syncCompleteToastRef.current = false;
    startHistorySyncRef.current = null;
    setWalletCore(null);
    setWallet(null);
    setConnType(null);
    clearConnType();
    setMintedLevels({});
    setBoosts(0);
    setStreak(0);
    setCheckedToday(false);
    setTxKeys({ ...DEFAULT_TX_KEYS });
    setWeeklyXP(0);
    setReferralBonusXp(0);
    setChallenge("");
    setChallengeResult(null);
    setPremiumUnlocked(false);
    setPremiumData(null);
    setPremiumInsights(null);
    setFarcasterUnlocked(false);
    setFarcasterUnlockLoading(false);
    setMiniAppIdentity(null);
    setX402PayCount(0);
    setX402Product("scan");
    setSponsored(0);
    setLaunchLoading(false);
    setSwapLoading(false);
    setB20Activated(false);
    setAnalyticsSyncing(false);
    setWalletRefreshing(false);
    setScanProgress("");
    pendingTx.current.clear();
    x402Paying.current = false;
    handledActionTxs.current.clear();
    calendarRef.current = getCalendarKeys();
  }, []);

  const handleDisconnect = () => {
    const address = wallet?.address;
    if (address) {
      lockX402PremiumSession(address);
      clearFarcasterUnlocked(address);
    }
    resetSessionState();
  };

  const doNativeTx = async (type: "boost" | "gm" | "gn" | "checkin") => {
    if (!wallet) {
      showToast("❌ Connect your wallet first", "");
      return;
    }
    if (pendingTx.current.has(type)) return;

    const activeConn = await resolveActiveConnType(connType, wallet.address);
    if (activeConn && activeConn !== connType) {
      setConnType(activeConn);
      persistConnType(activeConn);
    }
    if (!activeConn) {
      showToast("❌ Reconnect your wallet to continue", "");
      return;
    }

    const callByType = {
      boost: boostCall[0],
      gm: gmCall[0],
      gn: gnCall[0],
      checkin: ciCall[0],
    } as const;
    const successMsg = {
      boost: "Boosted! 🎉",
      gm: "GM on Base! ☀️",
      gn: "GN on Base! 🌙",
      checkin: "Check-in secured! 🔥",
    } as const;

    pendingTx.current.add(type);
    setMinting(type);
    try {
      const hash = await sendAppTransaction(
        activeConn,
        wallet.address,
        callByType[type]
      );

      setSponsored((s) => s + 1);
      if (type === "checkin") {
        void handleCheckInSuccess(wallet.address, hash);
      } else if (type === "boost") {
        handleBoostSuccess(wallet.address, hash);
      } else if (type === "gm") {
        if (typeof window !== "undefined")
          localStorage.setItem(
            `base_gm_${wallet.address.toLowerCase()}`,
            "true"
          );
        const nextKeys = bumpWeeklyTxKey(wallet.address, "gm");
        setTxKeys((k) => ({ ...k, ...nextKeys }));
        const { credited, hitCap } = recordConfirmedInAppAction(
          wallet.address,
          "gm",
          nextKeys.gm ?? 0
        );
        setPointsRevision((n) => n + 1);
        if (hitCap && credited === 0) {
          showToast("GM sent — daily point cap reached", hash);
        } else if (credited > 0) {
          showToast(`GM on Base! +${credited} pts ☀️`, hash);
        } else {
          showToast(successMsg.gm, hash);
        }
      } else if (type === "gn") {
        const nextKeys = bumpWeeklyTxKey(wallet.address, "gn");
        setTxKeys((k) => ({ ...k, ...nextKeys }));
        const { credited, hitCap } = recordConfirmedInAppAction(
          wallet.address,
          "gn",
          nextKeys.gn ?? 0
        );
        setPointsRevision((n) => n + 1);
        if (hitCap && credited === 0) {
          showToast("GN sent — daily point cap reached", hash);
        } else if (credited > 0) {
          showToast(`GN on Base! +${credited} pts 🌙`, hash);
        } else {
          showToast(successMsg.gn, hash);
        }
      }
    } catch (e: unknown) {
      const m =
        e instanceof Error ? e.message.split("\n")[0] : "Transaction failed.";
      const rejected = m.toLowerCase().includes("reject");
      showToast(rejected ? "Transaction cancelled" : `❌ ${m}`, "");
    } finally {
      pendingTx.current.delete(type);
      setMinting(null);
    }
  };

  const doNativeMint = async (
    catId: string,
    targetLevels: number[],
    tokenIds: number[],
    catName: string
  ) => {
    if (!wallet) return;
    const pendingKey = `mint-${catId}`;
    if (pendingTx.current.has(pendingKey)) return;
    pendingTx.current.add(pendingKey);
    setMinting(pendingKey);
    try {
      const isBatch = tokenIds.length > 1;
      const call = isBatch
        ? encodeContractCall(
            ACHIEVEMENTS_CONTRACT as `0x${string}`,
            ACHIEVEMENTS_ABI,
            "mintBatchAchievements",
            [tokenIds.map((id) => BigInt(id))]
          )
        : encodeContractCall(
            ACHIEVEMENTS_CONTRACT as `0x${string}`,
            ACHIEVEMENTS_ABI,
            "mintAchievement",
            [BigInt(tokenIds[0])]
          );

      const activeConn = await resolveActiveConnType(connType, wallet.address);
      if (activeConn && activeConn !== connType) {
        setConnType(activeConn);
        persistConnType(activeConn);
      }
      if (!activeConn) {
        showToast("❌ Reconnect wallet to mint", "");
        return;
      }

      const hash = await sendAppTransaction(activeConn, wallet.address, call);
      recordInAppTransaction(wallet.address);
      setMintedLevels((p) => {
        const next = {
          ...p,
          [catId]: Math.max(...targetLevels),
        };
        writePersistedMintedLevels(wallet.address, next);
        syncBadgeMintCountFromLevels(wallet.address, next);
        return next;
      });
      const minted = tokenIds.length;
      const badgeXp = recordBadgeMints(wallet.address, minted);
      setTxKeys((p) => {
        const next = {
          ...p,
          [`mint-${catId}`]: (p[`mint-${catId}`] || 0) + 1,
        };
        writePersistedTxKeys(wallet.address, next);
        return next;
      });
      setSponsored((s) => s + 1);
      setPointsRevision((n) => n + 1);
      showToast(
        isBatch
          ? `✅ Claimed ${tokenIds.length} ${catName} badges! +${badgeXp} season XP`
          : `✅ Badge minted! +${badgeXp} season XP`,
        hash
      );
    } catch (e: unknown) {
      const m =
        e instanceof Error ? e.message.split("\n")[0] : "Mint rejected.";
      if (!m.toLowerCase().includes("reject")) showToast(`❌ ${m}`, "");
    } finally {
      pendingTx.current.delete(pendingKey);
      setMinting(null);
    }
  };

  const doAppBadgeMint = async (
    catId: string,
    targetLevels: number[],
    tokenIds: number[],
    catName: string
  ) => {
    if (!wallet) return false;
    const pendingKey = `app-mint-${catId}`;
    if (pendingTx.current.has(pendingKey)) return false;
    pendingTx.current.add(pendingKey);
    setMinting(pendingKey);
    try {
      const isBatch = tokenIds.length > 1;
      const call = isBatch
        ? encodeContractCall(
            ACHIEVEMENTS_CONTRACT as `0x${string}`,
            ACHIEVEMENTS_ABI,
            "mintBatchAchievements",
            [tokenIds.map((id) => BigInt(id))]
          )
        : encodeContractCall(
            ACHIEVEMENTS_CONTRACT as `0x${string}`,
            ACHIEVEMENTS_ABI,
            "mintAchievement",
            [BigInt(tokenIds[0])]
          );

      const activeConn = await resolveActiveConnType(connType, wallet.address);
      if (activeConn && activeConn !== connType) {
        setConnType(activeConn);
        persistConnType(activeConn);
      }
      if (!activeConn) {
        showToast("❌ Reconnect wallet to mint", "");
        return false;
      }

      const hash = await sendAppTransaction(activeConn, wallet.address, call);
      recordInAppTransaction(wallet.address);

      const prev = readAppBadgeLevels(wallet.address);
      const next = {
        ...prev,
        [catId]: Math.max(...targetLevels),
      };
      writeAppBadgeLevels(wallet.address, next);

      const badgeXp = recordAppBadgeClaims(wallet.address, tokenIds.length);
      setSponsored((s) => s + 1);
      setPointsRevision((n) => n + 1);
      showToast(
        isBatch
          ? `✅ Minted ${tokenIds.length} ${catName} badges on-chain · +${badgeXp} season XP`
          : `✅ ${catName} badge minted on-chain · +${badgeXp} season XP`,
        hash
      );
      return true;
    } catch (e: unknown) {
      const m =
        e instanceof Error ? e.message.split("\n")[0] : "Mint rejected.";
      if (!m.toLowerCase().includes("reject")) showToast(`❌ ${m}`, "");
      return false;
    } finally {
      pendingTx.current.delete(pendingKey);
      setMinting(null);
    }
  };

  const mintedCount = wallet ? sumMintedBadges(mintedLevels) : 0;
  const ref = wallet ? getReferralCode(wallet.address) : "";

  const openFarcasterShare = async (text: string, pageUrl: string) => {
    if (sharingRef.current) return;
    sharingRef.current = true;
    try {
      if (
        connType === "farcaster" &&
        typeof sdk.actions?.composeCast === "function"
      ) {
        await sdk.actions.composeCast({
          text,
          embeds: [pageUrl],
          close: false,
        });
      } else {
        window.open(warpcast(text, pageUrl), "_blank", "noopener,noreferrer");
      }
    } catch {
      showToast("Share cancelled", "");
    } finally {
      setTimeout(() => {
        sharingRef.current = false;
      }, 2500);
    }
  };

  const shareScore = (pl: "w" | "t" | "n") => {
    if (!wallet || sharingRef.current) return;
    const main = buildScoreShareText(wallet, streak, mintedCount);
    const text = buildShareBody(main, ref);
    const card = buildShareCardData(wallet, {
      ref,
      mintedCount,
      streak,
      weeklyXP,
      boosts,
      variant: "score",
    });
    const pageUrl = buildSharePageUrl(card, ref);
    if (pl === "w") void openFarcasterShare(text, pageUrl);
    else if (pl === "t") window.open(twitterShare(text, pageUrl), "_blank", "noopener,noreferrer");
    else if (navigator.share)
      navigator
        .share({
          title: "Base Analytics",
          text,
          url: pageUrl,
        })
        .catch(() => {});
  };

  const shareAch = (name: string, level: string, pl: "w" | "t") => {
    if (!wallet || sharingRef.current) return;
    const text = buildShareBody(buildBadgeShareText(name, level, wallet), ref);
    const card = buildShareCardData(wallet, {
      ref,
      mintedCount,
      streak,
      weeklyXP,
      boosts,
      variant: "badge",
      title: `${level} — ${name}`,
      subtitle: `${wallet.score}/100 · ${mintedCount} badges on Base`,
    });
    const pageUrl = buildSharePageUrl(card, ref);
    if (pl === "w") void openFarcasterShare(text, pageUrl);
    else window.open(twitterShare(text, pageUrl), "_blank", "noopener,noreferrer");
  };

  const shareAll = (count: number, pl: "w" | "t") => {
    if (!wallet || sharingRef.current) return;
    const text = buildShareBody(buildBadgesShareText(count, wallet), ref);
    const card = buildShareCardData(wallet, {
      ref,
      mintedCount: count,
      streak,
      weeklyXP,
      boosts,
      variant: "badge",
      title: `${count} Badges Minted`,
      subtitle: `${wallet.walletRank} · Score ${wallet.score}/100`,
    });
    const pageUrl = buildSharePageUrl(card, ref);
    if (pl === "w") void openFarcasterShare(text, pageUrl);
    else window.open(twitterShare(text, pageUrl), "_blank", "noopener,noreferrer");
  };

  const getAchievementValue = (id: string) =>
    wallet ? getCatValue(wallet, boosts, id) : 0;

  const questContext = wallet
    ? buildAppQuestContext({
        wallet,
        streak,
        checkedToday,
        txKeys,
        x402PayCount,
        referralInvites,
        didChallenge: Boolean(challengeResult),
      })
    : null;

  const doneQuests = questContext
    ? WEEKLY_QUESTS.filter((q) => q.check(questContext)).length
    : 0;

  const walletScanComplete = Boolean(
    wallet &&
      !loading &&
      !analyticsSyncing &&
      wallet.score > 0 &&
      wallet.recommendation !== "Fetching onchain data…"
  );

  return {
    wallet,
    walletCore,
    connType,
    loading,
    tab,
    setTab,
    minting,
    mintedLevels,
    setMintedLevels,
    ready,
    showModal,
    setShowModal,
    selDay,
    setSelDay,
    scrollRef,
    boosts,
    setBoosts,
    sponsored,
    setSponsored,
    txKeys,
    setTxKeys,
    toast,
    setToast,
    streak,
    checkedToday,
    setCheckedToday,
    setStreak,
    leaderboard,
    lbLoading,
    challenge,
    setChallenge,
    challengeResult,
    challengeLoading,
    refCopied,
    setRefCopied,
    weeklyXP,
    scanProgress,
    walletRefreshing,
    analyticsSyncing,
    walletScanComplete,
    miniAppIdentity,
    walletDisplayLabel: wallet
      ? formatWalletDisplayLabel(wallet.address, {
          basename: wallet.basename,
          miniApp: miniAppIdentity,
        })
      : "",
    premiumUnlocked,
    premiumLoading,
    premiumData,
    premiumInsights,
    farcasterUnlocked,
    farcasterUnlockLoading,
    handleFarcasterUnlock,
    launchLoading,
    swapLoading,
    b20Activated,
    handleLaunchB20,
    handleTokenSwap,
    handleSeedLiquidity,
    handleUnwrapWeth,
    x402Product,
    setX402Product,
    referralBonusXp,
    referralInvites,
    questContext,
    x402PayCount,
    boostCall,
    gmCall,
    gnCall,
    ciCall,
    txCaps,
    mintedCount,
    ref,
    showToast,
    handlePremiumScan,
    handleChallenge,
    handleConnect,
    handleDisconnect,
    handleCheckInSuccess,
    handleBoostSuccess,
    doNativeTx,
    doNativeMint,
    doAppBadgeMint,
    shareScore,
    shareAch,
    shareAll,
    getAchievementValue,
    doneQuests,
    pointsRevision,
    setPointsRevision,
  };
}
