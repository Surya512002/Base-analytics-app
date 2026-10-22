"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Search, X, Sparkles, TrendingUp, Check } from "lucide-react";
import { BASE_STOCKS, type BaseStock } from "@/lib/stocks/base-stocks";
import { YIELD_VAULT_SHARES, type VaultShareInfo } from "@/lib/utils/voucher";
import type { VoucherAsset } from "@/lib/utils/voucher";
import TokenLogo from "@/components/ui/TokenLogo";

interface VoucherAssetPickerModalProps {
  open: boolean;
  onClose: () => void;
  category: "stock" | "vault";
  selectedSymbol: VoucherAsset;
  onSelect: (symbol: VoucherAsset) => void;
  userBalances?: Record<string, number>;
}

export default function VoucherAssetPickerModal({
  open,
  onClose,
  category,
  selectedSymbol,
  onSelect,
  userBalances = {},
}: VoucherAssetPickerModalProps) {
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState<string>("all");

  useEffect(() => {
    if (open) {
      setSearch("");
      setFilterTag("all");
      // Prevent background scrolling
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Filtered items
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (category === "stock") {
      return BASE_STOCKS.filter((s) => {
        const matchesQuery =
          !q ||
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q);
        const matchesTag =
          filterTag === "all" || s.category === filterTag;
        return matchesQuery && matchesTag;
      });
    } else {
      return YIELD_VAULT_SHARES.filter((v) => {
        const matchesQuery =
          !q ||
          v.symbol.toLowerCase().includes(q) ||
          v.name.toLowerCase().includes(q) ||
          v.protocol.toLowerCase().includes(q);
        return matchesQuery;
      });
    }
  }, [category, search, filterTag]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--overlay)] backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-picker-title"
    >
      <div
        className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-2xl border border-[var(--border-strong)] bg-[var(--surface-3)] shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--brand-soft)] text-[var(--brand-text)] flex items-center justify-center font-bold">
              {category === "stock" ? <TrendingUp size={16} /> : <Sparkles size={16} />}
            </div>
            <div>
              <h2 id="asset-picker-title" className="text-base font-black text-[var(--ink)]">
                {category === "stock" ? "Select Tokenized Stock" : "Select Yield Vault"}
              </h2>
              <p className="text-xs text-[var(--ink-muted)]">
                {category === "stock"
                  ? "32 Coinbase B20 tokenized equities on Base"
                  : "Morpho Blue & SuperStocks yield positions"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-[var(--border-subtle)] space-y-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ink-muted)]"
            />
            <input
              type="text"
              autoFocus
              placeholder={
                category === "stock"
                  ? "Search by name or ticker (e.g. NVDA, Apple)…"
                  : "Search vaults by protocol or stock…"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-sm text-[var(--ink)] placeholder-[var(--ink-dim)] outline-none focus:border-[var(--brand-text)] transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-dim)] hover:text-[var(--ink)]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick filter chips for Stocks */}
          {category === "stock" && (
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs">
              {[
                { id: "all", label: "All Stocks" },
                { id: "tech", label: "Tech" },
                { id: "crypto", label: "Crypto" },
                { id: "finance", label: "Finance" },
                { id: "consumer", label: "Consumer" },
                { id: "aerospace", label: "Aerospace" },
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setFilterTag(chip.id)}
                  className={`px-2.5 py-1 rounded-lg font-bold shrink-0 transition ${
                    filterTag === chip.id
                      ? "bg-[var(--brand)] text-white"
                      : "bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* List of items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1 divide-y divide-[var(--border-subtle)]/30">
          {items.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--ink-muted)]">
              No matching {category === "stock" ? "stocks" : "vaults"} found.
            </div>
          ) : (
            items.map((item) => {
              const symbol = item.symbol as VoucherAsset;
              const isSelected = selectedSymbol === symbol;
              const addr = "address" in item ? (item.address as string).toLowerCase() : "";
              const balance = userBalances[addr] ?? 0;

              return (
                <button
                  key={item.symbol}
                  type="button"
                  onClick={() => {
                    onSelect(symbol);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl transition text-left cursor-pointer group ${
                    isSelected
                      ? "bg-[var(--brand-soft)] border border-[var(--brand)]/30"
                      : "hover:bg-[var(--surface-2)] border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {"icon" in item && item.icon ? (
                      <div className="w-10 h-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-center font-black text-sm text-[var(--ink)] shrink-0">
                        <span className="text-lg">{item.icon}</span>
                      </div>
                    ) : (
                      <TokenLogo
                        address={"address" in item ? item.address : undefined}
                        symbol={item.symbol}
                        size={40}
                        shape="rounded-xl"
                        src={"logo" in item ? (item as { logo?: string }).logo : undefined}
                      />
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-sm text-[var(--ink)]">
                          {item.symbol}
                        </span>
                        {"category" in item && item.category && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink-muted)]">
                            {item.category}
                          </span>
                        )}
                        {"apy" in item && typeof item.apy === "number" && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            +{item.apy.toFixed(2)}% APY
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--ink-muted)] truncate mt-0.5">
                        {item.name}
                        {"protocol" in item && ` · ${item.protocol}`}
                      </p>
                    </div>
                  </div>

                  {/* Right side: Balance & Selected check */}
                  <div className="flex items-center gap-3 shrink-0 pl-2">
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-[var(--ink-muted)]">
                        Balance
                      </p>
                      <p className="text-xs font-mono font-bold text-[var(--ink)]">
                        {balance > 0 ? balance.toFixed(4) : "0.00"}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-[var(--brand)] text-white flex items-center justify-center">
                        <Check size={14} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
