"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Copy,
  ExternalLink,
  Gift,
  Link2,
  Rocket,
  Settings2,
  TrendingUp,
} from "lucide-react";
import type { LaunchedToken } from "@/lib/launchpad/types";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import type { CreatorProfile } from "@/lib/launchpad/creator-profile-types";
import {
  creatorDisplayName,
  isCreatorProfileComplete,
} from "@/lib/launchpad/creator-profile-types";
import type { CreatorRevenueSummary, FeeEvent } from "@/lib/launchpad/fee-ledger";
import { fetchLaunchpadTokens } from "@/lib/api/launchpad-client";
import { fetchMarketData } from "@/lib/api/launchpad-market-client";
import TokenCard from "@/components/launchpad/TokenCard";
import CreatorAvatar from "@/components/launchpad/CreatorAvatar";
import CreatorProfileForm from "@/components/launchpad/CreatorProfileForm";
import CreatorProfileBenefits from "@/components/launchpad/CreatorProfileBenefits";
import SiweSignInBanner from "@/components/wallet/SiweSignInBanner";
import { patchCreatorProfileCache } from "@/hooks/useCreatorProfile";
import { formatUsd, shortAddr, timeAgo } from "@/lib/launchpad/format";
import {
  formatPlatformFeeLabel,
  LAUNCHPAD_PLATFORM_FEE_BPS,
} from "@/lib/constants/launchpad";
import { feeShareLabels, FEE_SHARE_CREATOR_BPS } from "@/lib/launchpad/fee-split";

type ProfileTab = "launches" | "fees" | "vesting" | "referrals";

function formatWeiEth(wei: string): string {
  const n = Number(BigInt(wei || "0")) / 1e18;
  if (n === 0) return "0 ETH";
  if (n < 0.0001) return "<0.0001 ETH";
  return `${n.toFixed(n >= 1 ? 4 : 6)} ETH`;
}

