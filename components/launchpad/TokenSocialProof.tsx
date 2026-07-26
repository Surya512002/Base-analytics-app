"use client";

import { useEffect, useState } from "react";
import { MessageCircle, TrendingUp, Users } from "lucide-react";
import type { EnrichedHolder } from "@/lib/api/launchpad-token-client";
import type { RecentSwapRow } from "@/lib/api/launchpad-token-client";
import { shortAddr } from "@/lib/launchpad/format";
import { fetchNeynar } from "@/lib/api/neynar";
import { parseNeynarUsersByAddress } from "@/lib/api/neynar-users";
import Link from "next/link";

type FarcasterProfile = {
  username?: string;
  displayName?: string;
  followerCount?: number;
};

export default function TokenSocialProof({
  creator,
  holders,
  swaps,
  holderCount,
}: {
  creator: string;
  holders: EnrichedHolder[];
  swaps: RecentSwapRow[];
  holderCount?: number;
}) {
  const [fc, setFc] = useState<FarcasterProfile | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchNeynar("v2/farcaster/user/bulk-by-address", { addresses: creator })
      .then(({ ok, data }) => {
        if (!alive || !ok) return;
        const users = parseNeynarUsersByAddress(data, creator);
        const user = users[0];
        if (!user) return;
        setFc({
          username: user.username as string | undefined,
          displayName: user.display_name as string | undefined,
          followerCount: user.follower_count as number | undefined,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [creator]);

  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
  }, []);

  const hourAgo = now > 0 ? now - 60 * 60 * 1000 : 0;
  const recentBuys = swaps.filter(
    (s) => s.side === "buy" && s.timestamp != null && s.timestamp > hourAgo
  ).length;
  const tagged = holders.filter((h) => h.tag).slice(0, 4);

  return (
    <div className="grid sm:grid-cols-3 gap-3">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 text-slate-500 mb-1">
          <Users size={14} />
          <span className="text-[10px] font-black uppercase">Holders</span>
        </div>
        <p className="text-xl font-black text-white font-mono">
          {holderCount ?? holders.length}
        </p>
        {tagged.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tagged.map((h) => (
              <span
                key={h.address}
                className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--bg-elevated)] text-[var(--ink-muted)] border border-[var(--border-subtle)]"
              >
                {h.tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 text-slate-500 mb-1">
          <TrendingUp size={14} />
          <span className="text-[10px] font-black uppercase">Buys (1h)</span>
        </div>
        <p className="text-xl font-black text-emerald-400 font-mono">{recentBuys}</p>
        <p className="text-[10px] text-slate-500 mt-1">From indexed pool swaps</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex items-center gap-2 text-slate-500 mb-1">
          <MessageCircle size={14} />
          <span className="text-[10px] font-black uppercase">Creator</span>
        </div>
        <Link
          href={`/creator/${creator}`}
          className="text-sm font-bold text-[var(--ink)] hover:text-white truncate block"
        >
          {fc?.displayName ?? fc?.username ?? shortAddr(creator)}
        </Link>
        {fc?.username && (
          <p className="text-[10px] text-slate-500 mt-0.5">@{fc.username}</p>
        )}
        {fc?.followerCount != null && (
          <p className="text-[10px] text-slate-500">{fc.followerCount.toLocaleString()} followers</p>
        )}
      </div>
    </div>
  );
}
