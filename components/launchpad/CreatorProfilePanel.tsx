"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import type { CreatorProfile } from "@/lib/launchpad/creator-profile-types";
import { isCreatorProfileComplete } from "@/lib/launchpad/creator-profile-types";
import type { CreatorRevenueSummary } from "@/lib/launchpad/fee-ledger";
import { fetchLaunchpadTokens } from "@/lib/api/launchpad-client";
import { fetchMarketData } from "@/lib/api/launchpad-market-client";
import { patchCreatorProfileCache } from "@/hooks/useCreatorProfile";
import SiweSignInBanner from "@/components/wallet/SiweSignInBanner";
import LaunchPromoBanner from "@/components/profile/LaunchPromoBanner";
import ProfileHeader from "@/components/profile/ProfileHeader";
import CreatorStats from "@/components/profile/CreatorStats";
import ProfileTabs from "@/components/profile/ProfileTabs";
import DailyActionsPanel from "@/components/profile/DailyActionsPanel";
import {
  LAUNCHPAD_PLATFORM_FEE_BPS,
} from "@/lib/constants/launchpad";
import { FEE_SHARE_CREATOR_BPS } from "@/lib/launchpad/fee-split";

function estimateCreatorEthFromVolume(volumeUsd: number): number {
  const feePct = LAUNCHPAD_PLATFORM_FEE_BPS / 10000;
  const creatorPct = FEE_SHARE_CREATOR_BPS / 10000;
  return (volumeUsd * feePct * creatorPct) / 3200;
}

export default function CreatorProfilePanel({
  address,
  onOpenToken,
  connectedAddress,
  onConnect,
  siweAuthenticated = false,
  siweSigningIn = false,
  onSiweSignIn,
}: {
  address: string;
  onOpenToken?: (token: LaunchedToken) => void;
  connectedAddress?: string | null;
  onConnect?: () => void;
  siweAuthenticated?: boolean;
  siweSigningIn?: boolean;
  onSiweSignIn?: () => void | Promise<boolean | void>;
}) {
  const [tokens, setTokens] = useState<LaunchedToken[]>([]);
  const [markets, setMarkets] = useState<Record<string, TokenMarketSummary>>({});
  const [profile, setProfile] = useState<CreatorProfile | null>(null);
  const [creatorRevenue, setCreatorRevenue] = useState<CreatorRevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const creator = address.toLowerCase();
  const isOwner = connectedAddress?.toLowerCase() === creator;

  useEffect(() => {
    void Promise.all([
      fetchLaunchpadTokens(),
      fetchMarketData(),
      fetch(`/api/creator/${creator}/profile`, { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : { profile: null }
      ),
      fetch(`/api/launchpad/fees?creator=${creator}`, { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : { summary: null }
      ),
    ])
      .then(([data, marketData, profileRes, creatorRev]) => {
        setTokens(data.tokens.filter((t) => t.creator.toLowerCase() === creator));
        setMarkets(marketData.markets);
        setProfile(profileRes.profile ?? { address: creator, createdAt: 0, updatedAt: 0 });
        setCreatorRevenue(creatorRev.summary ?? null);
      })
      .finally(() => setLoading(false));
  }, [creator]);

  const stats = useMemo(() => {
    let totalVol = 0;
    let totalMcap = 0;
    for (const t of tokens) {
      const m = markets[t.address.toLowerCase()];
      totalVol += m?.volume24h ?? 0;
      totalMcap += m?.marketCap ?? 0;
    }
    return { launches: tokens.length, totalVol, totalMcap };
  }, [tokens, markets]);

  const estimatedEth = useMemo(() => {
    if (creatorRevenue && creatorRevenue.eventCount > 0) {
      return Number(BigInt(creatorRevenue.totalShare)) / 1e18;
    }
    return estimateCreatorEthFromVolume(stats.totalVol);
  }, [creatorRevenue, stats.totalVol]);

  const earningsDisplay = useMemo(() => {
    if (creatorRevenue && creatorRevenue.eventCount > 0) {
      return `${estimatedEth.toFixed(4)} ETH`;
    }
    if (stats.totalVol > 0) {
      return `~${estimatedEth.toFixed(4)} ETH`;
    }
    return "0 ETH";
  }, [creatorRevenue, stats.totalVol, estimatedEth]);

  const onProfileSaved = useCallback((next: CreatorProfile) => {
    patchCreatorProfileCache(next);
    setProfile(next);
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 w-full min-w-0">
      {/* SIWE Sign-In Banner if Owner connected but not signed in */}
      {isOwner && !siweAuthenticated && connectedAddress && onSiweSignIn && (
        <SiweSignInBanner
          walletAddress={connectedAddress}
          authenticated={false}
          signingIn={siweSigningIn}
          onSignIn={onSiweSignIn}
        />
      )}

      {/* Slim, Dismissible Launch Promo Banner (replaces bulky Everything You Need block) */}
      <LaunchPromoBanner />

      {/* Two-Column Responsive Layout:
          Desktop: Left = Header + Stats + Tabs, Right = Sticky Daily Panel
          Mobile: Stacked (Header, Stats, Tabs, Daily actions) */}
      <div className="grid lg:grid-cols-12 gap-6 items-start w-full min-w-0">
        {/* Main Column */}
        <div className={isOwner ? "lg:col-span-8 space-y-6 w-full min-w-0" : "lg:col-span-12 space-y-6 w-full min-w-0"}>
          {/* 1. Profile Header (Identity card, avatar, Basename, socials, edit/share) */}
          <ProfileHeader
            address={address}
            profile={profile}
            isOwner={isOwner}
            onProfileSaved={onProfileSaved}
            siweAuthenticated={siweAuthenticated}
            onSiweSignIn={onSiweSignIn}
          />

          {/* 2. Stats Row (4 tiles: Launches, Earnings, 24h Volume, Total Mcap) */}
          <CreatorStats
            address={address}
            loading={loading}
            launches={stats.launches}
            earningsDisplay={earningsDisplay}
            isEstimatedEarnings={creatorRevenue?.estimated || creatorRevenue?.eventCount === 0}
            volume24h={stats.totalVol}
            totalMcap={stats.totalMcap}
            isOwner={isOwner}
          />

          {/* 3. Main Tabs (Launches | Revenue | Vesting | Activity) */}
          <ProfileTabs
            tokens={tokens}
            markets={markets}
            creatorRevenue={creatorRevenue}
            address={address}
            isOwner={isOwner}
            onOpenToken={onOpenToken}
          />

          {/* Mobile view of Daily Actions (stacked at bottom for owner) */}
          {isOwner && (
            <div className="block lg:hidden w-full min-w-0">
              <DailyActionsPanel onRequestConnect={onConnect} />
            </div>
          )}
        </div>

        {/* Right Sticky Column: Daily Actions (Desktop only, for owner) */}
        {isOwner && (
          <div className="hidden lg:block lg:col-span-4 sticky top-24 w-full min-w-0">
            <DailyActionsPanel onRequestConnect={onConnect} />
          </div>
        )}
      </div>
    </div>
  );
}
