"use client";

import React from "react";
import { Sparkles, Layers, ArrowLeftRight } from "lucide-react";

export type MarketGroup = "stocks" | "compare" | "all";

interface MarketGroupTabsProps {
  value: MarketGroup;
  onChange: (val: MarketGroup) => void;
  stocksCount?: number;
  allCount?: number;
}

export default function MarketGroupTabs({
  value,
  onChange,
  stocksCount = 32,
  allCount = 45,
}: MarketGroupTabsProps) {
  return (
    <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] w-fit flex-wrap" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={value === "stocks"}
        onClick={() => onChange("stocks")}
        className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
          value === "stocks"
            ? "bg-[#0052FF] text-white hover:bg-[#0045D8] shadow-xs"
            : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]"
        }`}
      >
        <Sparkles size={15} />
        <span>Tokenized Stocks</span>
        <span
          className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
            value === "stocks" ? "bg-white/20 text-white" : "bg-[var(--surface)] text-[var(--ink-dim)] border border-[var(--border-subtle)]"
          }`}
        >
          {stocksCount}
        </span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={value === "compare"}
        onClick={() => onChange("compare")}
        className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
          value === "compare"
            ? "bg-[#0052FF] text-white hover:bg-[#0045D8] shadow-xs"
            : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]"
        }`}
      >
        <ArrowLeftRight size={15} />
        <span>Compare Protocols</span>
        <span
          className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
            value === "compare" ? "bg-white/20 text-white" : "bg-[var(--surface)] text-[var(--ink-dim)] border border-[var(--border-subtle)]"
          }`}
        >
          8 Protocols
        </span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={value === "all"}
        onClick={() => onChange("all")}
        className={`px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
          value === "all"
            ? "bg-[#0052FF] text-white hover:bg-[#0045D8] shadow-xs"
            : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]"
        }`}
      >
        <Layers size={15} />
        <span>All Markets</span>
        <span
          className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${
            value === "all" ? "bg-white/20 text-white" : "bg-[var(--surface)] text-[var(--ink-dim)] border border-[var(--border-subtle)]"
          }`}
        >
          {allCount}
        </span>
      </button>
    </div>
  );
}
