"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Wallet,
  Eye,
  EyeOff,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Plus,
  Search,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
} from "lucide-react";
import TokenLogo from "@/components/ui/TokenLogo";
import { formatUsd } from "@/lib/launchpad/format";
import type { UseWalletHoldingsReturn, HoldingsFilter } from "@/hooks/useWalletHoldings";
import type { PortfolioToken } from "@/lib/portfolio/types";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";

interface HoldingsDrawerProps {
  open: boolean;
  onClose: () => void;
  holdingsState: UseWalletHoldingsReturn;
  onSelectToken: (counter: SwapCounter) => void;
}

export default function HoldingsDrawer({
  open,
  onClose,
  holdingsState,
  onSelectToken,
}: HoldingsDrawerProps) {
  const {
    visibleTokens,
    allTokens,
    hiddenTokens,
    unpricedTokens,
    dustTokens,
    totalUsd,
    tokensUsd,
    defiUsd,
    includeDefiInTotal,
    setIncludeDefiInTotal,
    defiBreakdown,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    showDust,
    setShowDust,
    showHidden,
    setShowHidden,
    loading,
    isPartial,
    warning,
    secondsAgo,
    isWrongNetwork,
    switchToBase,
    addCustomToken,
    refresh,
    normalizedAddress,
  } = holdingsState;

  const [copied, setCopied] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [addingToken, setAddingToken] = useState(false);

  // Unverified token confirmation state
  const [unverifiedPendingToken, setUnverifiedPendingToken] = useState<PortfolioToken | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (unverifiedPendingToken) {
          setUnverifiedPendingToken(null);
        } else if (showAddModal) {
          setShowAddModal(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, showAddModal, unverifiedPendingToken]);

  const handleCopyAddress = () => {
    if (!normalizedAddress) return;
    navigator.clipboard.writeText(normalizedAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    setAddingToken(true);
    setCustomError(null);
    const res = await addCustomToken(customInput.trim());
    setAddingToken(false);
    if (res.success) {
      setCustomInput("");
      setShowAddModal(false);
      await refresh();
    } else {
      setCustomError(res.error || "Failed to add token");
    }
  };

  const handleTokenClick = (token: PortfolioToken) => {
    if (!token.hasTradeRoute) {
      // Still allow selecting, but if unverified, prompt confirmation
    }
    if (!token.isVerified && !token.isStock) {
      setUnverifiedPendingToken(token);
      return;
    }
    onSelectToken(token.counter);
    onClose();
  };

  const confirmUnverifiedSelection = () => {
    if (unverifiedPendingToken) {
      onSelectToken(unverifiedPendingToken.counter);
      setUnverifiedPendingToken(null);
      onClose();
    }
  };

  const shortAddress = useMemo(() => {
    if (!normalizedAddress) return "";
    return `${normalizedAddress.slice(0, 6)}…${normalizedAddress.slice(-4)}`;
  }, [normalizedAddress]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Wallet Tokens on Base"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-[var(--overlay)] backdrop-blur-sm cursor-pointer"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer Sheet */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="relative z-10 w-full sm:max-w-md h-full flex flex-col bg-[var(--surface-3)] border-l border-[var(--border-subtle)] shadow-[var(--shadow-card)] overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] bg-[var(--surface)] shrink-0 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center shrink-0">
                    <Wallet size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-[var(--ink)] leading-tight">
                        Balances on Base
                      </h2>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--brand-soft)] text-[var(--brand)]">
                        8453
                      </span>
                    </div>
                    {shortAddress && (
                      <button
                        type="button"
                        onClick={handleCopyAddress}
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--ink-muted)] hover:text-[var(--brand)] transition-colors mt-0.5 cursor-pointer"
                        title="Click to copy connected wallet address"
                      >
                        <span>{shortAddress}</span>
                        {copied ? (
                          <Check size={11} className="text-emerald-500" />
                        ) : (
                          <Copy size={11} />
                        )}
                        {copied && (
                          <span className="text-[10px] font-sans text-emerald-500 font-semibold">
                            Copied!
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="p-2 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                    title="Add custom token by contract address"
                    aria-label="Add token by address"
                  >
                    <Plus size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void refresh()}
                    disabled={loading}
                    aria-label="Refresh holdings"
                    className="p-2 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer disabled:opacity-50"
                    title={`Refresh holdings (${secondsAgo}s ago)`}
                  >
                    <RefreshCw
                      size={15}
                      className={loading ? "animate-spin text-[var(--brand-text)]" : ""}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close drawer"
                    className="p-2 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Total USD Summary & Breakdown */}
              <div className="rounded-xl p-3.5 bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-semibold text-[var(--ink-muted)] uppercase tracking-wider">
                    Total Portfolio Value
                  </span>
                  <span className="text-lg font-black font-mono text-[var(--ink)] tabular-nums">
                    {formatUsd(totalUsd)}
                  </span>
                </div>

                {/* Sub-breakdown line */}
                <div className="flex flex-wrap items-center justify-between text-[11px] text-[var(--ink-muted)] pt-1 border-t border-[var(--border-subtle)]/60">
                  <div className="flex items-center gap-1.5">
                    <span>Priced: <strong className="text-[var(--ink)] font-mono">{formatUsd(tokensUsd)}</strong></span>
                    {unpricedTokens.length > 0 && (
                      <span className="text-[var(--ink-dim)]">
                        · +{unpricedTokens.length} unpriced
                      </span>
                    )}
                  </div>
                  {defiUsd > 0 && (
                    <button
                      type="button"
                      onClick={() => setIncludeDefiInTotal(!includeDefiInTotal)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--brand)] hover:underline cursor-pointer"
                      title="Toggle inclusion of DeFi deposits in the total"
                    >
                      <Layers size={11} />
                      <span>DeFi: {formatUsd(defiUsd)} {includeDefiInTotal ? "(Included)" : "(Excluded)"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Note on other networks */}
              <p className="text-[10px] text-[var(--ink-dim)] px-1">
                Base mainnet tokens only. Holdings on Ethereum, Arbitrum, or Polygon are not included in this total.
              </p>
            </div>

            {/* Network Alert (if connected to wrong chain) */}
            {isWrongNetwork && (
              <div className="p-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-500 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={15} className="shrink-0" />
                  <span>Wallet is on another network. Switch to Base to view real balances.</span>
                </div>
                <button
                  type="button"
                  onClick={() => void switchToBase()}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-black shrink-0 hover:bg-amber-400 cursor-pointer"
                >
                  Switch to Base
                </button>
              </div>
            )}

            {/* Fallback Warning if Indexer partially failed */}
            {isPartial && warning && (
              <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-500 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5 truncate">
                  <AlertTriangle size={13} className="shrink-0" />
                  <span className="truncate">{warning}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="font-bold underline ml-2 shrink-0 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Search Box & Filters */}
            <div className="p-3 bg-[var(--surface-2)]/60 border-b border-[var(--border-subtle)] space-y-2 shrink-0">
              <div className="relative flex items-center">
                <Search size={14} className="absolute left-3 text-[var(--ink-dim)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search token name, symbol, or address…"
                  className="w-full pl-9 pr-8 py-2 rounded-xl text-xs bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--ink)] placeholder:text-[var(--ink-dim)] focus:outline-none focus:border-[var(--brand)] transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 p-1 text-[var(--ink-dim)] hover:text-[var(--ink)]"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                  {(
                    [
                      { id: "all", label: `All (${allTokens.length})` },
                      { id: "priced", label: `Priced (${allTokens.filter((t) => t.usdValue != null).length})` },
                      { id: "unpriced", label: `Unpriced (${unpricedTokens.length})` },
                      { id: "hidden", label: `Hidden (${hiddenTokens.length})` },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilter(tab.id as HoldingsFilter)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer ${
                        filter === tab.id
                          ? "bg-[var(--brand)] text-white shadow-xs"
                          : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Dust toggle */}
                {dustTokens.length > 0 && filter !== "hidden" && (
                  <button
                    type="button"
                    onClick={() => setShowDust(!showDust)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--ink-muted)] hover:text-[var(--brand)] transition-colors shrink-0 cursor-pointer"
                    title={showDust ? "Hide balances under $0.01" : "Show small balances (<$0.01)"}
                  >
                    {showDust ? <EyeOff size={12} /> : <Eye size={12} />}
                    <span>{showDust ? "Hide dust" : "Show dust"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Hidden Spam Warning Banner if filter is 'hidden' */}
            {filter === "hidden" && (
              <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-500 text-[11px] flex items-start gap-2">
                <ShieldAlert size={14} className="shrink-0 mt-0.5" />
                <span>
                  <strong>Caution:</strong> These tokens are hidden because they match airdrop scam or phishing patterns. Never visit websites referenced in scam token names.
                </span>
              </div>
            )}

            {/* Token List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
              {loading && visibleTokens.length === 0 ? (
                // Skeletons
                <div className="space-y-2 p-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="h-16 rounded-xl bg-[var(--surface-2)] animate-pulse border border-[var(--border-subtle)]"
                    />
                  ))}
                </div>
              ) : visibleTokens.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-56 gap-2 text-center p-6">
                  <p className="text-sm font-semibold text-[var(--ink)]">
                    {searchQuery ? "No matching tokens found" : "No tokens found on Base for this address"}
                  </p>
                  <p className="text-xs text-[var(--ink-muted)] max-w-xs">
                    {searchQuery
                      ? "Try searching for a different token ticker or paste an ERC-20 contract address."
                      : "Deposit ETH or trade on Base mainnet to see tokens appear here."}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(true)}
                    className="mt-3 px-3 py-1.5 rounded-xl text-xs font-bold btn-primary inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add custom token</span>
                  </button>
                </div>
              ) : (
                visibleTokens.map((t) => {
                  const key = t.address ? `${t.address}-${t.symbol}` : `eth-${t.symbol}`;
                  const isUp = (t.priceChange24h ?? 0) >= 0;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleTokenClick(t)}
                      className="pop-row w-full flex items-center justify-between p-3 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border-subtle)] transition-all cursor-pointer group text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <TokenLogo
                          address={t.address}
                          symbol={t.symbol}
                          src={t.logo}
                          size={36}
                          shape="rounded-xl"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="font-bold text-sm text-[var(--ink)] truncate group-hover:text-[var(--brand)] transition-colors">
                              {t.symbol}
                            </p>
                            {t.isStock && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20">
                                Stock
                              </span>
                            )}
                            {t.isB20 && !t.isStock && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/10 text-purple-500 border border-purple-500/20">
                                B20
                              </span>
                            )}
                            {!t.isVerified && !t.isStock && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                Unverified
                              </span>
                            )}
                            {t.isSpam && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                Phishing Risk
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
                            <span className="font-mono tabular-nums">{t.balanceFormatted}</span>
                            <span className="text-[var(--ink-dim)] truncate">· {t.name}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0 flex items-center gap-2 pl-2">
                        <div>
                          {t.usdValue != null ? (
                            <p className="text-sm font-black text-[var(--ink)] font-mono tabular-nums">
                              {formatUsd(t.usdValue)}
                            </p>
                          ) : (
                            <span className="text-[11px] font-mono font-semibold text-[var(--ink-dim)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">
                              No price
                            </span>
                          )}

                          <div className="flex items-center justify-end gap-1.5 text-[10px]">
                            {t.priceUsd != null && (
                              <span className="text-[var(--ink-dim)] font-mono">
                                {formatUsd(t.priceUsd)}
                              </span>
                            )}
                            {t.priceChange24h != null && (
                              <span
                                className={`inline-flex items-center font-mono ${
                                  isUp ? "text-emerald-500" : "text-rose-500"
                                }`}
                              >
                                {isUp ? "+" : ""}
                                {t.priceChange24h.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </div>
                        <ArrowRight
                          size={14}
                          className="text-[var(--ink-dim)] group-hover:text-[var(--brand)] group-hover:translate-x-0.5 transition-all opacity-0 group-hover:opacity-100"
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-[var(--surface)] border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--ink-muted)] shrink-0">
              <span>Click any token to set as Sell asset</span>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="font-bold text-[var(--brand)] hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} />
                <span>Add Token</span>
              </button>
            </div>
          </motion.div>

          {/* Add Custom Token Modal */}
          {showAddModal && (
            <div
              className="fixed inset-0 z-60 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Add custom token"
            >
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setShowAddModal(false)}
              />
              <div className="relative z-10 w-full max-w-sm rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-[var(--ink)]">Add Custom Token</h3>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="p-1 text-[var(--ink-dim)] hover:text-[var(--ink)]"
                  >
                    <X size={16} />
                  </button>
                </div>
                <p className="text-xs text-[var(--ink-muted)]">
                  Enter an ERC-20 contract address deployed on Base mainnet. It will be saved in your browser and included in your portfolio.
                </p>

                <form onSubmit={handleAddCustom} className="space-y-3">
                  <div>
                    <input
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder="0x..."
                      autoFocus
                      className="w-full px-3 py-2.5 rounded-xl text-xs font-mono bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink)] focus:outline-none focus:border-[var(--brand)]"
                    />
                    {customError && (
                      <p className="text-[11px] text-rose-500 mt-1.5 font-medium">{customError}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addingToken || !customInput.trim()}
                      className="px-4 py-2 rounded-xl text-xs font-bold btn-primary disabled:opacity-50"
                    >
                      {addingToken ? "Validating…" : "Add Token"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Unverified Token Safety Warning Modal */}
          {unverifiedPendingToken && (
            <div
              className="fixed inset-0 z-60 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Unverified Token Warning"
            >
              <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                onClick={() => setUnverifiedPendingToken(null)}
              />
              <div className="relative z-10 w-full max-w-sm rounded-2xl bg-[var(--surface)] border border-amber-500/30 p-5 shadow-2xl space-y-4">
                <div className="flex items-center gap-2.5 text-amber-500">
                  <ShieldAlert size={22} className="shrink-0" />
                  <h3 className="text-base font-bold text-[var(--ink)]">
                    Unverified Token Warning
                  </h3>
                </div>
                <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                  <strong>{unverifiedPendingToken.name} (${unverifiedPendingToken.symbol})</strong> has not been verified by the community registry. Anyone can deploy an ERC-20 token on Base with any name.
                </p>
                <div className="rounded-xl p-3 bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-500 font-mono break-all">
                  Contract: {unverifiedPendingToken.address}
                </div>
                <p className="text-[11px] text-[var(--ink-dim)]">
                  Make sure you trust this contract address before executing swaps.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setUnverifiedPendingToken(null)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold text-[var(--ink-muted)] hover:bg-[var(--surface-2)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmUnverifiedSelection}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-black hover:bg-amber-400"
                  >
                    Proceed to Trade
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}
