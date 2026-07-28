"use client";

import { creatorDisplayName } from "@/lib/launchpad/creator-profile-types";
import type { CreatorProfile } from "@/lib/launchpad/creator-profile-types";
import { useCreatorProfile } from "@/hooks/useCreatorProfile";

const SIZES = {
  xs: "h-6 w-6 rounded-lg text-[9px]",
  sm: "h-8 w-8 rounded-lg text-[10px]",
  md: "h-10 w-10 rounded-xl text-xs",
  lg: "h-16 w-16 rounded-2xl text-lg",
  xl: "h-20 w-20 rounded-2xl text-xl sm:h-24 sm:w-24 sm:text-2xl",
  hero: "h-24 w-24 rounded-2xl text-2xl sm:h-28 sm:w-28 sm:text-3xl",
} as const;

export type CreatorAvatarSize = keyof typeof SIZES;

export default function CreatorAvatar({
  address,
  profile: profileProp,
  size = "md",
  className = "",
  ring = false,
}: {
  address: string;
  profile?: CreatorProfile | null;
  size?: CreatorAvatarSize;
  className?: string;
  ring?: boolean;
}) {
  const { profile: fetched } = useCreatorProfile(profileProp ? null : address);
  const profile = profileProp ?? fetched;
  const name = creatorDisplayName(profile, address);
  const initials = name.slice(0, 2).toUpperCase();
  const ringClass = ring ? "ring-2 ring-[var(--brand)]/25 ring-offset-2 ring-offset-[var(--surface)]" : "";

  if (profile?.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatarUrl}
        alt=""
        className={`${SIZES[size]} shrink-0 object-cover border-2 border-[var(--border-subtle)] bg-[var(--surface-2)] ${ringClass} ${className}`}
      />
    );
  }

  return (
    <div
      className={`${SIZES[size]} flex shrink-0 items-center justify-center border-2 border-[var(--border-subtle)] bg-[var(--brand-soft)] font-black text-[var(--brand-dark)] ${ringClass} ${className}`}
      aria-hidden
    >
      {initials}
    </div>
  );
}
