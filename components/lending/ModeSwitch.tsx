"use client";

import React from "react";
import { TrendingUp, Lock, Coins } from "lucide-react";

export type LendingMode = "lend" | "borrow" | "stake";

interface ModeSwitchProps {
  value: LendingMode;
  onChange: (mode: LendingMode) => void;
}

export default function ModeSwitch({ value, onChange }: ModeSwitchProps) {
  const options = [
    { id: "lend" as LendingMode, label: "Lend & Supply", icon: TrendingUp },
    { id: "borrow" as LendingMode, label: "Borrow", icon: Lock },
    { id: "stake" as LendingMode, label: "Stake & Vaults (Beefy / Gauges)", icon: Coins },
  ];

  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] w-fit flex-wrap" role="radiogroup" aria-label="Lending Mode">
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
            className={`pop-pill px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              isSelected
                ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs border border-[var(--border-subtle)]"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Icon size={14} className={isSelected ? "text-[var(--brand-text)]" : "text-[var(--ink-dim)]"} />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
