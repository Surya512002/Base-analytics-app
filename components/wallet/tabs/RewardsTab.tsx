"use client";

import { useCallback, useEffect, useState } from "react";
import { Flame, Lock, Sparkles, Trophy, Unlock } from "lucide-react";
import { encodeFunctionData, formatEther, parseEther } from "viem";
import Link from "next/link";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { XP_STAKE_ABI } from "@/lib/constants/contracts";
import { XP_STAKE_CONTRACT } from "@/lib/constants/env";
import {
  fetchOnchainStake,
  tierToMultiplier,
  type OnchainStake,
} from "@/lib/wallet/onchain-stake";
import {
  readXpStake,
  stakeXp,
  stakeDaysRemaining,
  stakeMultiplier,
  unstakeXp,
  type XpStakeRecord,
} from "@/lib/utils/stake-rewards";
import { sendAppTransaction } from "@/lib/utils/send-app-tx";
import { buildContractCall } from "@/lib/utils/tx";
import { creditActivityFromCount } from "@/lib/utils/daily-points";
import { writePersistedTxKeys } from "@/lib/utils/wallet-session";

const STAKE_TIERS = [
  { label: "Bronze", eth: "0.0001", mult: "1.1×" },
  { label: "Silver", eth: "0.0005", mult: "1.25×" },
  { label: "Gold", eth: "0.001", mult: "1.5×" },
];

