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
      <div className="glass-panel rounded-2xl p-4 text-center text-sm text-slate-500">
        No tokens launched yet. Create one in the Launch tab.
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-2xl overflow-hidden max-h-[420px] overflow-y-auto">
      <div className="px-3 py-2 border-b border-white/10 text-[10px] font-bold text-slate-500 uppercase">
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
                  active ? "bg-violet-500/15" : "hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-2">
                  {t.imageUrl ? (
                    <img
                      src={t.imageUrl}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover border border-white/10"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-black text-violet-300">
                      {t.symbol.slice(0, 2)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-white truncate">
                      {t.name}{" "}
                      <span className="text-violet-300">${t.symbol}</span>
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono">{shortAddr(t.address)}</p>
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
