"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback, createContext, useContext, createElement, type ReactNode } from "react";
import sdk from "@farcaster/miniapp-sdk";
import { connectAppWallet } from "@/lib/utils/mini-app-connect";
import { getEip1193Provider } from "@/app/connection";
import { fetchWalletAnalysis, fetchWalletAnalysisQuick, fetchWalletBootstrap, pollWalletHistorySync } from "@/lib/api/wallet-analysis-client";
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
  readLocalCheckInToday,
} from "@/lib/utils/check-in-status";
import { clearWalletCache } from "@/lib/utils/wallet-cache";
import { buildPendingWalletShell } from "@/lib/wallet/pending-shell";
import { mergeWalletMetricsMax } from "@/lib/wallet/merge-metrics";
import { applyPartialSyncPatch } from "@/lib/wallet/merge-partial-sync";
import type { AnalyzeWalletResult, ConnectionType, DayStats, WalletData } from "@/lib/types/wallet";
import {
  getCalendarKeys,
} from "@/lib/utils/calendar-rollover";
import { getCapabilities } from "@/lib/utils/paymaster";
import {
  getReferralCode,
} from "@/lib/utils/share";
import {
  clearConnType,
  persistConnType,
  readConnType,
  resolveActiveConnType,
} from "@/lib/utils/wallet-connection";
import {
  clearPersistedWalletAddress,
  isStandaloneWalletRoute,
  persistWalletAddress,
  readPersistedWalletAddress,
} from "@/lib/utils/wallet-persist";
import {
  readStoredReferrer,
  registerReferralJoin,
  fetchReferralStats,
  storeReferrer,
} from "@/lib/utils/referral";
import {
  bumpWeeklyTxKey,
  currentWeekKey,
  deriveTxKeysFromAnalysis,
  ensureSessionStorageVersion,
  mergeTxKeyCounters,
  syncSessionFromAnalysis,
} from "@/lib/utils/wallet-session";
import { writeLocalGmTime, writeLocalGnTime } from "@/lib/utils/daily-actions";
import {
  recordConfirmedInAppAction,
} from "@/lib/utils/daily-points";
import { sendAppTransaction } from "@/lib/utils/send-app-tx";
import { syncTabUrl, resolveTabFromUrl } from "@/lib/utils/app-url";
import {
  readGuestResume,
  clearGuestResume,
} from "@/lib/utils/guest-resume";
import { useSiweAuth } from "@/hooks/useSiweAuth";

import {
  type AppTab,
  resolveInitialTab,
  analysisNeedsActivityRefresh,
} from "./wallet/wallet-utils";
import { useDailyActions } from "./wallet/useDailyActions";
import { useAppTransactions } from "./wallet/useAppTransactions";
export type { AppTab };

export type WalletAppState = ReturnType<typeof useWalletAppController>;