function formatStakeCountdown(unlockAtMs: number): string {
  const ms = unlockAtMs - Date.now();
  if (ms <= 0) return "Ready to withdraw";
  const totalSec = Math.ceil(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

export default function RewardsTab({
  app,
  embedded = false,
}: {
  app: WalletAppState;
  embedded?: boolean;
}) {
  const { wallet, weeklyXP, doneQuests, streak, showToast, connType, setTxKeys, setPointsRevision } =
    app;
  const [localStake, setLocalStake] = useState<XpStakeRecord | null>(null);
  const [onchainStake, setOnchainStake] = useState<OnchainStake | null>(null);
  const [stakeAmount, setStakeAmount] = useState("100");
  const [ethTier, setEthTier] = useState("0.0001");
  const [busy, setBusy] = useState(false);
  const [onchainLoading, setOnchainLoading] = useState(false);
  const [tick, setTick] = useState(0);

  const refreshOnchain = useCallback(async () => {
    if (!wallet || !XP_STAKE_CONTRACT) return;
    setOnchainLoading(true);
    try {
      const s = await fetchOnchainStake(wallet.address);
      setOnchainStake(s);
    } finally {
      setOnchainLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    setLocalStake(readXpStake());
    void refreshOnchain();
  }, [refreshOnchain]);

  useEffect(() => {
    if (!onchainStake) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setTick((n) => n + 1);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [onchainStake]);

  if (!wallet) return null;

  const hasOnchainStake = Boolean(onchainStake?.active && onchainStake.amount > BigInt(0));
  const onchainLocked = hasOnchainStake && Date.now() < onchainStake!.unlockAt;
  const localMult = stakeMultiplier(localStake);
  const onchainMult = onchainStake ? tierToMultiplier(onchainStake.tier) : 1;
  const canUnstakeLocal = localStake && Date.now() >= localStake.unlockAt;
  const canUnstakeOnchain = hasOnchainStake && Date.now() >= onchainStake!.unlockAt;

  const recordStake = () => {
    if (!wallet) return;
    let nextCount = 0;
    setTxKeys((k) => {
      nextCount = (k.stake || 0) + 1;
      const next = { ...k, stake: nextCount };
      writePersistedTxKeys(wallet.address, next);
      return next;
    });
    const { credited } = creditActivityFromCount(wallet.address, "stake", nextCount);
    if (credited > 0) setPointsRevision((n) => n + 1);
  };

  const handleLocalStake = () => {
    const amt = parseInt(stakeAmount, 10);
    if (!Number.isFinite(amt) || amt < 50) {
      showToast("Minimum stake is 50 XP", "");
      return;
    }
    if (amt > weeklyXP) {
      showToast("Not enough XP to stake", "");
      return;
    }
    setLocalStake(stakeXp(amt, 7));
    recordStake();
    showToast(`Staked ${amt} XP for 7 days`, "");
  };

  const handleOnchainStake = async () => {
    if (!XP_STAKE_CONTRACT || !connType) {
      showToast("On-chain stake contract not configured", "");
      return;
    }
    setBusy(true);
    try {
      const data = encodeFunctionData({ abi: XP_STAKE_ABI, functionName: "stake", args: [] });
      const value = parseEther(ethTier);
      await sendAppTransaction(
        connType,
        wallet.address,
        buildContractCall(XP_STAKE_CONTRACT as `0x${string}`, data, value)
      );
      recordStake();
      showToast(`Staked ${ethTier} ETH on-chain`, "");
      window.setTimeout(() => void refreshOnchain(), 2500);
      void refreshOnchain();
    } catch {
      showToast("Stake transaction failed", "");
    } finally {
      setBusy(false);
    }
  };

  const handleOnchainUnstake = async () => {
    if (!XP_STAKE_CONTRACT || !connType) return;
    setBusy(true);
    try {
      const data = encodeFunctionData({ abi: XP_STAKE_ABI, functionName: "unstake", args: [] });
      await sendAppTransaction(
        connType,
        wallet.address,
        buildContractCall(XP_STAKE_CONTRACT as `0x${string}`, data)
      );
      showToast("Unstaked ETH", "");
      setOnchainStake(null);
      void refreshOnchain();
    } catch {
      showToast("Unstake failed", "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`space-y-6 ${embedded ? "" : "tab-content-enter"}`}>
      {!embedded && (
      <>
      <div className="editorial-hero">
        <div className="accent-bar" />
        <div className="p-6">
        <p className="section-eyebrow mb-2">Rewards hub</p>
        <h1 className="text-2xl font-black text-white">Stake & earn</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-xl">
          On-chain ETH stake boosts your referral fee share on swaps. XP stake is tracked locally.
        </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div className="editorial-stat">
          <p className="editorial-stat-label">Weekly XP</p>
          <p className="editorial-stat-value">{weeklyXP}</p>
        </div>
        <div className="editorial-stat">
          <p className="editorial-stat-label">Quests done</p>
          <p className="editorial-stat-value">{doneQuests}</p>
        </div>
        <div className="editorial-stat">
          <p className="editorial-stat-label">Streak</p>
          <p className="editorial-stat-value">{streak}d</p>
        </div>
      </div>
      </>
      )}

      <section className="glass-panel rounded-3xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} className="text-white/60" />
          <h2 className="text-lg font-black text-white">On-chain ETH stake</h2>
          {hasOnchainStake && (
            <span className="editorial-badge">{onchainMult}× referrer boost</span>
          )}
        </div>

        {onchainLoading && !hasOnchainStake ? (
          <p className="text-sm text-slate-500">Loading on-chain stake…</p>
        ) : hasOnchainStake && onchainStake ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              <span className="font-black text-white font-mono">
                {formatEther(onchainStake.amount)} ETH
              </span>{" "}
              staked · tier {onchainStake.tier}
            </p>
            <div
              className={`rounded-xl border px-3 py-2.5 ${
                canUnstakeOnchain
                  ? "border-emerald-500/25 bg-emerald-500/8"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <p
                className={`text-xs font-bold ${
                  canUnstakeOnchain ? "text-emerald-300" : "text-slate-400"
                }`}
                data-tick={tick}
              >
                {canUnstakeOnchain
                  ? "Lock period ended — you can withdraw your ETH"
                  : `Locked · ${formatStakeCountdown(onchainStake.unlockAt)}`}
              </p>
              {!canUnstakeOnchain && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Unlocks {new Date(onchainStake.unlockAt).toLocaleString()}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={!canUnstakeOnchain || busy}
              onClick={() => void handleOnchainUnstake()}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-black border transition-colors ${
                canUnstakeOnchain
                  ? "btn-primary"
                  : "border-white/10 text-slate-500 disabled:opacity-50"
              }`}
            >
              <Unlock size={14} />
              {canUnstakeOnchain ? "Withdraw ETH" : "Withdraw ETH (locked)"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-2">
              {STAKE_TIERS.map((t) => (
                <button
                  key={t.eth}
                  type="button"
                  onClick={() => setEthTier(t.eth)}
                  className={`rounded-xl border p-3 text-left transition-colors ${
                    ethTier === t.eth
                      ? "border-white/20 bg-white/[0.06]"
                      : "border-white/10 bg-black/20 hover:border-white/15"
                  }`}
                >
                  <p className="text-xs font-black text-white">{t.label}</p>
                  <p className="text-[10px] text-slate-500">{t.eth} ETH · {t.mult}</p>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy || !XP_STAKE_CONTRACT}
              onClick={() => void handleOnchainStake()}
              className="px-4 py-2.5 rounded-xl text-sm font-black btn-primary disabled:opacity-40"
            >
              Stake {ethTier} ETH for 7 days
            </button>
            {!XP_STAKE_CONTRACT && (
              <p className="text-[10px] text-slate-600">
                Deploy <code className="text-slate-400">XpStake.sol</code> and set{" "}
                <code className="text-slate-400">NEXT_PUBLIC_XP_STAKE_CONTRACT</code> in{" "}
                <code className="text-slate-400">.env.local</code>.
              </p>
            )}
          </div>
        )}
        <p className="text-[10px] text-slate-500 mt-3">
          On-chain stake shifts extra fee share from platform → you when you&apos;re the referrer on
          swaps (live in app swaps).
        </p>
      </section>

      <section className="glass-panel rounded-3xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lock size={16} className="text-white/60" />
          <h2 className="text-lg font-black text-white">XP stake (local)</h2>
          {localMult > 1 && (
            <span className="editorial-badge">{localMult}× tracked</span>
          )}
        </div>

        {localStake ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              <span className="font-black text-white">{localStake.amount} XP</span> staked
              {canUnstakeLocal ? (
                <span className="text-emerald-400"> · ready to unstake</span>
              ) : (
                <span> · {stakeDaysRemaining(localStake)} days left</span>
              )}
            </p>
            <button
              type="button"
              disabled={!canUnstakeLocal}
              onClick={() => {
                unstakeXp();
                setLocalStake(null);
                showToast("XP unstaked", "");
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black btn-secondary disabled:opacity-40"
            >
              <Unlock size={14} /> Unstake XP
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase">Amount (XP)</label>
              <input
                type="number"
                min={50}
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="mt-1 block w-32 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-mono text-white"
              />
            </div>
            <button
              type="button"
              onClick={handleLocalStake}
              className="px-4 py-2.5 rounded-xl text-sm font-black btn-primary"
            >
              Stake 7 days
            </button>
          </div>
        )}
      </section>

      {!embedded && (
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/?tab=checkin"
          className="quest-card p-4 transition-colors group"
        >
          <Flame size={18} className="text-white/50 mb-2" />
          <p className="font-black text-white">Daily check-in</p>
          <p className="text-[11px] text-slate-500 mt-1">Earn XP & maintain streak</p>
        </Link>
        <Link
          href="/?tab=achievements"
          className="quest-card p-4 transition-colors group"
        >
          <Trophy size={18} className="text-white/50 mb-2" />
          <p className="font-black text-white">Mint badges</p>
          <p className="text-[11px] text-slate-500 mt-1">Onchain NFT achievements</p>
        </Link>
      </div>
      )}

      {embedded ? (
        <Link
          href="/?tab=achievements"
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:border-amber-400/30 transition-colors group block"
        >
          <Trophy size={18} className="text-white/50 mb-2" />
          <p className="font-black text-white">Mint badges</p>
          <p className="text-[11px] text-slate-500 mt-1">Onchain NFT achievements</p>
        </Link>
      ) : null}

      <div className="glass-panel rounded-2xl p-4 flex items-start gap-3">
        <Sparkles size={16} className="text-white/50 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Creator fee splits (50/30/20) pay referrers on every swap through the app. On-chain stake
          increases your referrer share when others use your link.
        </p>
      </div>
    </div>
  );
}
