"use client";

import { useState } from "react";
import { Eye, Plus, Trash2 } from "lucide-react";

const WATCH_KEY = "base_watchlist";

function readWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(WATCH_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

function writeWatchlist(list: string[]) {
  localStorage.setItem(WATCH_KEY, JSON.stringify(list.slice(0, 5)));
}

interface WatchlistPanelProps {
  myAddress: string;
}

export default function WatchlistPanel({ myAddress }: WatchlistPanelProps) {
  const [list, setList] = useState<string[]>(() => readWatchlist());
  const [input, setInput] = useState("");

  const add = () => {
    const addr = input.trim().toLowerCase();
    if (!addr.startsWith("0x") || addr.length !== 42) return;
    if (list.includes(addr)) return;
    const next = [...list, addr];
    setList(next);
    writeWatchlist(next);
    setInput("");
  };

  const remove = (addr: string) => {
    const next = list.filter((a) => a !== addr);
    setList(next);
    writeWatchlist(next);
  };

  return (
    <div className="elegant-panel rounded-2xl border border-white/10 p-4">
      <p className="section-eyebrow">Watchlist</p>
      <p className="text-xs text-slate-500 mt-1 mb-3">Save up to 5 wallets to compare on public profiles.</p>
      <div className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x…"
          className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-xs font-mono text-white outline-none focus:border-violet-500/40"
        />
        <button type="button" onClick={add} className="p-2.5 rounded-xl bg-white/10 border border-white/15">
          <Plus size={16} />
        </button>
      </div>
      <div className="space-y-2">
        {list.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-2">No wallets saved yet.</p>
        )}
        {list.map((addr) => (
          <div
            key={addr}
            className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] border border-white/8 px-3 py-2"
          >
            <span className="text-[11px] font-mono text-slate-300 truncate">
              {addr === myAddress.toLowerCase() ? `${addr.slice(0, 8)}… (you)` : `${addr.slice(0, 10)}…${addr.slice(-4)}`}
            </span>
            <div className="flex gap-1 shrink-0">
              <a
                href={`/wallet/${addr}`}
                className="p-1.5 rounded-lg hover:bg-white/10 text-cyan-400"
                title="View profile"
              >
                <Eye size={14} />
              </a>
              <button type="button" onClick={() => remove(addr)} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
