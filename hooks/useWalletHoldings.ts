"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { getAddress } from "viem";
import type { PortfolioToken, PortfolioResponse, DefiPortfolioBreakdown } from "@/lib/portfolio/types";
import { ensureBaseNetwork } from "@/lib/utils/wallet-connection";
import { DUST_USD_THRESHOLD } from "@/lib/portfolio/spam-filter";

export type HoldingsFilter = "all" | "priced" | "unpriced" | "hidden";

export type { PortfolioToken, TokenHolding } from "@/lib/portfolio/types";

export interface UseWalletHoldingsReturn {
  // Token lists
  allTokens: PortfolioToken[]; // All discovered non-spam tokens + custom tokens
  visibleTokens: PortfolioToken[]; // Filtered tokens according to active filter, dust, and search
  hiddenTokens: PortfolioToken[]; // Spam/airdrop scam tokens
  dustTokens: PortfolioToken[]; // Tokens with USD value < $0.01
  unpricedTokens: PortfolioToken[]; // Valid tokens without price feed

  // Financial aggregates
  totalUsd: number; // Total portfolio USD (priced tokens + optional DeFi)
  tokensUsd: number; // Sum of priced tokens only
  defiUsd: number; // Net DeFi value (supplied - borrowed)
  includeDefiInTotal: boolean;
  setIncludeDefiInTotal: (include: boolean) => void;
  defiBreakdown?: DefiPortfolioBreakdown;

  // Counts
  totalCount: number; // Total active non-spam tokens
  pricedCount: number;
  unpricedCount: number;
  dustCount: number;
  hiddenCount: number;
  drawerTokenCount: number; // Count matching visible drawer list

  // State & Filters
  filter: HoldingsFilter;
  setFilter: (f: HoldingsFilter) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  showDust: boolean;
  setShowDust: (show: boolean) => void;
  showHidden: boolean;
  setShowHidden: (show: boolean) => void;

  // Status & Warnings
  loading: boolean;
  isPartial: boolean;
  warning?: string;
  lastUpdated: number | null;
  secondsAgo: number;

  // Network Check (Base Mainnet 8453)
  isWrongNetwork: boolean;
  switchToBase: () => Promise<void>;

  // Custom tokens management ("Add token by address")
  customTokens: string[];
  addCustomToken: (address: string) => Promise<{ success: boolean; error?: string }>;
  removeCustomToken: (address: string) => void;

  // Actions
  refresh: () => Promise<void>;
  normalizedAddress: `0x${string}` | null;
}

