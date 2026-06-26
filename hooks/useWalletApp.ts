"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { connectWallet } from "@/app/connection";
import { analyzeWalletAddress } from "@/lib/analyze-wallet";
import { fetchLeaderboard, saveLeaderboard } from "@/lib/api/leaderboard";
import { fetchWalletTransfers } from "@/lib/api/wallet-txs";
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
import { getCatValue } from "@/lib/utils/achievements";
import { getDayKey, getISOWeekNumber, getMonthKey, getWeekKey } from "@/lib/utils/dates";
import { computeChallengeScore, computeWalletRank } from "@/lib/utils/score";
import { getCapabilities } from "@/lib/utils/paymaster";
import { WEEKLY_QUESTS } from "@/lib/constants/season";
import { computeWeeklyXP } from "@/lib/utils/season";
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
import type { ConnectionType, DayStats, WalletData } from "@/lib/types/wallet";
import type { LeaderboardEntry } from "@/lib/types/leaderboard";

export type WalletAppState = ReturnType<typeof useWalletApp>;

export type AppTab =
  | "dashboard"
  | "achievements"
  | "quests"
  | "leaderboard"
  | "basehub";

export function useWalletApp() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [connType, setConnType] = useState<ConnectionType | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<AppTab>("dashboard");
  const [minting, setMinting] = useState<string | null>(null);
  const [mintedLevels, setMintedLevels] = useState<Record<string, number>>({});
  const [ready, setReady] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selDay, setSelDay] = useState<DayStats | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sharingRef = useRef(false);
  const [boosts, setBoosts] = useState(0);
  const [sponsored, setSponsored] = useState(0);
  const [txKeys, setTxKeys] = useState<Record<string, number>>({
    boost: 0,
    gm: 0,
    gn: 0,
    checkin: 0,
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
  const [scanProgress, setScanProgress] = useState("");
  const [premiumUnlocked, setPremiumUnlocked] = useState(false);
  const [premiumLoading, setPremiumLoading] = useState(false);
  const [premiumData, setPremiumData] = useState<{
    message: string;
    transaction?: string;
  } | null>(null);
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
    const key = address.toLowerCase();
    const savedCount = parseInt(
      localStorage.getItem(`x402_count_${key}`) || "0",
      10
    );
    const unlocked =
      localStorage.getItem(`x402_unlocked_${key}`) === "true" ||
      savedCount > 0;
    const lastTx = localStorage.getItem(`x402_last_tx_${key}`);
    setX402PayCount(savedCount);
    setPremiumUnlocked(unlocked);
    if (unlocked) {
      setPremiumData({
        message: "Premium analytics unlocked",
        ...(lastTx ? { transaction: lastTx } : {}),
      });
    } else {
      setPremiumData(null);
    }
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
    }
    fetchLeaderboard().then((d) => {
      setLeaderboard(d);
      setLbLoading(false);
    });
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const r = p.get("ref");
      if (r) localStorage.setItem("base_referrer", r);
    }
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
    const xp = computeWeeklyXP(wallet, boosts, streak, txKeys);
    setWeeklyXP(xp);
    const mintedCount = Object.keys(mintedLevels).filter(
      (k) => mintedLevels[k] > 0
    ).length;
    saveLeaderboard({
      address: wallet.address,
      basename: wallet.basename,
      score: wallet.score,
      rank: wallet.walletRank,
      boosts,
      badges: mintedCount,
      weeklyXP: xp,
      weekNumber: getISOWeekNumber(),
    }).then(() => fetchLeaderboard().then((d) => setLeaderboard(d)));
  }, [wallet, boosts, mintedLevels, streak, txKeys]);

  const handlePremiumScan = async () => {
    if (!wallet) return;
    setPremiumLoading(true);
    try {
      const provider =
        connType === "farcaster"
          ? sdk.wallet.ethProvider
          : (window as unknown as { ethereum: typeof sdk.wallet.ethProvider })
              .ethereum;

      const { getX402Fetch } = await import("@/lib/x402-client");
      const x402Fetch = await getX402Fetch(provider);

      const res = await x402Fetch("/api/premium-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet.address }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          message: string;
          transaction?: string;
        };
        setPremiumData(data);
        setPremiumUnlocked(true);
        const key = wallet.address.toLowerCase();
        const prev = parseInt(
          localStorage.getItem(`x402_count_${key}`) || "0",
          10
        );
        const next = prev + 1;
        localStorage.setItem(`x402_count_${key}`, next.toString());
        localStorage.setItem(`x402_unlocked_${key}`, "true");
        if (data.transaction) {
          localStorage.setItem(
            `x402_last_tx_${wallet.address.toLowerCase()}`,
            normalizeTxHash(data.transaction) ?? data.transaction
          );
        }
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
      setPremiumLoading(false);
    }
  };

  const handleChallenge = useCallback(async () => {
    const addr = challenge.trim().toLowerCase();
    if (!addr || !addr.startsWith("0x") || addr.length !== 42) {
      showToast("❌ Invalid address", "");
      return;
    }
    setChallengeLoading(true);
    try {
      const merged = await fetchWalletTransfers(addr);
      const days = new Set(merged.map((tx) => getDayKey(tx.metadata.blockTimestamp)));
      const months = new Set(
        merged.map((tx) => getMonthKey(tx.metadata.blockTimestamp))
      );
      const weeks = new Set(
        merged.map((tx) => getWeekKey(tx.metadata.blockTimestamp))
      );
      const s = computeChallengeScore(
        merged.length,
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
        txs: merged.length,
      });
    } catch {
      showToast("❌ Lookup failed", "");
    } finally {
      setChallengeLoading(false);
    }
  }, [challenge, showToast]);

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
      setLoading(true);
      try {
        const result = await analyzeWalletAddress(address, setScanProgress);
        if (!result) {
          showToast("❌ Analysis failed", "");
          setWallet(null);
          return;
        }
        setMintedLevels(result.mintedLevels);
        setStreak(result.streak);
        setCheckedToday(result.checkedToday);
        setBoosts(result.boosts);
        setWallet(result.wallet);
      } catch (e) {
        console.error(e);
        setWallet(null);
      } finally {
        setLoading(false);
        setScanProgress("");
      }
    },
    [loadX402PremiumState, showToast]
  );

  const handleConnect = async (type: ConnectionType) => {
    try {
      setShowModal(false);
      setLoading(true);
      let addr = "";
      if (type === "farcaster") {
        showToast("⏳ Connecting Farcaster...", "");
        const accs = (await sdk.wallet.ethProvider.request({
          method: "eth_requestAccounts",
        })) as string[];
        const evm = accs.find((a) => a && a.startsWith("0x"));
        if (!evm) throw new Error("No EVM wallet");
        addr = evm;
        showToast("✅ Scanning...", "");
      } else {
        const { address } = await connectWallet(type);
        addr = address;
      }
      setConnType(type);
      analyzeWallet(addr);
    } catch {
      setLoading(false);
      showToast("❌ Connection Failed.", "");
    }
  };

  const handleDisconnect = () => {
    setWallet(null);
    setConnType(null);
    setPremiumUnlocked(false);
    setPremiumData(null);
    setX402PayCount(0);
  };

  const doNativeTx = async (type: "boost" | "gm" | "gn" | "checkin") => {
    if (!wallet || minting) return;
    setMinting(type);
    try {
      let to: `0x${string}` = BOOSTER_CONTRACT as `0x${string}`;
      let data: `0x${string}` = boostCall[0].data;
      let msg = "Boosted! 🎉";
      if (type === "gm") {
        to = GM_GN_CONTRACT as `0x${string}`;
        data = gmCall[0].data;
        msg = "GM on Base! ☀️";
      } else if (type === "gn") {
        to = GM_GN_CONTRACT as `0x${string}`;
        data = gnCall[0].data;
        msg = "GN on Base! 🌙";
      } else if (type === "checkin") {
        to = CHECKIN_CONTRACT as `0x${string}`;
        data = ciCall[0].data;
        msg = "Check-in secured! 🔥";
      }
      const p = {
        from: wallet.address as `0x${string}`,
        to,
        data,
        chainId: "0x2105" as `0x${string}`,
      };
      const hash = await sdk.wallet.ethProvider.request({
        method: "eth_sendTransaction",
        params: [p],
      });
      if (hash && typeof hash === "string") {
        showToast(msg, hash);
        setSponsored((s) => s + 1);
        if (type === "boost") {
          setBoosts((b) => {
            const n = b + 1;
            if (typeof window !== "undefined")
              localStorage.setItem(
                `base_boosts_${wallet.address.toLowerCase()}`,
                n.toString()
              );
            return n;
          });
          setTxKeys((k) => ({ ...k, boost: (k.boost || 0) + 1 }));
        }
        if (type === "gm") {
          if (typeof window !== "undefined")
            localStorage.setItem(
              `base_gm_${wallet.address.toLowerCase()}`,
              "true"
            );
          setTxKeys((k) => ({ ...k, gm: (k.gm || 0) + 1 }));
        }
        if (type === "gn")
          setTxKeys((k) => ({ ...k, gn: (k.gn || 0) + 1 }));
        if (type === "checkin") {
          setCheckedToday(true);
          setStreak((s) => s + 1);
          setTxKeys((k) => ({ ...k, checkin: (k.checkin || 0) + 1 }));
        }
      }
    } catch (e: unknown) {
      const m =
        e instanceof Error ? e.message.split("\n")[0] : "Rejected.";
      if (!m.includes("rejected")) showToast(`❌ ${m}`, "");
    } finally {
      setMinting(null);
    }
  };

  const doNativeMint = async (
    catId: string,
    targetLevels: number[],
    tokenIds: number[],
    catName: string
  ) => {
    if (!wallet || minting) return;
    setMinting(`mint-${catId}`);
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
      const hash = await sdk.wallet.ethProvider.request({
        method: "eth_sendTransaction",
        params: [
          {
            from: wallet.address as `0x${string}`,
            to: call.to,
            data: call.data,
            chainId: "0x2105" as `0x${string}`,
          },
        ],
      });
      if (hash && typeof hash === "string") {
        showToast(
          isBatch
            ? `✅ Claimed ${tokenIds.length} ${catName} Badges!`
            : `✅ Badge minted!`,
          hash
        );
        setMintedLevels((p) => ({
          ...p,
          [catId]: Math.max(...targetLevels),
        }));
        setTxKeys((p) => ({
          ...p,
          [`mint-${catId}`]: (p[`mint-${catId}`] || 0) + 1,
        }));
        setSponsored((s) => s + 1);
      }
    } catch (e: unknown) {
      const m =
        e instanceof Error ? e.message.split("\n")[0] : "Mint rejected.";
      if (!m.includes("rejected")) showToast("❌ Mint Failed", "");
    } finally {
      setMinting(null);
    }
  };

  const mintedCount = wallet
    ? Object.keys(mintedLevels).filter((k) => mintedLevels[k] > 0).length
    : 0;
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

  const doneQuests = wallet
    ? WEEKLY_QUESTS.filter((q) => q.check(wallet, boosts, streak, txKeys)).length
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
    premiumUnlocked,
    premiumLoading,
    premiumData,
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
    doNativeTx,
    doNativeMint,
    shareScore,
    shareAch,
    shareAll,
    getAchievementValue,
    doneQuests,
  };
}
