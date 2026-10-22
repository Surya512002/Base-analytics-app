"use client";

import React from "react";
import { Zap, Coins, TrendingUp, Check } from "lucide-react";
import type { LaunchTokenType } from "@/lib/launchpad/types";

interface LaunchTypeSelectorProps {
  value: LaunchTokenType;
  onChange: (type: LaunchTokenType) => void;
}

export default function LaunchTypeSelector({ value, onChange }: LaunchTypeSelectorProps) {
  const options = [
    {
      id: "b20" as LaunchTokenType,
      title: "B20 Vanity Token",
      description: "0xB200… precompile address with anti-snipe & vesting",
      icon: Zap,
    },
    {
      id: "standard" as LaunchTokenType,
      title: "ERC-20 Meme",
      description: "Fast 1-click meme coin with locked liquidity",
      icon: Coins,
    },
    {
      id: "memestock" as LaunchTokenType,
      title: "Stock-Paired",
      description: "Stonks-style: trade meme token vs NVDAc, AAPLc & equities",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-black uppercase tracking-wider text-[var(--ink-muted)]">
          Select Launch Type
        </label>
        <span className="text-[11px] font-medium text-[var(--ink-dim)]">Fixed 1B supply on Base</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3" role="radiogroup" aria-label="Launch type">
        {options.map((opt) => {
          const isSelected = value === opt.id;
          const Icon = opt.icon;

          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(opt.id)}
              className={`pop-lg p-4 rounded-2xl border text-left transition relative cursor-pointer ${
                isSelected
                  ? "border-[var(--brand-text)] bg-[var(--surface)] shadow-sm ring-1 ring-[var(--brand)]"
                  : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:border-[var(--ink-dim)] hover:text-[var(--ink)]"
              }`}
            >
              {/* Checkmark icon for selected */}
              {isSelected && (
                <span className="absolute top-3.5 right-3.5 w-5 h-5 rounded-full bg-[var(--brand)] text-white flex items-center justify-center shadow-xs">
                  <Check size={12} strokeWidth={3} />
                </span>
              )}

              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition ${
                    isSelected
                      ? "bg-[var(--brand-soft)] text-[var(--brand-text)]"
                      : "bg-[var(--surface)] text-[var(--ink-muted)] border border-[var(--border-subtle)]"
                  }`}
                >
                  <Icon size={18} />
                </div>
                <div>
                  <h3
                    className={`text-sm font-black transition ${
                      isSelected ? "text-[var(--ink)]" : "text-[var(--ink)]"
                    }`}
                  >
                    {opt.title}
                  </h3>
                </div>
              </div>

              <p className="text-sm text-[var(--ink-muted)] mt-2.5 leading-snug">
                {opt.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
