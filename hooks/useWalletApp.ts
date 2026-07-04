"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { connectWallet, getEip1193Provider } from "@/app/connection";
import { fetchWalletAnalysis } from "@/lib/api/wallet-analysis-client";
import { fetchLeaderboard, saveLeaderboard } from "@/lib/api/leaderboard";
import { fetchWalletTransfers } from "@/lib/api/wallet-txs";
import { rollupWalletActivity } from "@/lib/utils/wallet-activity";
import {
  readWalletCache,
  writeWalletCache,
  purgeLegacyWalletCaches,
} from "@/lib/utils/wallet-cache";
import {
  fetchCheckInStatus,
  patchCheckInInWalletCache,
  readLocalCheckInToday,
  recordCheckInSuccess,
} from "@/lib/utils/check-in-status";
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
import { computeChallengeScore, computeWalletRank } from "@/lib/utils/score";
import { getCapabilities } from "@/lib/utils/paymaster";
import { WEEKLY_QUESTS } from "@/lib/constants/season";
import {
  buildAppQuestContext,
  computeWeeklyXP,
  countDoneQuests,
} from "@/lib/utils/season";
import {
  getBadgeMintXpTotal,
  recordBadgeMints,
  syncBadgeMintCountFromLevels,
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
import { encodeContractCall, normalizeTxHash } from "@/lib/utils/tx";
import { sendAppTransaction, sendAppTransactions } from "@/lib/utils/send-app-tx";
import {
  clearConnType,
  ensureBaseNetwork,
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
  bumpBoostCount,
  DEFAULT_TX_KEYS,
  deriveTxKeysFromAnalysis,
  ensureSessionStorageVersion,
  mergeTxKeyCounters,
  readReferralBonusXpForAddress,
  setReferralBonusXpForAddress,
  syncSessionFromAnalysis,
  writePersistedTxKeys,
} from "@/lib/utils/wallet-session";
import {
  creditActivityFromCount,
  recordCheckInPointsOnce,
  syncActivityPointsFromSession,
  tryAwardSevenDayAllTasksBonus,
} from "@/lib/utils/daily-points";
import { PREDICTIONS_CONTRACT, BASE_RPC } from "@/lib/constants/env";
import {
  ERC20_ABI,
  PREDICTIONS_ABI,
  USDC_BASE,
} from "@/lib/constants/contracts";
import type { PredictionAsset, PredictionDuration } from "@/lib/constants/predictions";
import type { StreakEntry } from "@/lib/predictions/types";
import { parseUnits, createPublicClient, http, maxUint256 } from "viem";
import { base } from "viem/chains";
import type { LeaderboardEntry } from "@/lib/types/leaderboard";

export type WalletAppState = ReturnType<typeof useWalletApp>;

export type AppTab =
  | "predictions"
  | "dashboard"
  | "checkin"
  | "achievements"
  | "leaderboard"
  | "basehub";

function resolveTabFromUrl(): AppTab | null {
  if (typeof window === "undefined") return null;
  const t = new URLSearchParams(window.location.search).get("tab");
  const map: Record<string, AppTab> = {
    predictions: "predictions",
    predict: "predictions",
    markets: "predictions",
    dashboard: "dashboard",
    checkin: "checkin",
    "check-in": "checkin",
    quests: "checkin",
    rankings: "checkin",
    leaderboard: "checkin",
    voucher: "basehub",
    basehub: "basehub",
    badges: "achievements",
    achievements: "achievements",
  };
  return t && map[t] ? map[t] : null;
}

function resolveInitialTab(): AppTab {
  const fromUrl = resolveTabFromUrl();
  if (fromUrl) return fromUrl;
  return "predictions";
}

export function useWalletApp() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [connType, setConnType] = useState<ConnectionType | null>(() =>
    typeof window !== "undefined" ? readConnType() : null
  );
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<AppTab>("predictions");
  const [minting, setMinting] = useState<string | null>(null);
  const [mintedLevels, setMintedLevels] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selDay, setSelDay] = useState<DayStats | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sharingRef = useRef(false);
  const pendingTx = useRef<Set<string>>(new Set());
  const connectingRef = useRef(false);
  const x402Paying = useRef(false);
  const handledActionTxs = useRef<Set<string>>(new Set());
  const [boosts, setBoosts] = useState(0);
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
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [farcasterUnlocked, setFarcasterUnlocked] = useState(false);
  const [farcasterUnlockLoading, setFarcasterUnlockLoading] = useState(false);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionStreak, setPredictionStreak] = useState<StreakEntry[]>([]);
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
    }
    fetchLeaderboard().then((d) => {
      setLeaderboard(d);
      setLbLoading(false);
    });
  }, []);

  useEffect(() => {
    if (wallet && tab === "dashboard" && scrollRef.current)
      setTimeout(() => {
        if (scrollRef.current)
          scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      }, 100);
  }, [wallet, tab]);

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
    saveLeaderboard({
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
  }, [
    wallet,
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

      const res = await x402Fetch("/api/premium-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet.address, product: "farcaster" }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          message: string;
          transaction?: string;
        };
        setFarcasterUnlocked(true);
        const keys = x402StorageKeys(wallet.address);
        const prev = parseInt(localStorage.getItem(keys.count) || "0", 10);
        const next = prev + 1;
        localStorage.setItem(keys.count, next.toString());
        setX402PayCount(next);
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

  const handlePredictionTrade = useCallback(
    async (args: {
      asset: PredictionAsset;
      duration: PredictionDuration;
      side: "yes" | "no";
      usdcAmount: number;
      marketId: number;
    }): Promise<boolean> => {
      if (!wallet) return false;

      setPredictionLoading(true);
      try {
        const usdcRaw = parseUnits(args.usdcAmount.toFixed(6), 6);
        const contract = PREDICTIONS_CONTRACT as `0x${string}`;

        const creditPredictionSuccess = (txHash?: string) => {
          let nextCount = 0;
          setTxKeys((k) => {
            nextCount = (k.prediction || 0) + 1;
            const next = { ...k, prediction: nextCount };
            writePersistedTxKeys(wallet.address, next);
            return next;
          });
          const { credited, hitCap } = creditActivityFromCount(
            wallet.address,
            "prediction",
            nextCount
          );
          setPointsRevision((n) => n + 1);
          if (txHash) {
            if (hitCap && credited === 0) {
              showToast("Trade recorded — daily point cap reached", txHash);
            } else if (credited > 0) {
              showToast(
                `${args.side.toUpperCase()} on ${args.asset} · +${credited} pts`,
                txHash
              );
            } else {
              showToast(
                `✅ ${args.side.toUpperCase()} shares · ${args.asset} ${args.duration}`,
                txHash
              );
            }
          }
        };

        if (!contract) {
          const key = `base_pred_trades_${wallet.address.toLowerCase()}`;
          const prev = parseInt(localStorage.getItem(key) || "0", 10);
          localStorage.setItem(key, String(prev + 1));
          creditPredictionSuccess();
          showToast(
            `✅ ${args.side.toUpperCase()} on ${args.asset} ${args.duration} (demo — set NEXT_PUBLIC_PREDICTIONS_CONTRACT)`,
            ""
          );
          return true;
        }

        if (!args.marketId) {
          showToast("❌ On-chain market not open yet — wait for keeper sync", "");
          return false;
        }

        const activeConn = await resolveActiveConnType(connType, wallet.address);
        if (activeConn && activeConn !== connType) {
          setConnType(activeConn);
          persistConnType(activeConn);
        }
        if (!activeConn) {
          showToast("❌ Reconnect wallet to trade", "");
          return false;
        }

        const calls = [];
        if (BASE_RPC) {
          const pub = createPublicClient({
            chain: base,
            transport: http(BASE_RPC),
          });
          const allowance = await pub.readContract({
            address: USDC_BASE as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "allowance",
            args: [wallet.address as `0x${string}`, contract],
          });
          if (allowance < usdcRaw) {
            calls.push(
              encodeContractCall(USDC_BASE as `0x${string}`, ERC20_ABI, "approve", [
                contract,
                maxUint256,
              ])
            );
          }
        }

        const fn = args.side === "yes" ? "buyYes" : "buyNo";
        calls.push(
          encodeContractCall(contract, PREDICTIONS_ABI, fn, [
            BigInt(args.marketId),
            usdcRaw,
          ])
        );

        const hash = await sendAppTransactions(
          activeConn,
          wallet.address,
          calls
        );
        setSponsored((s) => s + 1);
        creditPredictionSuccess(hash);
        return true;
      } catch (e) {
        const msg =
          e instanceof Error ? e.message.split("\n")[0] : "Trade failed";
        if (!msg.toLowerCase().includes("reject")) {
          showToast(`❌ ${msg}`, "");
        }
        return false;
      } finally {
        setPredictionLoading(false);
      }
    },
    [connType, showToast, wallet]
  );

  useEffect(() => {
    if (!wallet || !leaderboard.length) {
      setPredictionStreak([]);
      return;
    }
    const rows: StreakEntry[] = leaderboard.slice(0, 10).map((e) => ({
      address: e.address.toLowerCase(),
      basename: e.basename,
      wins: Math.max(1, Math.floor((e.weeklyXP ?? 0) / 50)),
      streak: Math.min(14, Math.max(1, Math.floor((e.weeklyXP ?? 0) / 80))),
    }));
    setPredictionStreak(rows);
  }, [wallet, leaderboard]);

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
        const { credited } = creditActivityFromCount(wallet.address, "challenge", 1);
        if (credited > 0) setPointsRevision((n) => n + 1);
      }
    } catch {
      showToast("❌ Lookup failed", "");
    } finally {
      setChallengeLoading(false);
    }
  }, [challenge, showToast, wallet]);

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
    setMintedLevels(result.mintedLevels);
    setStreak(result.streak);
    setCheckedToday(
      result.checkedToday || readLocalCheckInToday(address)
    );
    setBoosts((prev) => Math.max(prev, session.boosts));
    setWallet((prev) => ({
      ...result.wallet,
      checkInCount: Math.max(prev?.checkInCount ?? 0, session.checkInCount),
    }));
    setReferralBonusXp(readReferralBonusXpForAddress(address));
    setTxKeys((prev) => mergeTxKeyCounters(session.txKeys, prev));
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
      let nextCount = 0;
      setTxKeys((k) => {
        nextCount = (k.boost || 0) + 1;
        const next = { ...k, boost: nextCount };
        writePersistedTxKeys(address, next);
        return next;
      });
      const { credited, hitCap } = creditActivityFromCount(
        address,
        "boost",
        nextCount
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

  const analyzeWallet = useCallback(
    async (address: string) => {
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
      purgeLegacyWalletCaches(address);

      const cached = readWalletCache(address);
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

      const mergeAndApply = (
        result: AnalyzeWalletResult,
        ci: { checkedToday: boolean; streak: number }
      ) => {
        const merged = {
          ...result,
          checkedToday: ci.checkedToday || result.checkedToday,
          streak: ci.streak || result.streak,
        };
        applyAnalysis({
          ...merged,
          checkedToday:
            merged.checkedToday || readLocalCheckInToday(address),
        });
        writeWalletCache(address, merged, true);
        registerReferralOnce();
      };

      if (cached) {
        applyAnalysis({
          ...cached,
          checkedToday: cached.checkedToday || readLocalCheckInToday(address),
        });
        setLoading(false);
        setWalletRefreshing(true);
        registerReferralOnce();

        try {
          const [result, ci] = await Promise.all([
            fetchWalletAnalysis(address, true),
            fetchCheckInStatus(address),
          ]);
          if (result) mergeAndApply(result, ci);
        } catch (e) {
          console.error(e);
        } finally {
          setWalletRefreshing(false);
          setScanProgress("");
        }
        return;
      }

      setLoading(true);
      setScanProgress("Loading onchain score & profile…");

      try {
        const [result, ci] = await Promise.all([
          fetchWalletAnalysis(address, true),
          fetchCheckInStatus(address),
        ]);
        if (!result) {
          showToast("❌ Could not load wallet data — try again", "");
          setWallet(null);
          return;
        }
        mergeAndApply(result, ci);
      } catch (e) {
        console.error(e);
        showToast("❌ Wallet scan failed — check connection and retry", "");
        setWallet(null);
      } finally {
        setLoading(false);
        setWalletRefreshing(false);
        setScanProgress("");
      }
    },
    [applyAnalysis, loadX402PremiumState, showToast, syncCheckInStatus]
  );

  const handleConnect = async (type: ConnectionType) => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    try {
      setShowModal(false);
      setLoading(true);
      let addr = "";
      if (type === "farcaster") {
        showToast("⏳ Connecting Farcaster...", "");
        const provider = await sdk.wallet.getEthereumProvider();
        if (!provider) throw new Error("Farcaster wallet not available");
        const accs = (await provider.request({
          method: "eth_requestAccounts",
        })) as string[];
        const evm = accs.find((a) => a && a.startsWith("0x"));
        if (!evm) throw new Error("No EVM wallet");
        addr = evm;
        await ensureBaseNetwork(provider);
      } else if (type === "baseAccount") {
        const { connectBaseAccount } = await import("@/lib/base-account");
        const connected = await connectBaseAccount();
        addr = connected.address;
      } else {
        const { address } = await connectWallet(type);
        addr = address;
        const provider = await getEip1193Provider(type);
        await ensureBaseNetwork(provider);
      }
      setConnType(type);
      persistConnType(type);
      await analyzeWallet(addr);
    } catch {
      setLoading(false);
      showToast("❌ Connection failed. Switch to Base network and try again.", "");
    } finally {
      connectingRef.current = false;
    }
  };

  const resetSessionState = useCallback(() => {
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
    setX402PayCount(0);
    setX402Product("scan");
    setSponsored(0);
    setPredictionLoading(false);
    setPredictionStreak([]);
    pendingTx.current.clear();
    x402Paying.current = false;
    handledActionTxs.current.clear();
  }, []);

  const handleDisconnect = () => {
    const address = wallet?.address;
    if (address) {
      lockX402PremiumSession(address);
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
        let nextCount = 0;
        setTxKeys((k) => {
          nextCount = (k.gm || 0) + 1;
          const next = { ...k, gm: nextCount };
          writePersistedTxKeys(wallet.address, next);
          return next;
        });
        const { credited, hitCap } = creditActivityFromCount(
          wallet.address,
          "gm",
          nextCount
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
        let nextCount = 0;
        setTxKeys((k) => {
          nextCount = (k.gn || 0) + 1;
          const next = { ...k, gn: nextCount };
          writePersistedTxKeys(wallet.address, next);
          return next;
        });
        const { credited, hitCap } = creditActivityFromCount(
          wallet.address,
          "gn",
          nextCount
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
      setMintedLevels((p) => ({
        ...p,
        [catId]: Math.max(...targetLevels),
      }));
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
      if (badgeXp > 0) {
        setPointsRevision((n) => n + 1);
      }
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

  return {
    wallet,
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
    premiumUnlocked,
    premiumLoading,
    premiumData,
    premiumInsights,
    farcasterUnlocked,
    farcasterUnlockLoading,
    handleFarcasterUnlock,
    predictionLoading,
    predictionStreak,
    handlePredictionTrade,
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
    shareScore,
    shareAch,
    shareAll,
    getAchievementValue,
    doneQuests,
    pointsRevision,
  };
}
