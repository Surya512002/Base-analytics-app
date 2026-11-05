import { useState, useEffect, useRef, useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import type { WalletData } from "@/lib/types/wallet";
import {
  BOOSTER_ABI,
  BOOSTER_CONTRACT,
  CHECKIN_ABI,
  CHECKIN_CONTRACT,
  GM_GN_ABI,
  GM_GN_CONTRACT,
} from "@/lib/constants/contracts";
import { encodeContractCall, normalizeTxHash, type ContractCall } from "@/lib/utils/tx";
import {
  fetchCheckInStatus,
  patchCheckInInWalletCache,
  readLocalCheckInToday,
  recordCheckInSuccess,
} from "@/lib/utils/check-in-status";
import {
  bumpBoostCount,
  bumpWeeklyTxKey,
  DEFAULT_TX_KEYS,
  readPersistedTxKeys,
  writePersistedTxKeys,
} from "@/lib/utils/wallet-session";
import { writeLocalBoostTime } from "@/lib/utils/daily-actions";
import {
  recordConfirmedInAppAction,
  recordInAppTransaction,
  notifyPointsUpdated,
} from "@/lib/utils/daily-points";
import {
  getCalendarKeys,
  msUntilNextUtcDay,
} from "@/lib/utils/calendar-rollover";

export interface DailyActionCalls {
  boostCall: ContractCall[];
  gmCall: ContractCall[];
  gnCall: ContractCall[];
  ciCall: ContractCall[];
}

export function createDailyActionCalls(): DailyActionCalls {
  return {
    boostCall: [
      encodeContractCall(BOOSTER_CONTRACT as `0x${string}`, BOOSTER_ABI, "boost"),
    ],
    gmCall: [
      encodeContractCall(GM_GN_CONTRACT as `0x${string}`, GM_GN_ABI, "gm"),
    ],
    gnCall: [
      encodeContractCall(GM_GN_CONTRACT as `0x${string}`, GM_GN_ABI, "gn"),
    ],
    ciCall: [
      encodeContractCall(CHECKIN_CONTRACT as `0x${string}`, CHECKIN_ABI, "checkIn"),
    ],
  };
}

export interface UseDailyActionsOptions {
  wallet: WalletData | null;
  setWallet: Dispatch<SetStateAction<WalletData | null>>;
  showToast: (msg: string, hash: string) => void;
  setPointsRevision: Dispatch<SetStateAction<number>>;
}

export function useDailyActions({
  wallet,
  setWallet,
  showToast,
  setPointsRevision,
}: UseDailyActionsOptions) {
  const [boosts, setBoosts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [checkedToday, setCheckedToday] = useState(false);
  const [txKeys, setTxKeys] = useState<Record<string, number>>({
    ...DEFAULT_TX_KEYS,
  });

  const handledActionTxs = useRef<Set<string>>(new Set());
  const calendarRef = useRef(getCalendarKeys());

  const { boostCall, gmCall, gnCall, ciCall } = useMemo(
    () => createDailyActionCalls(),
    []
  );

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
  }, [wallet, syncCheckInStatus, setPointsRevision]);

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
      const expectedStreak = checkedToday
        ? Math.max(streak, 1)
        : Math.max(streak + 1, 1);
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
      recordInAppTransaction(address, { notify: false });
      const awardStreak = Math.max(status.streak, expectedStreak, 1);
      if (awardStreak > 0) setStreak(awardStreak);
      notifyPointsUpdated(address);
      setPointsRevision((n) => n + 1);
      if (txHash) {
        showToast("✅ Onchain check-in secured!", txHash);
      }
    },
    [checkedToday, showToast, streak, syncCheckInStatus, wallet, setWallet, setPointsRevision]
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
      recordConfirmedInAppAction(
        address,
        "boost",
        nextKeys.boost ?? 0
      );
      writeLocalBoostTime(address);
      setPointsRevision((n) => n + 1);
      if (txHash) {
        showToast("⚡ Daily boost secured on Base!", txHash);
      }
    },
    [showToast, setPointsRevision]
  );

  const resetDailyActions = useCallback(() => {
    setBoosts(0);
    setStreak(0);
    setCheckedToday(false);
    setTxKeys({ ...DEFAULT_TX_KEYS });
    handledActionTxs.current.clear();
    calendarRef.current = getCalendarKeys();
  }, []);

  return {
    boosts,
    setBoosts,
    streak,
    setStreak,
    checkedToday,
    setCheckedToday,
    txKeys,
    setTxKeys,
    boostCall,
    gmCall,
    gnCall,
    ciCall,
    syncCheckInStatus,
    handleCheckInSuccess,
    handleBoostSuccess,
    resetDailyActions,
  };
}
