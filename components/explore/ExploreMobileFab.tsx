"use client";

import { Command, Rocket, TrendingUp } from "lucide-react";

export default function ExploreMobileFab({
  onBrowse,
  onLaunch,
  guest,
  onConnect,
}: {
  onBrowse: () => void;
  onLaunch: () => void;
  guest?: boolean;
  onConnect?: () => void;
}) {
  return (
    <div className="lg:hidden fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-40 flex flex-col gap-2">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
        className="w-12 h-12 rounded-full border border-white/15 bg-[#080808]/95 backdrop-blur shadow-lg flex items-center justify-center text-white"
        aria-label="Search tokens"
      >
        <Command size={18} />
      </button>
      <button
        type="button"
        onClick={onBrowse}
        className="w-12 h-12 rounded-full border border-[#0052FF]/40 bg-[#0052FF]/90 shadow-lg shadow-[#0052FF]/20 flex items-center justify-center text-white"
        aria-label="Browse trending"
      >
        <TrendingUp size={18} />
      </button>
      <button
        type="button"
        onClick={guest ? onConnect : onLaunch}
        className="w-12 h-12 rounded-full border border-emerald-500/40 bg-emerald-600/90 shadow-lg flex items-center justify-center text-white"
        aria-label={guest ? "Connect wallet" : "Launch token"}
      >
        <Rocket size={18} />
      </button>
    </div>
  );
}