function useWalletAppController() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [connType, setConnType] = useState<ConnectionType | null>(null);
  const [sessionBootstrapped, setSessionBootstrapped] = useState(false);
  const {
    siweAuthenticated,
    siweSessionChecked,
    siweSigningIn,
    siweSignIn,
    siweSignOut,
    refreshSiweSession,
  } = useSiweAuth(wallet?.address, connType);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<AppTab>("launchpad");
  const [minting, setMinting] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selDay, setSelDay] = useState<DayStats | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingTx = useRef<Set<string>>(new Set());
  const connectingRef = useRef(false);
  const autoResumeRef = useRef(false);
  const historySyncGen = useRef(0);
  const latestDaysRef = useRef(0);
  const calendarRef = useRef(getCalendarKeys());
  const lockWalletCoreRef = useRef<(w: WalletData) => void>(() => {});
  const analyzeWalletRef = useRef<(address: string, opts?: { background?: boolean }) => Promise<void>>(() => Promise.resolve());
  const [miniAppIdentity, setMiniAppIdentity] = useState<MiniAppIdentity | null>(
    null
  );
  const [sponsored, setSponsored] = useState(0);
  const [toast, setToast] = useState<{ msg: string; hash: string } | null>(
    null
  );
  const [refCopied, setRefCopied] = useState(false);
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
  const [referralInvites, setReferralInvites] = useState(0);

  const txCaps = getCapabilities();

  const showToast = useCallback((msg: string, hash: string) => {
    setToast({ msg, hash });
    setTimeout(() => setToast(null), 6000);
  }, []);

  const {
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
  } = useDailyActions({
    wallet,
    setWallet,
    showToast,
    setPointsRevision,
  });

  const {
    launchLoading,
    swapLoading,
    b20Activated,
    handleLaunchB20,
    handleTokenSwap,
    handleSeedLiquidity,
    handleUnwrapWeth,
    resetTransactionsState,
  } = useAppTransactions({
    wallet,
    connType,
    setConnType,
    showToast,
    setPointsRevision,
    setTxKeys,
    setSponsored,
    siweAuthenticated,
    siweSignIn,
  });

  const loadX402PremiumState = useCallback((address: string) => {
    void fetchReferralStats(address).then((s) => {
      setReferralInvites(s.invites ?? 0);
    });
  }, []);

  // Restore last session before paint so Explore → Profile never flashes "Connect".
  useLayoutEffect(() => {
    const savedType = readConnType();
    const savedAddr = readPersistedWalletAddress();
    if (savedType && savedAddr) {
      setConnType(savedType);
      setWallet(buildPendingWalletShell(savedAddr));
      loadX402PremiumState(savedAddr);
      }
    setSessionBootstrapped(true);
  }, [loadX402PremiumState]);

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
      if (r) storeReferrer(r);
      const card = p.get("card");
      if (card) localStorage.setItem("base_redeem_card", card);
      const syncTabFromLocation = () => {
        const path = window.location.pathname;
        if (path.startsWith("/swap")) {
          setTab("swap");
          return;
        }
        if (path.startsWith("/explore")) {
          setTab("launchpad");
          return;
        }
        if (path === "/" || path === "") {
          const next = resolveTabFromUrl();
          if (next) setTab(next);
        }
      };

      onPopState = () => syncTabFromLocation();
      window.addEventListener("popstate", onPopState);
    }
    return () => {
      if (onPopState) window.removeEventListener("popstate", onPopState);
    };
  }, []);

  // Enrich restored session (provider already may have a pending shell from layout hydrate).
  useEffect(() => {
    if (!ready || !sessionBootstrapped || autoResumeRef.current || connectingRef.current) return;
    const savedType = readConnType();
    const preferred = readPersistedWalletAddress();
    if (!savedType || !preferred) return;
    if (wallet && wallet.address.toLowerCase() !== preferred) return;
    autoResumeRef.current = true;

    void (async () => {
      try {
        const provider = await getEip1193Provider(savedType);
        let accounts = (await provider.request({
          method: "eth_accounts",
        })) as string[];
        let address =
          accounts?.find((a) => a?.toLowerCase() === preferred) ??
          accounts?.find((a) => a?.startsWith("0x"));

        // Mini-app / Base Wallet: request accounts if eth_accounts is empty but session exists
        if (!address && (savedType === "farcaster" || savedType === "baseAccount")) {
          accounts = (await provider.request({
            method: "eth_requestAccounts",
          })) as string[];
          address =
            accounts?.find((a) => a?.toLowerCase() === preferred) ??
            accounts?.find((a) => a?.startsWith("0x"));
        }

        // If provider returned no accounts, the wallet is disconnected/locked.
        // Clear stale state so user lands in guest mode with full navigation.
        if (!address) {
          clearPersistedWalletAddress();
          clearConnType();
          setWallet(null);
          setConnType(null);
          autoResumeRef.current = false;
          return;
        }

        setConnType(savedType);
        persistConnType(savedType);
        persistWalletAddress(address);
        loadX402PremiumState(address);

        const shell = buildPendingWalletShell(address);
        historyCompleteRef.current = false;
        syncCompleteToastRef.current = false;
        pendingHistorySyncRef.current = null;
        historySyncRunningRef.current = false;
        walletOpGenRef.current += 1;
        historySyncGen.current += 1;
        const resumeGen = walletOpGenRef.current;
        balancesLockedRef.current = null;
        setWalletCore(null);
        setWallet(shell);
        setWalletRefreshing(true);
        void refreshSiweSession();

        void (async () => {
          const [basename, bootstrap, quick, miniIdentity] = await Promise.all([
            resolveBasenameClient(address).catch(() => null),
            fetchWalletBootstrap(address).catch(() => null),
            fetchWalletAnalysisQuick(address, false).catch(() => null),
            resolveMiniAppIdentity().catch(() => null),
          ]);
          if (walletOpGenRef.current !== resumeGen) return;
          if (miniIdentity) {
            persistMiniAppIdentity(address, miniIdentity);
            setMiniAppIdentity(miniIdentity);
          }
          const fastWallet = quick?.wallet ?? bootstrap?.wallet;
          if (!fastWallet) {
            setWalletRefreshing(false);
            setScanProgress("");
            return;
          }
          const withBasename = {
            ...fastWallet,
            basename: basename ?? fastWallet.basename ?? bootstrap?.wallet?.basename ?? null,
          };
          setWallet((prev) => {
            if (prev?.address.toLowerCase() !== address.toLowerCase()) return prev;
            return mergeWalletMetricsMax(prev, withBasename);
          });
          lockWalletCoreRef.current(mergeWalletMetricsMax(shell, withBasename));
        })();

        void analyzeWalletRef.current(address, { background: true });
      } catch (e) {
        console.warn("[wallet] silent resume failed — clearing stale session", e);
        clearPersistedWalletAddress();
        clearConnType();
        setWallet(null);
        setConnType(null);
        autoResumeRef.current = false;
      }
    })();
    // analyzeWallet / lockWalletCore are declared later; mount-time resume is intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, sessionBootstrapped]);

  useEffect(() => {
    if (wallet && scrollRef.current)
      setTimeout(() => {
        if (scrollRef.current)
          scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      }, 100);
  }, [wallet]);

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



  const currentWalletAddress = wallet?.address;
  useEffect(() => {
    if (!currentWalletAddress) return;
    void fetchReferralStats(currentWalletAddress).then((s) => {
      setReferralInvites(s.invites);
    });
  }, [currentWalletAddress]);

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
  }, [setStreak, setCheckedToday, setBoosts, setWallet, setTxKeys]);

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

  useEffect(() => {
    lockWalletCoreRef.current = lockWalletCore;
  }, [lockWalletCore]);

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
        void registerReferralJoin(address, ref);
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
              return { ...prev, basename: name };
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
            setScanProgress(msg);
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
              setScanProgress(`Syncing full history… ${nextDays} active days`);
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
              setScanProgress("");
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
        // Full Alchemy / paymaster / smart-wallet history only after paid unlock.
        // Full history sync enabled
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

        // Alchemy + Blockscout + paymaster / smart-wallet history.
        setScanProgress(background ? "Loading…" : "Analyzing wallet…");
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
    [applyAnalysis, loadX402PremiumState, lockWalletCore, showToast]
  );

  useEffect(() => {
    analyzeWalletRef.current = analyzeWallet;
  }, [analyzeWallet]);

  const handleConnect = async (type: ConnectionType) => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    try {
      setShowModal(false);
      setLoading(true);
      setScanProgress("Connecting wallet…");

      const { address: addr, connType: resolvedType } = await connectAppWallet(type);
      setConnType(resolvedType);
      persistConnType(resolvedType);
      persistWalletAddress(addr);
      clearWalletCache(addr);
      loadX402PremiumState(addr);
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
      // Don't rewrite /creator or /profile URLs — keep user on the page they connected from.
      if (!isStandaloneWalletRoute()) {
        setTab(resumeTab);
        syncTabUrl(resumeTab, { token: resume.token ?? null });
      }
      if (resume.card) localStorage.setItem("base_redeem_card", resume.card);
      clearGuestResume();
      setLoading(false);
      setScanProgress("Loading balance…");
      setWalletRefreshing(true);
      setAnalyticsSyncing(false);

      // Auto-trigger sign-in immediately after connect
      void (async () => {
        const hasSession = await refreshSiweSession();
        if (!hasSession) {
          void siweSignIn();
        }
      })();

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
                ? { ...prev, basename }
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
      const rejected = msg.toLowerCase().includes("reject") || msg.toLowerCase().includes("denied");
      showToast(
        rejected
          ? "Connection cancelled"
          : msg.includes("timed out")
            ? `❌ ${msg}`
            : `❌ ${msg}`,
        ""
      );
      setShowModal(true);
      setLoading(false);
      setScanProgress("");
    } finally {
      connectingRef.current = false;
    }
  };

  const resetSessionState = useCallback(() => {
    walletOpGenRef.current += 1;
    historySyncGen.current += 1;
    pendingHistorySyncRef.current = null;
    historyCompleteRef.current = false;
    historySyncRunningRef.current = false;
    syncCompleteToastRef.current = false;
    startHistorySyncRef.current = null;
    autoResumeRef.current = false;
    setWalletCore(null);
    setWallet(null);
    setConnType(null);
    clearConnType();
    clearPersistedWalletAddress();
    resetDailyActions();
    resetTransactionsState();
    setMiniAppIdentity(null);
    setSponsored(0);
    setAnalyticsSyncing(false);
    setWalletRefreshing(false);
    setScanProgress("");
    pendingTx.current.clear();
  }, [resetDailyActions, resetTransactionsState]);

  const handleDisconnect = () => {
    const address = wallet?.address;
    if (address) {
      clearWalletCache(address);
    }
    clearPersistedWalletAddress();
    void siweSignOut();
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
        recordConfirmedInAppAction(
          wallet.address,
          "gm",
          nextKeys.gm ?? 0
        );
        writeLocalGmTime(wallet.address);
        setPointsRevision((n) => n + 1);
        if (hash) {
          showToast("☀️ GM on Base recorded!", hash);
        }
      } else if (type === "gn") {
        const nextKeys = bumpWeeklyTxKey(wallet.address, "gn");
        setTxKeys((k) => ({ ...k, ...nextKeys }));
        recordConfirmedInAppAction(
          wallet.address,
          "gn",
          nextKeys.gn ?? 0
        );
        writeLocalGnTime(wallet.address);
        setPointsRevision((n) => n + 1);
        if (hash) {
          showToast("🌙 GN on Base recorded!", hash);
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

  const walletScanComplete = Boolean(
    wallet &&
      !loading &&
      !analyticsSyncing &&
      wallet.recommendation !== "Fetching onchain data…"
  );

  const ref = wallet ? getReferralCode(wallet.address) : "";

  return {
    wallet,
    walletCore,
    connType,
    loading,
    tab,
    setTab,
    minting,
    ready,
    sessionBootstrapped,
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
    refCopied,
    setRefCopied,
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
    launchLoading,
    swapLoading,
    b20Activated,
    handleLaunchB20,
    handleTokenSwap,
    handleSeedLiquidity,
    handleUnwrapWeth,
    referralInvites,
    boostCall,
    gmCall,
    gnCall,
    ciCall,
    txCaps,
    ref,
    showToast,
    handleConnect,
    handleDisconnect,
    handleCheckInSuccess,
    handleBoostSuccess,
    syncCheckInStatus,
    doNativeTx,
    pointsRevision,
    setPointsRevision,
    siweAuthenticated,
    siweSessionChecked,
    siweSigningIn,
    siweSignIn,
    siweSignOut,  };
}

const WalletAppContext = createContext<WalletAppState | null>(null);

export function WalletAppProvider({ children }: { children: ReactNode }) {
  const value = useWalletAppController();
  return createElement(WalletAppContext.Provider, { value }, children);
}

/** Shared wallet session — must be used under WalletAppProvider. */
export function useWalletApp(): WalletAppState {
  const ctx = useContext(WalletAppContext);
  if (!ctx) {
    throw new Error("useWalletApp must be used within WalletAppProvider");
  }
  return ctx;
}
