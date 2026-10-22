"use client";

import type { LaunchedToken } from "@/lib/launchpad/types";
import TokenAvatar from "@/components/ui/TokenAvatar";

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
      <div className="card rounded-2xl p-4 text-center text-sm text-[var(--ink-muted)]">
        No tokens launched yet. Create one in the Launch tab.
      </div>
    );
  }

  return (
    <div className="card rounded-2xl overflow-hidden max-h-[420px] overflow-y-auto">
      <div className="px-3 py-2 border-b border-[var(--border-subtle)] text-[10px] font-bold text-[var(--ink-muted)] uppercase">
        Recent launches
      </div>
      <ul className="divide-y divide-[var(--border-subtle)]/60">
        {tokens.map((t) => {
          const active = selected?.address === t.address;
          return (
            <li key={t.address}>
              <button
                type="button"
                onClick={() => onSelect(t)}
                className={`w-full text-left px-3 py-3 transition-colors cursor-pointer ${
                  active ? "bg-[var(--bg-hover)] border-l-2 border-[var(--brand)]" : "hover:bg-[var(--surface-2)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <TokenAvatar
                    src={t.imageUrl}
                    address={t.address}
                    symbol={t.symbol}
                    className="w-8 h-8 rounded-full"
                    textClassName="text-[10px] font-black"
                  />
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
