"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, TrendingUp, Users } from "lucide-react";
import type { EnrichedHolder } from "@/lib/api/launchpad-token-client";
import type { RecentSwapRow } from "@/lib/api/launchpad-token-client";
import { shortAddr } from "@/lib/launchpad/format";
import { fetchNeynar } from "@/lib/api/neynar";
import { parseNeynarUsersByAddress } from "@/lib/api/neynar-users";
import CreatorAvatar from "@/components/launchpad/CreatorAvatar";
import { useCreatorProfile } from "@/hooks/useCreatorProfile";
import { creatorDisplayName } from "@/lib/launchpad/creator-profile-types";

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
  const { profile } = useCreatorProfile(creator);

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
  const creatorLabel =
    profile?.displayName?.trim() ||
    fc?.displayName ||
    fc?.username ||
    creatorDisplayName(profile, creator);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
        <div className="mb-1 flex items-center gap-2 text-[var(--ink-dim)]">
          <Users size={14} />
          <span className="text-[10px] font-bold uppercase">Holders</span>
        </div>
        <p className="font-mono text-xl font-bold text-[var(--ink)]">
          {holderCount ?? holders.length}
        </p>
        {tagged.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {tagged.map((h) => (
              <span
                key={h.address}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--ink-muted)]"
              >
                {h.tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
        <div className="mb-1 flex items-center gap-2 text-[var(--ink-dim)]">
          <TrendingUp size={14} />
          <span className="text-[10px] font-bold uppercase">Buys (1h)</span>
        </div>
        <p className="font-mono text-xl font-bold text-emerald-700">{recentBuys}</p>
        <p className="mt-1 text-[10px] text-[var(--ink-dim)]">From indexed pool swaps</p>
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
        <div className="mb-2 flex items-center gap-2 text-[var(--ink-dim)]">
          <MessageCircle size={14} />
          <span className="text-[10px] font-bold uppercase">Creator</span>
        </div>
        <Link
          href={`/creator/${creator}`}
          className="flex items-center gap-2.5 transition-opacity hover:opacity-90"
        >
          <CreatorAvatar address={creator} profile={profile} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--ink)]">{creatorLabel}</p>
            <p className="font-mono text-[10px] text-[var(--ink-dim)]">{shortAddr(creator)}</p>
            {fc?.username && (
              <p className="text-[10px] text-[var(--ink-muted)]">@{fc.username}</p>
            )}
          </div>
        </Link>
        {fc?.followerCount != null && (
          <p className="mt-2 text-[10px] text-[var(--ink-dim)]">
            {fc.followerCount.toLocaleString()} Farcaster followers
          </p>
        )}
      </div>
    </div>
  );
}
