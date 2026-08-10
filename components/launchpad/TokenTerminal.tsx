"use client";

import type { LaunchedToken } from "@/lib/launchpad/types";

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function TokenTerminal({
  tokens,
  selected,
  onSelect,
}: {
  tokens: LaunchedToken[];
  selected: LaunchedToken | null;
  onSelect: (t: LaunchedToken) => void;
}) {
  if (!tokens.length) {
    return (
      <div className="glass-panel rounded-2xl p-4 text-center text-sm text-[var(--ink-dim)]">
        No tokens launched yet. Create one in the Launch tab.
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl overflow-hidden max-h-[420px] overflow-y-auto">
      <div className="px-3 py-2 border-b border-[var(--border-subtle)] text-[10px] font-bold text-[var(--ink-dim)] uppercase">
        Recent launches
      </div>
      <ul className="divide-y divide-white/5">
        {tokens.map((t) => {
          const active = selected?.address === t.address;
          return (
            <li key={t.address}>
              <button
                type="button"
                onClick={() => onSelect(t)}
                className={`w-full text-left px-3 py-3 transition-colors ${
                  active ? "bg-[var(--bg-hover)]" : "hover:bg-[var(--surface-2)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  {t.imageUrl ? (
                    <img
                      src={t.imageUrl}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border border-[var(--border-subtle)]"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[10px] font-black text-[var(--ink-muted)]">
                      {t.symbol.slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-[var(--ink)] truncate">
                      {t.name}{" "}
                      <span className="text-[var(--ink-muted)]">${t.symbol}</span>
                    </p>
                    <p className="text-[10px] text-[var(--ink-dim)] font-mono">{shortAddr(t.address)}</p>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
