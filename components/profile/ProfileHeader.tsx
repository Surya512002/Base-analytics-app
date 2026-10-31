"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Copy,
  Check,
  ExternalLink,
  Share2,
  Globe,
  Twitter,
  Send,
  Edit3,
  ShieldCheck,
  Sparkles,
  Zap,
  Users,
} from "lucide-react";
import type { CreatorProfile } from "@/lib/launchpad/creator-profile-types";
import { isCreatorProfileComplete } from "@/lib/launchpad/creator-profile-types";
import { resolveBasenameClient } from "@/lib/utils/resolve-basename";
import { shortAddr } from "@/lib/launchpad/format";
import CreatorAvatar from "@/components/launchpad/CreatorAvatar";
import EditProfileDrawer from "./EditProfileDrawer";
import { useUniqueUsers } from "@/hooks/useUniqueUsers";

interface ProfileHeaderProps {
  address: string;
  profile: CreatorProfile | null;
  isOwner: boolean;
  onProfileSaved: (nextProfile: CreatorProfile) => void;
  siweAuthenticated?: boolean;
  onSiweSignIn?: () => void | Promise<boolean | void>;
  onToast?: (msg: string) => void;
}

export default function ProfileHeader({
  address,
  profile,
  isOwner,
  onProfileSaved,
  siweAuthenticated = false,
  onSiweSignIn,
  onToast,
}: ProfileHeaderProps) {
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [basename, setBasename] = useState<string | null>(null);
  const { formatted: uniqueUsersFormatted } = useUniqueUsers(address);

  // Check Basename resolution on Base mainnet
  useEffect(() => {
    let alive = true;
    resolveBasenameClient(address)
      .then((name) => {
        if (alive && name) setBasename(name);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [address]);

  // Calculate profile completion percentage
  const completionPercentage = useMemo(() => {
    if (!profile) return 0;
    let score = 0;
    if (profile.avatarUrl) score += 25;
    if (profile.displayName?.trim()) score += 25;
    if (profile.bio?.trim()) score += 25;
    if (profile.website?.trim() || profile.twitter?.trim() || profile.telegram?.trim()) {
      score += 25;
    }
    return score;
  }, [profile]);

  const hasProfile = isCreatorProfileComplete(profile);

  const copyAddress = () => {
    void navigator.clipboard.writeText(address);
    setCopiedAddr(true);
    onToast?.("Address copied to clipboard");
    setTimeout(() => setCopiedAddr(false), 2000);
  };

  const shareProfile = () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/creator/${address.toLowerCase()}`
        : `/creator/${address.toLowerCase()}`;

    void navigator.clipboard.writeText(url);
    setCopiedLink(true);
    onToast?.("Public profile link copied!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const displayName = profile?.displayName?.trim() || basename || shortAddr(address, 6, 4);

  return (
    <div className="space-y-4 w-full min-w-0">
      {/* Main Identity Card */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-7 shadow-sm w-full min-w-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-5 min-w-0">
          {/* Left: Avatar & Identity Details */}
          <div className="flex items-start gap-3.5 sm:gap-5 min-w-0 flex-1">
            <div className="relative shrink-0">
              <CreatorAvatar address={address} profile={profile} size="hero" ring />
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-[var(--ink)] truncate">
                  {displayName}
                </h1>
                {basename && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand-text)] border border-[var(--border-subtle)] flex items-center gap-1">
                    <ShieldCheck size={11} /> {basename}
                  </span>
                )}
                <span
                  title="Total verified unique wallet addresses connected and tracked via Redis on Base"
                  className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center gap-1.5 cursor-default"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <Users size={11} />
                  <span>{uniqueUsersFormatted} Unique Users</span>
                </span>
              </div>

              {/* Wallet Address + Copy + Basescan */}
              <div className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
                <span className="font-mono">{shortAddr(address, 6, 4)}</span>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="pop-pill p-1 rounded hover:bg-[var(--surface-2)] transition cursor-pointer"
                  title="Copy address"
                  aria-label="Copy address"
                >
                  {copiedAddr ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                </button>
                <a
                  href={`https://basescan.org/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pop-pill p-1 rounded hover:bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--brand-text)] transition cursor-pointer"
                  title="View on Basescan"
                  aria-label="View on Basescan"
                >
                  <ExternalLink size={13} />
                </a>
              </div>

              {/* Bio */}
              {profile?.bio ? (
                <p className="text-sm text-[var(--ink-muted)] leading-relaxed pt-1 max-w-xl">
                  {profile.bio}
                </p>
              ) : isOwner ? (
                <p className="text-xs text-[var(--ink-dim)] italic pt-0.5">
                  No bio added yet. Tap Edit profile to tell collectors about your projects.
                </p>
              ) : null}

              {/* Social Link Icon Buttons (Only rendered if populated) */}
              {(profile?.website || profile?.twitter || profile?.telegram) && (
                <div className="flex items-center gap-2 pt-2">
                  {profile.website && (
                    <a
                      href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pop p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink)] hover:text-[var(--brand-text)] hover:border-[var(--brand)]/30 transition cursor-pointer"
                      title="Website"
                      aria-label="Website"
                    >
                      <Globe size={15} />
                    </a>
                  )}
                  {profile.twitter && (
                    <a
                      href={
                        profile.twitter.startsWith("http")
                          ? profile.twitter
                          : `https://x.com/${profile.twitter.replace(/^@/, "")}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pop p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink)] hover:text-[var(--brand-text)] hover:border-[var(--brand)]/30 transition cursor-pointer"
                      title="X / Twitter"
                      aria-label="X / Twitter"
                    >
                      <Twitter size={15} />
                    </a>
                  )}
                  {profile.telegram && (
                    <a
                      href={
                        profile.telegram.startsWith("http")
                          ? profile.telegram
                          : `https://t.me/${profile.telegram.replace(/^@/, "")}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pop p-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink)] hover:text-[var(--brand-text)] hover:border-[var(--brand)]/30 transition cursor-pointer"
                      title="Telegram"
                      aria-label="Telegram"
                    >
                      <Send size={15} />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 flex-wrap">
            {/* Pay / Tip Button */}
            <a
              href={`/pay/${address.toLowerCase()}`}
              title={isOwner ? "View & share your personal Pay Link" : "Pay or tip this creator on Base"}
              className="pop-pill flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
            >
              <Zap size={14} className="text-emerald-500" />
              <span>{isOwner ? "My Pay Link" : "Pay / Tip"}</span>
            </a>

            {/* Share Profile button */}
            <button
              type="button"
              onClick={shareProfile}
              className="pop-pill flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs font-bold text-[var(--ink)] hover:bg-[var(--border-subtle)]/40 transition cursor-pointer"
            >
              {copiedLink ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} />}
              <span>{copiedLink ? "Link Copied!" : "Share profile"}</span>
            </button>

            {/* Edit Profile button (only for owner) */}
            {isOwner && (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="pop-pill flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-black text-xs bg-[#0052FF] text-white hover:bg-[#0047e0] transition shadow-xs cursor-pointer"
              >
                <Edit3 size={14} />
                <span>Edit profile</span>
              </button>
            )}
          </div>
        </div>

        {/* Profile Completion Bar (Only shown for owner if incomplete) */}
        {isOwner && !hasProfile && (
          <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[var(--ink)] flex items-center gap-1.5">
                <Sparkles size={14} className="text-[var(--brand-text)]" />
                Profile setup completion
              </span>
              <span className="font-mono font-bold text-[var(--brand-text)]">
                {completionPercentage}% complete
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div
                className="h-full bg-[var(--brand)] transition-all duration-300 rounded-full"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
            <p className="text-[11px] text-[var(--ink-muted)]">
              Complete your profile photo, display name, bio, and a social link to increase your discoverability among onchain traders.
            </p>
          </div>
        )}
      </div>

      {/* Edit Profile Drawer */}
      <EditProfileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        address={address}
        profile={profile}
        onSaved={onProfileSaved}
        siweAuthenticated={siweAuthenticated}
        onSiweSignIn={onSiweSignIn}
      />
    </div>
  );
}
