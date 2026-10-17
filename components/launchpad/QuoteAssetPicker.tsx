"use client";

import React, { useState } from "react";
import { Check, Copy, Info, AlertTriangle, Clock } from "lucide-react";
import { BASE_STOCKS, type BaseStock } from "@/lib/stocks/base-stocks";
import { isUSMarketOpenNow } from "@/lib/launchpad/launch-configs";
import { copyToClipboard } from "@/lib/utils/clipboard";

interface QuoteAssetPickerProps {
  selectedStock: BaseStock;
  onSelectStock: (stock: BaseStock) => void;
  stockPrices?: Record<string, number>;
}

export default function QuoteAssetPicker({
  selectedStock,
  onSelectStock,
  stockPrices = {},
}: QuoteAssetPickerProps) {
  const [copied, setCopied] = useState(false);
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const isMarketOpen = isUSMarketOpenNow();

  const handleCopy = async (addr: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await copyToClipboard(addr);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-4">
      {/* Header with Market Status chip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-black text-[var(--ink)]">Select Tokenized Stock Quote Asset</h3>
          <p className="text-xs text-[var(--ink-muted)]">
            Your token trades directly against tokenized equity shares on Base.
          </p>
        </div>

        {/* Chainlink 24/5 Feed Status Chip */}
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
              isMarketOpen
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            }`}
          >
            <Clock size={12} />
            <span>Chainlink 24/5 Feed: {isMarketOpen ? "Market Open" : "Market Closed"}</span>
          </span>
        </div>
      </div>

      {/* Stock Cards Grid (top 8 popular equities) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {BASE_STOCKS.slice(0, 8).map((stock) => {
          const isSelected = selectedStock.symbol === stock.symbol;
          const livePrice = stockPrices[stock.symbol];

          return (
            <div
              key={stock.symbol}
              onClick={() => onSelectStock(stock)}
              className={`pop-lg p-3 rounded-xl border text-left transition relative cursor-pointer flex flex-col justify-between gap-2 ${
                isSelected
                  ? "border-[#0052FF] bg-[var(--surface-2)] shadow-xs ring-1 ring-[#0052FF]"
                  : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)] hover:border-[var(--ink-dim)] hover:text-[var(--ink)]"
              }`}
            >
              {isSelected && (
                <span className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[#0052FF] text-white flex items-center justify-center">
                  <Check size={10} strokeWidth={3} />
                </span>
              )}

              <div>
                <div className="flex items-center justify-between pr-4">
                  <span className="font-mono font-black text-xs text-[var(--ink)]">
                    {stock.symbol}
                  </span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--ink-muted)] border border-[var(--border-subtle)]">
                    {stock.category}
                  </span>
                </div>
                <p className="text-xs text-[var(--ink-muted)] truncate mt-1">{stock.name}</p>
              </div>

              {/* Price & info button */}
              <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]/40 text-[11px]">
                <span className="font-mono font-bold text-[var(--ink)]">
                  {livePrice ? `$${livePrice.toFixed(2)}` : "Live Feed"}
                </span>

                {/* Popover trigger */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePopover(activePopover === stock.symbol ? null : stock.symbol);
                  }}
                  className="p-1 rounded text-[var(--ink-muted)] hover:text-[#0052FF] hover:bg-[var(--surface-2)]"
                  title="View contract details"
                >
                  <Info size={12} />
                </button>
              </div>

              {/* Contract Popover */}
              {activePopover === stock.symbol && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-full mb-1 left-0 right-0 z-30 p-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-lg text-[11px] space-y-2 animate-meridian-fade"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[var(--ink)]">Precompile Contract</span>
                    <button
                      type="button"
                      onClick={() => setActivePopover(null)}
                      className="text-[var(--ink-muted)] hover:text-[var(--ink)] text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-1 p-1.5 rounded bg-[var(--surface-2)] border border-[var(--border-subtle)] font-mono text-[10px] break-all select-all">
                    <span>{stock.address.slice(0, 10)}…{stock.address.slice(-6)}</span>
                    <button
                      type="button"
                      onClick={(e) => handleCopy(stock.address, e)}
                      className="p-1 rounded hover:bg-[var(--surface)] text-[#0052FF]"
                      title="Copy contract address"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                  {copied && <p className="text-[10px] text-emerald-600 font-bold">Address copied!</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Stock Quick Summary Bar */}
      <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[var(--ink)]">Pair Target:</span>
          <span className="font-mono text-[#0052FF] font-bold">TOKEN / {selectedStock.symbol}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--ink-muted)]">
          <span>Quote Contract:</span>
          <span className="font-mono text-[var(--ink)] font-medium">
            {selectedStock.address.slice(0, 8)}…{selectedStock.address.slice(-4)}
          </span>
          <button
            type="button"
            onClick={(e) => handleCopy(selectedStock.address, e)}
            className="p-1 rounded hover:text-[#0052FF] text-[var(--ink-muted)]"
            title="Copy address"
          >
            <Copy size={12} />
          </button>
        </div>
      </div>

      {/* Risk Disclosure (High-contrast amber alert) */}
      <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs leading-relaxed space-y-1">
        <div className="flex items-center gap-1.5 font-bold">
          <AlertTriangle size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Stock-Paired Volatility Disclosure</span>
        </div>
        <p className="text-[11px] opacity-95">
          Memestocks are traded against underlying tokenized equities. Off-hours liquidity may vary during US equity market closures.
        </p>
      </div>
    </div>
  );
}
