"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import CreatorAvatar from "@/components/launchpad/CreatorAvatar";
import { useCreatorProfile } from "@/hooks/useCreatorProfile";
import { creatorDisplayName } from "@/lib/launchpad/creator-profile-types";
import { shortAddr } from "@/lib/launchpad/format";

export default function CreatorProfileCard({ creator }: { creator: string }) {
  const { profile, loading } = useCreatorProfile(creator);
  const label = creatorDisplayName(profile, creator);

  return (
    <Link
      href={`/creator/${creator}`}
      className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 transition-colors hover:border-[var(--brand)] hover:bg-[var(--surface)]"
    >
      <CreatorAvatar address={creator} profile={profile} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-dim)]">
          Creator
        </p>
        <p className="truncate text-base font-bold text-[var(--ink)]">
          {loading ? "…" : label}
        </p>
        <p className="font-mono text-[11px] text-[var(--ink-muted)]">{shortAddr(creator, 6, 4)}</p>
        {profile?.bio && (
          <p className="mt-1 line-clamp-2 text-[11px] text-[var(--ink-muted)]">{profile.bio}</p>
        )}
      </div>
      <ExternalLink size={16} className="shrink-0 text-[var(--ink-dim)]" />
    </Link>
  );
}
