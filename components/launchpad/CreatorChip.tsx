"use client";

import Link from "next/link";
import CreatorAvatar, { type CreatorAvatarSize } from "@/components/launchpad/CreatorAvatar";
import { creatorDisplayName } from "@/lib/launchpad/creator-profile-types";
import type { CreatorProfile } from "@/lib/launchpad/creator-profile-types";
import { useCreatorProfile } from "@/hooks/useCreatorProfile";

export default function CreatorChip({
  address,
  profile: profileProp,
  size = "sm",
  showAddress = false,
  className = "",
  onClick,
}: {
  address: string;
  profile?: CreatorProfile | null;
  size?: CreatorAvatarSize;
  showAddress?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const { profile: fetched } = useCreatorProfile(profileProp ? null : address);
  const profile = profileProp ?? fetched;
  const label = creatorDisplayName(profile, address);

  return (
    <Link
      href={`/creator/${address}`}
      onClick={onClick}
      className={`inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg transition-colors hover:bg-[var(--surface-2)] ${className}`}
    >
      <CreatorAvatar address={address} profile={profile} size={size} />
      <span className="min-w-0 truncate text-[11px] font-semibold text-[var(--brand-dark)] hover:underline">
        {label}
      </span>
      {showAddress && (
        <span className="hidden font-mono text-[10px] text-[var(--ink-dim)] sm:inline">
          {address.slice(0, 6)}…{address.slice(-4)}
        </span>
      )}
    </Link>
  );
}
