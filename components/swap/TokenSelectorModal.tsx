"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2, Search, X, Clock, Check, Sparkles, Coins, Wallet, AlertTriangle } from "lucide-react";
import { useCompliance } from "@/hooks/useCompliance";
import {
  COMMON_BASE_TOKENS,
  COMMON_STOCK_TOKENS,
  type CommonToken,
} from "@/lib/launchpad/common-tokens";
import { resolveTokenByAddress } from "@/lib/api/launchpad-client";
import { commonTokenToCounter, enrichSwapCounter } from "@/lib/launchpad/token-logo";
import {
  CounterAvatar,
  ETH_COUNTER,
  counterDecimalsOf,
  counterSymbol,
  sameCounter,
  type SwapCounter,
} from "@/components/launchpad/TokenPickerDialog";
import type { TokenHolding } from "@/hooks/useWalletHoldings";
import { formatUsd } from "@/lib/launchpad/format";
import { getStockTradability } from "@/lib/stocks/stock-tradability";

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const RECENT_STORAGE_KEY = "base_swap_recent_tokens_v2";

const STOCK_CATEGORIES = [
  "All",
  "Tech",
  "Finance",
  "Consumer",
  "Crypto-related",
  "Healthcare",
  "Energy",
] as const;

type PickerTab = "crypto" | "stocks" | "holdings";

interface TokenSelectorModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (counter: SwapCounter) => void;
  excludeAddress?: string | null;
  title?: string;
  holdings?: TokenHolding[];
  walletAddress?: string | null;
}

