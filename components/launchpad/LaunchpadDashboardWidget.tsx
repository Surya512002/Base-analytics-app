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
          <Rocket size={16} className="text-[var(--ink-muted)]" />
          <p className="text-sm font-black text-[var(--ink)]">B20 Launchpad</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenLaunchpad()}
          className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--ink)] hover:text-[var(--ink)]"
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
          className="w-full rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-hover)] py-6 text-center hover:bg-[var(--bg-active)] transition-colors"
        >
          <p className="text-sm font-bold text-[var(--ink)]">Launch your first B20 token</p>
          <p className="text-[11px] text-[var(--ink-muted)] mt-1">$0 fee · dual DEX · vanity addresses</p>
        </button>
      )}
    </div>
  );
}
