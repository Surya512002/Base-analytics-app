"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Rocket } from "lucide-react";
import { fetchLaunchpadTokens } from "@/lib/api/launchpad-client";
import type { LaunchedToken } from "@/lib/launchpad/types";
import MyLaunchedTokens from "@/components/launchpad/MyLaunchedTokens";

export default function LaunchpadDashboardWidget({
  wallet,
  onOpenLaunchpad,
}: {
  wallet: string;
  onOpenLaunchpad: (token?: LaunchedToken) => void;
}) {
  const [tokens, setTokens] = useState<LaunchedToken[]>([]);

  const load = useCallback(async () => {
    const data = await fetchLaunchpadTokens();
    setTokens(data.tokens);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mine = tokens.filter((t) => t.creator.toLowerCase() === wallet.toLowerCase());
  if (mine.length === 0 && tokens.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket size={16} className="text-[#6BA3FF]" />
          <p className="text-sm font-black text-white">B20 Launchpad</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenLaunchpad()}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[#6BA3FF] hover:text-white"
        >
          Explore <ArrowRight size={12} />
        </button>
      </div>
      {mine.length > 0 ? (
        <MyLaunchedTokens
          tokens={tokens}
          wallet={wallet}
          onOpen={(t) => onOpenLaunchpad(t)}
        />
      ) : (
        <button
          type="button"
          onClick={() => onOpenLaunchpad()}
          className="w-full rounded-2xl border border-dashed border-[#0052FF]/30 bg-[#0052FF]/[0.05] py-6 text-center hover:bg-[#0052FF]/10 transition-colors"
        >
          <p className="text-sm font-bold text-white">Launch your first B20 token</p>
          <p className="text-[11px] text-slate-500 mt-1">$0 fee · dual DEX · vanity addresses</p>
        </button>
      )}
    </div>
  );
}