function estimateCreatorEthFromVolume(volumeUsd: number): number {
  const feePct = LAUNCHPAD_PLATFORM_FEE_BPS / 10000;
  const creatorPct = FEE_SHARE_CREATOR_BPS / 10000;
  return volumeUsd * feePct * creatorPct / 3200;
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
  const [referrerRevenue, setReferrerRevenue] = useState<CreatorRevenueSummary | null>(null);
  const [tab, setTab] = useState<ProfileTab>("launches");
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const creator = address.toLowerCase();
  const isOwner = connectedAddress?.toLowerCase() === creator;
  const profileComplete = isCreatorProfileComplete(profile);

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
      fetch(`/api/launchpad/fees?referrer=${creator}`, { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : { summary: null }
      ),
    ])
      .then(([data, marketData, profileRes, creatorRev, referrerRev]) => {
        setTokens(data.tokens.filter((t) => t.creator.toLowerCase() === creator));
        setMarkets(marketData.markets);
        setProfile(profileRes.profile ?? { address: creator, createdAt: 0, updatedAt: 0 });
        setCreatorRevenue(creatorRev.summary ?? null);
        setReferrerRevenue(referrerRev.summary ?? null);
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

  const vestingEvents = useMemo(() => {
    const events: Array<{
      token: LaunchedToken;
      label: string;
      detail: string;
      at: number;
    }> = [];
    for (const t of tokens) {
      for (const v of t.vestingSchedule ?? []) {
        const unlockMs = t.createdAt + v.cliffMonths * 30 * 24 * 60 * 60 * 1000;
        events.push({
          token: t,
          label: `${v.cliffMonths}mo cliff · ${v.vestMonths}mo vest`,
          detail: `${v.pct}% → ${shortAddr(v.address)}`,
          at: unlockMs,
        });
      }
    }
    return events.sort((a, b) => a.at - b.at);
  }, [tokens]);

  const copyAddress = () => {
    void navigator.clipboard.writeText(address);
  };

  const copyProfileLink = () => {
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/creator/${creator}`
        : `/creator/${creator}`;
    void navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const onProfileSaved = useCallback((next: CreatorProfile) => {
    patchCreatorProfileCache(next);
    setProfile(next);
    if (!profileComplete) setSettingsOpen(false);
  }, [profileComplete]);

  const displayName = creatorDisplayName(profile, address);
  const shares = feeShareLabels();

  if (loading) {
    return <div className="h-64 rounded-2xl bg-[var(--surface-2)] animate-pulse" />;
  }

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: "launches", label: "Launches" },
    { id: "fees", label: "Fees" },
    { id: "vesting", label: "Vesting" },
    { id: "referrals", label: "Referrals" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {isOwner && !siweAuthenticated && connectedAddress && onSiweSignIn && (
        <SiweSignInBanner
          walletAddress={connectedAddress}
          authenticated={false}
          signingIn={siweSigningIn}
          onSignIn={onSiweSignIn}
        />
      )}

      {isOwner && !profileComplete && siweAuthenticated && (
        <CreatorProfileForm
          address={creator}
          profile={profile}
          variant="setup"
          onSaved={onProfileSaved}
          siweAuthenticated={siweAuthenticated}
          onSiweSignIn={onSiweSignIn}
        />
      )}

      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-5">
            <CreatorAvatar address={creator} profile={profile} size="xl" ring />
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-dim)]">
                Creator profile
              </p>
              <h1 className="truncate text-2xl font-bold text-[var(--ink)] sm:text-3xl">
                {displayName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm text-[var(--ink-muted)]">
                  {shortAddr(address, 8, 6)}
                </span>
                <button
                  type="button"
                  onClick={copyAddress}
                  className="rounded p-1 text-[var(--ink-dim)] hover:bg-[var(--surface-2)]"
                  aria-label="Copy address"
                >
                  <Copy size={14} />
                </button>
                <a
                  href={`https://basescan.org/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded p-1 text-[var(--brand-dark)] hover:bg-[var(--surface-2)]"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
              {profile?.bio && (
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-[var(--ink-muted)]">
                  {profile.bio}
                </p>
              )}
              {(profile?.website || profile?.twitter || profile?.telegram) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.website && (
                    <a
                      href={profile.website.startsWith("http") ? profile.website : `https://${profile.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-[var(--brand-dark)] hover:underline"
                    >
                      Website
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
                      className="text-[11px] font-semibold text-[var(--brand-dark)] hover:underline"
                    >
                      X
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
                      className="text-[11px] font-semibold text-[var(--brand-dark)] hover:underline"
                    >
                      Telegram
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={copyProfileLink}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] hover:border-[var(--brand)] sm:w-auto touch-manipulation"
            >
              <Link2 size={16} />
              {copied ? "Copied!" : "Profile link"}
            </button>
            {!connectedAddress && onConnect && (
              <button
                type="button"
                onClick={onConnect}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--brand-dark)] sm:w-auto touch-manipulation"
              >
                Connect to edit
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Launches", value: String(stats.launches) },
            {
              label: "Creator earnings",
              value:
                creatorRevenue && creatorRevenue.eventCount > 0
                  ? formatWeiEth(creatorRevenue.totalShare)
                  : stats.totalVol > 0
                    ? `~${estimatedEth.toFixed(4)} ETH`
                    : "—",
              hint: creatorRevenue?.estimated || creatorRevenue?.eventCount === 0 ? "est." : undefined,
            },
            { label: "24h volume", value: stats.totalVol > 0 ? formatUsd(stats.totalVol) : "—" },
            { label: "Total mcap", value: stats.totalMcap > 0 ? formatUsd(stats.totalMcap) : "—" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-3"
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--ink-dim)]">
                {s.label}
                {s.hint && <span className="ml-1 normal-case text-[var(--ink-muted)]">({s.hint})</span>}
              </p>
              <p className="mt-1 truncate font-mono text-sm font-bold text-[var(--ink)] sm:text-lg">
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {isOwner && profileComplete && (
          <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]">
            <button
              type="button"
              onClick={() => setSettingsOpen((o) => !o)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <Settings2 size={16} className="text-[var(--ink-muted)]" />
                <div>
                  <p className="text-sm font-bold text-[var(--ink)]">Profile settings</p>
                  <p className="text-[11px] text-[var(--ink-dim)]">
                    Photo, display name, bio, and social links
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-[var(--brand-dark)]">
                {settingsOpen ? "Hide" : "Edit"}
              </span>
            </button>
            {settingsOpen && (
              <div className="border-t border-[var(--border-subtle)] p-4">
                <CreatorProfileForm
                  address={creator}
                  profile={profile}
                  variant="settings"
                  onSaved={onProfileSaved}
                  siweAuthenticated={siweAuthenticated}
                  onSiweSignIn={onSiweSignIn}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <CreatorProfileBenefits />

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1 no-scrollbar touch-scroll-x">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-colors touch-manipulation sm:px-4 sm:py-2.5 sm:text-sm ${
              tab === t.id
                ? "bg-[var(--surface)] text-[var(--ink)] shadow-sm"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "launches" && (
        <section>
          {tokens.length === 0 ? (
            <p className="py-12 text-center text-[var(--ink-muted)]">
              No launches from this creator yet.
            </p>
          ) : (
            <>
              <div className="mb-4 flex items-center gap-2">
                <Rocket size={16} className="text-[var(--brand)]" />
                <h2 className="text-lg font-bold text-[var(--ink)]">Launched tokens</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tokens.map((t) => (
                  <TokenCard
                    key={t.address}
                    token={t}
                    market={markets[t.address.toLowerCase()]}
                    isMine={isOwner}
                    onTrade={() =>
                      onOpenToken
                        ? onOpenToken(t)
                        : (window.location.href = `/explore/token/${t.address}`)
                    }
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {tab === "fees" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div className="flex items-start gap-3">
              <TrendingUp size={20} className="mt-0.5 text-[var(--brand)]" />
              <div>
                <h2 className="text-lg font-bold text-[var(--ink)]">Creator revenue</h2>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  {formatPlatformFeeLabel()} swap fee on app-launched B20 tokens — split{" "}
                  <strong className="text-[var(--ink)]">{shares.creator}</strong> to you,{" "}
                  {shares.platform} platform, {shares.referrer} referrer. Fees pay instantly on
                  each swap (no claim step).
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Your share", value: shares.creator, accent: true },
                { label: "Platform", value: shares.platform },
                { label: "Referrer", value: shares.referrer },
              ].map((row) => (
                <div
                  key={row.label}
                  className={`rounded-xl border px-4 py-3 ${
                    row.accent
                      ? "border-[var(--brand)]/30 bg-[var(--brand-soft)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-2)]"
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase text-[var(--ink-dim)]">
                    {row.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{row.value}</p>
                </div>
              ))}
            </div>
          </div>

          {creatorRevenue && creatorRevenue.recent.length > 0 ? (
            <>
              <h3 className="text-sm font-bold text-[var(--ink)]">Recent fee events</h3>
              <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] overflow-hidden">
                {creatorRevenue.recent.map((e: FeeEvent) => (
                  <div
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-semibold text-[var(--ink)]">
                        ${e.tokenSymbol} · {e.direction}
                      </p>
                      <p className="text-[11px] text-[var(--ink-dim)]">{timeAgo(e.timestamp)}</p>
                    </div>
                    <p className="font-mono font-bold text-emerald-700">
                      +{formatWeiEth(e.creatorShare)}
                    </p>
                    <a
                      href={`https://basescan.org/tx/${e.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-[var(--brand-dark)] hover:underline"
                    >
                      View tx
                    </a>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-8 text-center text-sm text-[var(--ink-muted)]">
              {stats.totalVol > 0
                ? `Estimated ~${estimatedEth.toFixed(4)} ETH creator share from recent volume. Full history appears after swaps through this app.`
                : "Fee history appears here when traders swap your tokens through Base Analytics."}
            </p>
          )}

          {creatorRevenue && creatorRevenue.byToken.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-[var(--ink)]">Per token</h3>
              <div className="space-y-2">
                {creatorRevenue.byToken.map((row) => (
                  <Link
                    key={row.tokenAddress}
                    href={`/explore/token/${row.tokenAddress}`}
                    className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3 hover:border-[var(--brand)]"
                  >
                    <span className="font-semibold text-[var(--ink)]">${row.tokenSymbol}</span>
                    <span className="font-mono text-sm font-bold text-[var(--ink)]">
                      {formatWeiEth(row.creatorShare.toString())}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "vesting" && (
        <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-bold text-[var(--ink)]">Vesting schedule</h2>
          <p className="mt-1 text-sm text-[var(--ink-muted)]">
            Team allocations configured at launch. On-chain vault claims ship in a future update.
          </p>
          {vestingEvents.length === 0 ? (
            <p className="mt-6 text-center text-sm text-[var(--ink-dim)]">
              No vesting entries for this creator&apos;s tokens.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--border-subtle)]">
              {vestingEvents.map((e, i) => (
                <li key={`${e.token.address}-${i}`} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold text-[var(--ink)]">
                      ${e.token.symbol} · {e.label}
                    </p>
                    <p className="text-[11px] text-[var(--ink-dim)]">{e.detail}</p>
                  </div>
                  <span className="text-[11px] text-[var(--ink-muted)]">
                    {new Date(e.at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "referrals" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5">
            <div className="flex items-start gap-3">
              <Gift size={20} className="text-[var(--brand)]" />
              <div>
                <h2 className="text-lg font-bold text-[var(--ink)]">Referral earnings</h2>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">
                  Share token links with{" "}
                  <code className="rounded bg-[var(--surface-2)] px-1 text-[12px]">?ref=your_address</code>.
                  You earn {shares.referrer} of the swap fee when others trade through your link.
                </p>
              </div>
            </div>
            <p className="mt-4 font-mono text-lg font-bold text-[var(--ink)]">
              {referrerRevenue && referrerRevenue.eventCount > 0
                ? formatWeiEth(referrerRevenue.totalShare)
                : "—"}
            </p>
            <p className="text-[11px] text-[var(--ink-dim)]">
              {referrerRevenue?.eventCount ?? 0} referred swaps recorded
            </p>
          </div>
          {tokens.length > 0 && isOwner && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-[var(--ink)]">Your token referral links</h3>
              <div className="space-y-2">
                {tokens.map((t) => {
                  const link =
                    typeof window !== "undefined"
                      ? `${window.location.origin}/explore/token/${t.address}?ref=${creator}`
                      : `/explore/token/${t.address}?ref=${creator}`;
                  return (
                    <div
                      key={t.address}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-3"
                    >
                      <span className="font-semibold text-[var(--ink)]">${t.symbol}</span>
                      <button
                        type="button"
                        onClick={() => void navigator.clipboard.writeText(link)}
                        className="text-[11px] font-bold text-[var(--brand-dark)] hover:underline"
                      >
                        Copy link
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