export default function TokenSelectorModal({
  open,
  onClose,
  onSelect,
  excludeAddress,
  title = "Select a token",
  holdings = [],
  walletAddress,
}: TokenSelectorModalProps) {
  const [activeTab, setActiveTab] = useState<PickerTab>("crypto");
  const [stockCategory, setStockCategory] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolved, setResolved] = useState<Extract<SwapCounter, { kind: "token" }> | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [recentTokens, setRecentTokens] = useState<SwapCounter[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const compliance = useCompliance();

  const isStockSwapDisabled = !compliance.status.features["stocks.swap"];
  const isRegionRestricted = compliance.isRestricted && !compliance.canEnter;
  const isStocksTabRestricted = activeTab === "stocks" && (isStockSwapDisabled || isRegionRestricted);

  // Load recent tokens from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(RECENT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as SwapCounter[];
        if (Array.isArray(parsed)) {
          setRecentTokens(parsed.slice(0, 5));
        }
      }
    } catch {
      // ignore JSON errors
    }
  }, [open]);

  // Save token to recent tokens on select
  const saveRecent = useCallback((counter: SwapCounter) => {
    try {
      setRecentTokens((prev) => {
        const next = [counter, ...prev.filter((t) => !sameCounter(t, counter))].slice(0, 5);
        if (typeof window !== "undefined") {
          localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
        }
        return next;
      });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResolved(null);
    setResolveError(null);
    const id = window.setTimeout(() => inputRef.current?.focus(), 60);
    return () => window.clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const excluded = excludeAddress?.toLowerCase() ?? null;

  // Resolve pasted 0x contract address
  useEffect(() => {
    const raw = query.trim();
    if (!ADDRESS_RE.test(raw)) {
      setResolved(null);
      setResolveError(null);
      return;
    }
    if (COMMON_BASE_TOKENS.some((t) => t.address.toLowerCase() === raw.toLowerCase())) {
      return;
    }

    let alive = true;
    setResolving(true);
    setResolveError(null);
    void resolveTokenByAddress(raw)
      .then(({ token }) => {
        if (!alive) return;
        if (!token) {
          setResolved(null);
          setResolveError("Contract not found or not an ERC-20 on Base");
          return;
        }
        setResolved(
          enrichSwapCounter({
            kind: "token",
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals ?? 18,
            imageUrl: token.imageUrl,
          }) as Extract<SwapCounter, { kind: "token" }>
        );
      })
      .catch(() => {
        if (alive) setResolveError("Could not read contract on Base RPC");
      })
      .finally(() => {
        if (alive) setResolving(false);
      });
    return () => {
      alive = false;
    };
  }, [query]);

  // Holdings map for fast balance lookup
  const holdingsMap = useMemo(() => {
    const map = new Map<string, TokenHolding>();
    for (const h of holdings) {
      if (h.address) {
        map.set(h.address.toLowerCase(), h);
      } else if (h.symbol === "ETH") {
        map.set("eth", h);
      }
    }
    return map;
  }, [holdings]);

  // Filtered token lists
  const filteredTokens = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (activeTab === "holdings") {
      return holdings
        .filter((h) => {
          if (excluded && h.address && h.address.toLowerCase() === excluded) return false;
          if (!q) return true;
          return (
            h.symbol.toLowerCase().includes(q) ||
            h.name.toLowerCase().includes(q) ||
            (h.address && h.address.toLowerCase().includes(q))
          );
        })
        .map((h) => h.counter);
    }

    let baseList =
      activeTab === "stocks"
        ? COMMON_STOCK_TOKENS
        : COMMON_BASE_TOKENS.filter((t) => t.category !== "stock");

    if (activeTab === "stocks" && stockCategory !== "All") {
      baseList = baseList.filter((t) => t.stockCategory === stockCategory);
    }

    return baseList
      .filter((t) => {
        if (excluded && t.address.toLowerCase() === excluded) return false;
        if (!q) return true;
        return (
          t.symbol.toLowerCase().includes(q) ||
          t.name.toLowerCase().includes(q) ||
          t.address.toLowerCase().includes(q) ||
          (t.underlyingTicker && t.underlyingTicker.toLowerCase().includes(q))
        );
      })
      .map(commonTokenToCounter);
  }, [activeTab, stockCategory, query, excluded, holdings]);

  const showEth = useMemo(() => {
    if (activeTab === "stocks") return false;
    if (excluded && excluded === "eth") return false;
    const q = query.trim().toLowerCase();
    return !q || "eth".includes(q) || "ethereum".includes(q);
  }, [activeTab, excluded, query]);

  const handlePick = (counter: SwapCounter) => {
    const enriched = enrichSwapCounter(counter);
    saveRecent(enriched);
    onSelect(enriched);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            className="fixed inset-0 bg-[var(--overlay)] backdrop-blur-sm cursor-pointer"
            aria-hidden="true"
          />

          {/* Modal / Bottom Sheet Card */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="relative z-10 w-full sm:max-w-md max-h-[85vh] sm:max-h-[34rem] flex flex-col rounded-t-3xl sm:rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-3)] shadow-[var(--shadow-card)] overflow-hidden"
          >
            {/* Mobile Sheet Drag Handle */}
            <div className="w-10 h-1 rounded-full bg-[var(--border-strong)] mx-auto mt-2.5 sm:hidden" aria-hidden />

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3.5 pb-2.5">
              <h2 className="text-base font-bold text-[var(--ink)]">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close token selector"
                className="p-1.5 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search Input Box */}
            <div className="px-5 pb-2.5">
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 focus-within:border-[var(--brand-text)] focus-within:ring-2 focus-within:ring-[var(--brand)]/15 transition-all">
                <Search size={15} className="text-[var(--brand-text)] shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search token or paste 0x address…"
                  className="flex-1 bg-transparent py-2.5 text-xs sm:text-sm font-semibold text-[var(--ink)] placeholder:text-[var(--ink-dim)] placeholder:font-normal outline-none"
                />
                {resolving && (
                  <Loader2 size={15} className="animate-spin text-[var(--brand-text)] shrink-0" />
                )}
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="p-1 text-[var(--ink-dim)] hover:text-[var(--ink)] cursor-pointer"
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Recent Tokens Row */}
            {recentTokens.length > 0 && !query && (
              <div className="px-5 pb-2.5 flex items-center gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-[var(--ink-dim)] mr-1">
                  <Clock size={11} /> Recent:
                </span>
                {recentTokens.map((t) => {
                  if (excluded && t.kind === "token" && t.address.toLowerCase() === excluded) return null;
                  return (
                    <button
                      key={t.kind === "eth" ? "eth" : t.address}
                      type="button"
                      onClick={() => handlePick(t)}
                      className="pop-pill inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs font-bold text-[var(--ink)] hover:border-[var(--brand-text)] hover:text-[var(--brand-text)] transition-all cursor-pointer"
                    >
                      <CounterAvatar counter={t} size={15} />
                      <span className="font-mono">{counterSymbol(t)}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tabs Bar */}
            <div className="flex items-center gap-1 px-5 pb-2 border-b border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setActiveTab("crypto")}
                className={`pop-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "crypto"
                    ? "bg-[var(--brand)] text-white shadow-xs"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
                }`}
              >
                <Coins size={13} />
                <span>Crypto</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("stocks")}
                className={`pop-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === "stocks"
                    ? "bg-[var(--brand)] text-white shadow-xs"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
                }`}
              >
                <Sparkles size={13} />
                <span>Tokenized Stocks</span>
              </button>

              {walletAddress && (
                <button
                  type="button"
                  onClick={() => setActiveTab("holdings")}
                  className={`pop-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ml-auto ${
                    activeTab === "holdings"
                      ? "bg-[var(--brand)] text-white shadow-xs"
                      : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <Wallet size={13} />
                  <span>Your tokens ({holdings.length})</span>
                </button>
              )}
            </div>

            {/* Category Chips for Stocks */}
            {activeTab === "stocks" && (
              <div className="flex items-center gap-1.5 px-5 py-2 overflow-x-auto no-scrollbar border-b border-[var(--border-subtle)] bg-[var(--surface-2)]/50">
                {STOCK_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setStockCategory(cat)}
                    className={`pop-pill px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer ${
                      stockCategory === cat
                        ? "bg-[var(--brand)] text-white shadow-xs"
                        : "bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)] border border-[var(--border-subtle)]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Token List */}
            {isStocksTabRestricted && (
              <div className="mx-4 my-2 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle size={15} className="text-amber-500 shrink-0" />
                <span>
                  {isStockSwapDisabled
                    ? "Tokenized stock swaps are temporarily paused."
                    : "Tokenized stock features are not available in your region. You can still select holdings to sell (Exit-Only Mode)."}
                </span>
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-2 py-2 divide-y divide-[var(--border-subtle)]/40">
              {/* Resolved 0x contract token match */}
              {resolved && (
                <div className="p-1">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--brand-text)]">
                    Resolved Onchain Contract
                  </div>
                  <TokenListItem
                    counter={resolved}
                    onSelect={() => handlePick(resolved)}
                    holding={holdingsMap.get(resolved.address.toLowerCase())}
                  />
                </div>
              )}

              {resolveError && (
                <div className="p-4 text-xs font-semibold text-rose-500 bg-rose-500/10 rounded-xl my-2 text-center">
                  {resolveError}
                </div>
              )}

              {/* Native ETH */}
              {showEth && activeTab !== "holdings" && (
                <TokenListItem
                  counter={ETH_COUNTER}
                  name="Ether"
                  onSelect={() => handlePick(ETH_COUNTER)}
                  holding={holdingsMap.get("eth")}
                />
              )}

              {/* Filtered tokens */}
              {filteredTokens.length === 0 && !showEth && !resolved && !resolving ? (
                <div className="p-8 text-center text-xs text-[var(--ink-muted)]">
                  <p className="font-semibold text-sm text-[var(--ink)] mb-1">No tokens found</p>
                  <p>Check the ticker or paste any verified Base 0x address.</p>
                </div>
              ) : (
                filteredTokens.map((counter) => {
                  const key = counter.kind === "eth" ? "eth" : counter.address;
                  const holding =
                    counter.kind === "eth"
                      ? holdingsMap.get("eth")
                      : holdingsMap.get(counter.address.toLowerCase());
                  return (
                    <TokenListItem
                      key={key}
                      counter={counter}
                      onSelect={() => handlePick(counter)}
                      holding={holding}
                    />
                  );
                })
              )}
            </div>

            {/* Footer Notice */}
            <div className="p-3 bg-[var(--surface-2)] border-t border-[var(--border-subtle)] text-center text-[11px] text-[var(--ink-dim)]">
              Verified Base tokens &amp; B20 Equities · Paste any <span className="font-mono">0x…</span> address
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function TokenListItem({
  counter,
  name,
  onSelect,
  holding,
}: {
  counter: SwapCounter;
  name?: string;
  onSelect: () => void;
  holding?: TokenHolding;
}) {
  const sym = counterSymbol(counter);
  const displayName = name ?? (counter.kind === "token" ? (counter as any).name ?? sym : "Ethereum");
  const tradability =
    counter.kind === "token" && counter.symbol.endsWith("c")
      ? getStockTradability(counter.address)
      : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="pop-row w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-[var(--surface-2)] transition-all cursor-pointer group text-left"
    >
      <div className="flex items-center gap-3 min-w-0">
        <CounterAvatar counter={counter} size={32} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-sm text-[var(--ink)] group-hover:text-[var(--brand-text)] transition-colors">
              {sym}
            </span>
            {counter.kind === "token" && counter.symbol.endsWith("c") && (
              <>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Stock
                </span>
                {tradability && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                      tradability.status === "tradable"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : tradability.status === "low_liquidity"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                          : tradability.status === "no_pool"
                            ? "bg-neutral-500/10 text-neutral-400 border-neutral-500/20"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    }`}
                  >
                    {tradability.status === "tradable"
                      ? "Tradable"
                      : tradability.status === "low_liquidity"
                        ? "Low Liquidity"
                        : tradability.status === "no_pool"
                          ? "No Pool"
                          : "Restricted"}
                  </span>
                )}
              </>
            )}
          </div>
          <p className="text-[11px] text-[var(--ink-dim)] truncate">
            {displayName}
          </p>
        </div>
      </div>

      {holding && holding.balance > 0 && (
        <div className="text-right shrink-0">
          <p className="font-mono text-xs font-bold text-[var(--ink)] tabular-nums">
            {holding.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </p>
          {holding.usdValue > 0 && (
            <p className="font-mono text-[10px] text-[var(--ink-muted)] tabular-nums">
              {formatUsd(holding.usdValue)}
            </p>
          )}
        </div>
      )}
    </button>
  );
}