export function useWalletHoldings(
  walletAddress: string | null | undefined
): UseWalletHoldingsReturn {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<HoldingsFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDust, setShowDust] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [includeDefiInTotal, setIncludeDefiInTotal] = useState(true);
  const [customTokens, setCustomTokens] = useState<string[]>([]);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);

  const prevAddressRef = useRef<string | null>(null);

  // Normalize wallet address to EIP-55 checksum
  const normalizedAddress = useMemo<`0x${string}` | null>(() => {
    if (!walletAddress || !walletAddress.startsWith("0x") || walletAddress.length !== 42) {
      return null;
    }
    try {
      return getAddress(walletAddress.trim());
    } catch {
      return null;
    }
  }, [walletAddress]);

  // Load custom tokens from localStorage per wallet
  useEffect(() => {
    if (!normalizedAddress) {
      setCustomTokens([]);
      return;
    }
    try {
      const storageKey = `base_custom_tokens_${normalizedAddress.toLowerCase()}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setCustomTokens(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [normalizedAddress]);

  // Check network chain ID (Base mainnet = 8453 / 0x2105)
  const checkNetwork = useCallback(async () => {
    if (typeof window === "undefined") return;
    const eth = (window as unknown as { ethereum?: { request: (args: { method: string }) => Promise<unknown> } }).ethereum;
    if (eth?.request) {
      try {
        const chainId = (await eth.request({ method: "eth_chainId" })) as string;
        const normalizedChain = chainId?.toLowerCase();
        setIsWrongNetwork(normalizedChain !== "0x2105" && normalizedChain !== "8453");
      } catch {
        setIsWrongNetwork(false);
      }
    }
  }, []);

  useEffect(() => {
    void checkNetwork();
    if (typeof window === "undefined") return;
    const eth = (window as unknown as { ethereum?: { on?: (event: string, cb: () => void) => void; removeListener?: (event: string, cb: () => void) => void } }).ethereum;
    if (eth?.on) {
      const onChainChanged = () => void checkNetwork();
      eth.on("chainChanged", onChainChanged);
      return () => {
        eth.removeListener?.("chainChanged", onChainChanged);
      };
    }
  }, [checkNetwork]);

  const switchToBase = useCallback(async () => {
    if (typeof window === "undefined") return;
    const eth = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
    if (eth) {
      await ensureBaseNetwork(eth);
      await checkNetwork();
    }
  }, [checkNetwork]);

  // Fetch portfolio data from server route
  const fetchPortfolio = useCallback(async () => {
    if (!normalizedAddress) {
      setData(null);
      return;
    }

    setLoading(true);
    try {
      const customParam = customTokens.length > 0 ? `&customTokens=${encodeURIComponent(customTokens.join(","))}` : "";
      const res = await fetch(`/api/portfolio?address=${encodeURIComponent(normalizedAddress)}${customParam}&defi=true`);
      if (!res.ok) throw new Error("Failed to load portfolio");
      const json = (await res.json()) as PortfolioResponse;
      setData(json);
    } catch (e) {
      console.error("[useWalletHoldings] Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [normalizedAddress, customTokens]);

  // Clear data immediately on address change / disconnect
  useEffect(() => {
    if (normalizedAddress !== prevAddressRef.current) {
      setData(null);
      prevAddressRef.current = normalizedAddress;
    }
    void fetchPortfolio();
  }, [normalizedAddress, fetchPortfolio]);

  // Auto-refresh interval (every 30s) while tab is visible
  useEffect(() => {
    if (!normalizedAddress) return;

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        void fetchPortfolio();
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [normalizedAddress, fetchPortfolio]);

  // Refetch when tab regains focus
  useEffect(() => {
    if (!normalizedAddress) return;

    const onFocus = () => void fetchPortfolio();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchPortfolio();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [normalizedAddress, fetchPortfolio]);

  // Refetch on transaction confirmed custom events
  useEffect(() => {
    if (!normalizedAddress) return;

    const onTxConfirmed = () => {
      // Delay slightly so RPC indexer has latest block state
      setTimeout(() => {
        void fetchPortfolio();
      }, 1500);
    };

    window.addEventListener("base-tx-confirmed", onTxConfirmed);
    window.addEventListener("swap-success", onTxConfirmed);
    return () => {
      window.removeEventListener("base-tx-confirmed", onTxConfirmed);
      window.removeEventListener("swap-success", onTxConfirmed);
    };
  }, [normalizedAddress, fetchPortfolio]);

  // Track "Updated Xs ago" timer
  useEffect(() => {
    if (!data?.updatedAt) return;
    const tick = () => {
      const elapsed = Math.max(0, Math.floor((Date.now() - data.updatedAt) / 1000));
      setSecondsAgo(elapsed);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [data?.updatedAt]);

  // Add custom token by address
  const addCustomToken = useCallback(
    async (rawTokenAddress: string) => {
      if (!normalizedAddress) return { success: false, error: "Wallet not connected" };
      let cleanAddr: `0x${string}`;
      try {
        cleanAddr = getAddress(rawTokenAddress.trim());
      } catch {
        return { success: false, error: "Invalid contract address format" };
      }

      if (customTokens.some((a) => a.toLowerCase() === cleanAddr.toLowerCase())) {
        return { success: false, error: "Token already in your portfolio list" };
      }

      const next = [...customTokens, cleanAddr];
      setCustomTokens(next);
      try {
        localStorage.setItem(`base_custom_tokens_${normalizedAddress.toLowerCase()}`, JSON.stringify(next));
      } catch {
        // Ignore localStorage error
      }
      return { success: true };
    },
    [normalizedAddress, customTokens]
  );

  const removeCustomToken = useCallback(
    (tokenAddress: string) => {
      if (!normalizedAddress) return;
      const lower = tokenAddress.toLowerCase();
      const next = customTokens.filter((a) => a.toLowerCase() !== lower);
      setCustomTokens(next);
      try {
        localStorage.setItem(`base_custom_tokens_${normalizedAddress.toLowerCase()}`, JSON.stringify(next));
      } catch {
        // Ignore
      }
    },
    [normalizedAddress, customTokens]
  );

  // Group tokens
  const allTokens = useMemo(() => {
    return (data?.tokens ?? []).filter((t) => !t.isSpam);
  }, [data?.tokens]);

  const hiddenTokens = useMemo(() => {
    return (data?.tokens ?? []).filter((t) => t.isSpam);
  }, [data?.tokens]);

  const dustTokens = useMemo(() => {
    return allTokens.filter((t) => t.usdValue != null && t.usdValue < DUST_USD_THRESHOLD && t.symbol !== "ETH");
  }, [allTokens]);

  const unpricedTokens = useMemo(() => {
    return allTokens.filter((t) => t.usdValue == null);
  }, [allTokens]);

  // Calculate USD totals
  const tokensUsd = useMemo(() => {
    return data?.totalUsd ?? 0;
  }, [data?.totalUsd]);

  const defiUsd = useMemo(() => {
    return data?.defi?.netUsd ?? 0;
  }, [data?.defi?.netUsd]);

  const totalUsd = useMemo(() => {
    if (includeDefiInTotal && defiUsd > 0) {
      return tokensUsd + defiUsd;
    }
    return tokensUsd;
  }, [tokensUsd, defiUsd, includeDefiInTotal]);

  // Visible tokens according to active filter, dust toggle, and search query
  const visibleTokens = useMemo(() => {
    let pool: PortfolioToken[];

    if (filter === "hidden") {
      pool = hiddenTokens;
    } else if (filter === "priced") {
      pool = allTokens.filter((t) => t.usdValue != null);
    } else if (filter === "unpriced") {
      pool = unpricedTokens;
    } else {
      // "all"
      pool = showHidden ? (data?.tokens ?? []) : allTokens;
    }

    // Filter dust unless toggled ON
    if (!showDust && filter !== "hidden") {
      pool = pool.filter((t) => {
        if (t.usdValue == null) return true; // Keep unpriced tokens visible!
        if (t.symbol === "ETH") return true;
        return t.usdValue >= DUST_USD_THRESHOLD;
      });
    }

    // Search query filter
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      pool = pool.filter(
        (t) =>
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          (t.address && t.address.toLowerCase().includes(q))
      );
    }

    return pool;
  }, [data?.tokens, allTokens, hiddenTokens, unpricedTokens, filter, showHidden, showDust, searchQuery]);

  return {
    allTokens,
    visibleTokens,
    hiddenTokens,
    dustTokens,
    unpricedTokens,
    totalUsd,
    tokensUsd,
    defiUsd,
    includeDefiInTotal,
    setIncludeDefiInTotal,
    defiBreakdown: data?.defi,
    totalCount: allTokens.length,
    pricedCount: data?.pricedCount ?? 0,
    unpricedCount: data?.unpricedCount ?? 0,
    dustCount: dustTokens.length,
    hiddenCount: hiddenTokens.length,
    drawerTokenCount: visibleTokens.length,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    showDust,
    setShowDust,
    showHidden,
    setShowHidden,
    loading,
    isPartial: data?.partial ?? false,
    warning: data?.warning,
    lastUpdated: data?.updatedAt ?? null,
    secondsAgo,
    isWrongNetwork,
    switchToBase,
    customTokens,
    addCustomToken,
    removeCustomToken,
    refresh: fetchPortfolio,
    normalizedAddress,
  };
}
