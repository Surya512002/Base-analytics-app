"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Coins,
  LayoutList,
  Lock,
  PanelTop,
  Rocket,
  ShieldCheck,
  Sparkles,
  Unlock,
  Wallet,
} from "lucide-react";
import ActivePill from "@/components/ui/motion/ActivePill";
import TokenLogo from "@/components/ui/TokenLogo";
import {
  FIRST_BUY_PRESETS,
  START_CAP_PRESETS,
  compactNumber,
  compactUsd,
  estimateFirstBuy,
  seedTokensFor,
  LAUNCH_SUPPLY,
} from "@/lib/launchpad/first-buy";
import { VENUE_OPTIONS, type LaunchVenueId } from "@/lib/launchpad/launch-configs";
import type { LaunchTokenType } from "@/lib/launchpad/types";

const card = "rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-5 space-y-3";
const eyebrow = "text-[10px] font-black uppercase tracking-widest text-[var(--ink-muted)]";

// ─────────────────────────── Starting market cap ───────────────────────────

export function StartingCapPicker({
  startPriceUsd,
  onChange,
  ethUsd,
  seedLiquidityEth,
  autoSeedLiquidity,
}: {
  startPriceUsd: string;
  onChange: (priceUsd: string) => void;
  ethUsd: number;
  seedLiquidityEth: string;
  autoSeedLiquidity: boolean;
}) {
  const price = parseFloat(startPriceUsd);
  const seedEth = parseFloat(seedLiquidityEth);
  const seedTokens = autoSeedLiquidity ? seedTokensFor(seedEth, price, ethUsd) : 0;
  return (
    <section className={card}>
      <div>
        <p className={eyebrow}>Starting market cap</p>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          {compactNumber(LAUNCH_SUPPLY)} supply. This sets the opening price your pool starts at.
        </p>
      </div>
      <div role="radiogroup" aria-label="Starting market cap" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {START_CAP_PRESETS.map((p, i) => {
          const selected = startPriceUsd === p.priceUsd;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(p.priceUsd)}
              className={`relative isolate cursor-pointer rounded-xl border px-3 py-2.5 text-left transition ${
                selected ? "border-[var(--brand)] text-white" : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] hover:border-[var(--brand)]/50"
              }`}
            >
              {selected && <ActivePill layoutId="start-cap-pill" className="bg-[var(--brand)]" />}
              <span className="block font-mono text-base font-black">{compactUsd(p.capUsd)}</span>
              <span className={`block text-[11px] ${selected ? "text-white/85" : "text-[var(--ink-muted)]"}`}>
                {ethUsd > 0 ? `${(p.capUsd / ethUsd).toFixed(2)} ETH` : "—"}
                {i === 0 ? " · lowest" : ""}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-[var(--ink-muted)]">
        Opens at <b className="text-[var(--ink)]">{compactUsd(price * LAUNCH_SUPPLY)}</b> fully diluted.
        {autoSeedLiquidity && seedTokens > 0 ? (
          <>
            {" "}Your {seedLiquidityEth} ETH seed pairs with about <b className="text-[var(--ink)]">{compactNumber(seedTokens)}</b> tokens
            ({((seedTokens / LAUNCH_SUPPLY) * 100).toFixed(4)}% of supply).
          </>
        ) : (
          " Turn on seeded liquidity to open a pool at this price."
        )}
      </p>
    </section>
  );
}

// ─────────────────────────── First buy ───────────────────────────

export function FirstBuyPicker({
  value,
  onChange,
  startPriceUsd,
  ethUsd,
  seedLiquidityEth,
  autoSeedLiquidity,
  seedDex,
}: {
  value: string;
  onChange: (eth: string) => void;
  startPriceUsd: string;
  ethUsd: number;
  seedLiquidityEth: string;
  autoSeedLiquidity: boolean;
  seedDex: LaunchVenueId;
}) {
  const est =
    value && autoSeedLiquidity
      ? estimateFirstBuy({
          buyEth: parseFloat(value),
          seedEth: parseFloat(seedLiquidityEth),
          startPriceUsd: parseFloat(startPriceUsd),
          ethUsd,
          pools: seedDex === "both" ? 2 : 1,
        })
      : null;
  const heavy = est && (est.poolTaken > 0.5 || est.priceImpactPct > 100);

  return (
    <section className={card}>
      <div>
        <p className={eyebrow}>First buy · suggested</p>
        <p className="mt-1 text-xs text-[var(--ink-muted)]">
          A token with no buys looks dead on every screener. Your first buy opens the chart. It&apos;s a separate step
          right after the launch confirms. Skip it and the launch stays as it is.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {FIRST_BUY_PRESETS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={`cursor-pointer rounded-full border px-3 py-1.5 font-mono text-xs font-bold transition ${
              value === v
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:border-[var(--brand)]/50 hover:text-[var(--ink)]"
            }`}
          >
            {v} ETH{ethUsd > 0 ? ` · ≈$${(parseFloat(v) * ethUsd).toFixed(0)}` : ""}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={value === ""}
          onClick={() => onChange("")}
          className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold transition ${
            value === "" ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
          }`}
        >
          No first buy
        </button>
      </div>

      {value && !autoSeedLiquidity && (
        <p className="text-xs text-[var(--ink-muted)]">You&apos;ll be able to buy once a pool exists. Turn on seeded liquidity to open one at launch.</p>
      )}
      {est && (
        <div className={`rounded-xl border p-3 text-xs ${heavy ? "border-amber-500/30 bg-amber-500/10" : "border-[var(--border-subtle)] bg-[var(--surface-2)]"}`}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div>
              <p className="text-[var(--ink-muted)]">Estimated tokens</p>
              <p className="font-mono font-black text-[var(--ink)]">
                {compactNumber(est.tokens)} <span className="text-[var(--ink-muted)]">({est.pctOfSupply.toFixed(4)}%)</span>
              </p>
            </div>
            <div>
              <p className="text-[var(--ink-muted)]">Price impact</p>
              <p className={`font-mono font-black ${heavy ? "text-amber-600 dark:text-amber-400" : "text-[var(--ink)]"}`}>
                +{est.priceImpactPct >= 1000 ? compactNumber(est.priceImpactPct) : est.priceImpactPct.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-[var(--ink-muted)]">Market cap after</p>
              <p className="font-mono font-black text-[var(--ink)]">{compactUsd(est.marketCapAfterUsd)}</p>
            </div>
          </div>
          {heavy && (
            <p className="mt-2 flex items-start gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              This buy takes {(est.poolTaken * 100).toFixed(0)}% of the pooled tokens. Seed more ETH or buy less so the
              chart doesn&apos;t open with a huge spike.
            </p>
          )}
          <p className="mt-2 text-[var(--ink-dim)]">Estimate before the pool fee; the exact amount is quoted when you buy.</p>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────── What happens when you sign ───────────────────────────

export function SignChecklist(props: {
  launchType: LaunchTokenType;
  symbol: string;
  quoteSymbol: string;
  vanityAddress: string | null;
  creatorPct: number;
  vestedTotalPct: number;
  autoSeedLiquidity: boolean;
  seedDex: LaunchVenueId;
  seedLiquidityEth: string;
  startPriceUsd: string;
  liquidityLocked: boolean;
  lockDurationDays: number;
  antiSnipeBlocks: number;
  metadataEditable: boolean;
  firstBuyEth: string;
}) {
  const sym = props.symbol.trim().toUpperCase() || "your token";
  const venue = VENUE_OPTIONS.find((v) => v.id === props.seedDex)?.name ?? props.seedDex;
  const cap = compactUsd(parseFloat(props.startPriceUsd) * LAUNCH_SUPPLY);
  const items: Array<{ icon: React.ElementType; title: string; note: string; warn?: boolean }> = [
    {
      icon: Coins,
      title:
        props.launchType === "b20"
          ? `Deploys ${sym} as a B20 token`
          : props.launchType === "memestock"
            ? `Deploys ${sym}, paired with ${props.quoteSymbol}`
            : `Deploys ${sym} as a standard ERC-20`,
      note: `${compactNumber(LAUNCH_SUPPLY)} fixed supply${props.vanityAddress ? ` at ${props.vanityAddress.slice(0, 8)}…${props.vanityAddress.slice(-4)}` : ""}.`,
    },
    {
      icon: Wallet,
      title: `Sends you ${props.creatorPct}% of supply`,
      note: props.vestedTotalPct > 0 ? `${props.vestedTotalPct}% more vests over time.` : "No vesting schedule.",
    },
    props.autoSeedLiquidity
      ? {
          icon: Rocket,
          title: props.seedDex === "both" ? "Opens pools on Aerodrome and Uniswap V3" : `Opens a pool on ${venue}`,
          note: `${props.seedLiquidityEth} ETH + your tokens, opening at ${cap}.` }
      : { icon: AlertTriangle, title: "No pool is opened", note: "Nobody can trade until you add liquidity.", warn: true },
    props.liquidityLocked
      ? { icon: Lock, title: `Locks liquidity for ${props.lockDurationDays} days`, note: "Shown to buyers as LP locked." }
      : { icon: Unlock, title: "Liquidity stays unlocked", note: "Buyers will see this as a rug-pull risk.", warn: true },
    props.antiSnipeBlocks > 0
      ? { icon: ShieldCheck, title: `Blocks buys for ${props.antiSnipeBlocks} blocks`, note: "Stops snipers at the opening second." }
      : { icon: AlertTriangle, title: "No anti-snipe window", note: "Bots can buy in the first block.", warn: true },
    {
      icon: Sparkles,
      title: props.metadataEditable ? "Metadata stays editable" : "Metadata is fixed",
      note: props.metadataEditable ? "You can update name, logo and links later." : "Name, logo and links can't change later.",
    },
  ];
  if (props.firstBuyEth) {
    items.push({
      icon: CheckCircle2,
      title: `Then: your first buy of ${props.firstBuyEth} ETH`,
      note: "A separate, optional step after the launch confirms.",
    });
  }
  return (
    <section className={card}>
      <p className={eyebrow}>What happens when you sign</p>
      <ol className="space-y-2.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                it.warn ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-[var(--brand-soft)] text-[var(--brand-text)]"
              }`}
            >
              <it.icon size={14} />
            </span>
            <span>
              <span className="block text-sm font-bold text-[var(--ink)]">{it.title}</span>
              <span className="block text-xs text-[var(--ink-muted)]">{it.note}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-[var(--ink-dim)]">Gas only, usually a few cents on Base. Nothing here can be undone after it confirms.</p>
    </section>
  );
}

// ─────────────────────────── Board / token page preview ───────────────────────────

export function LaunchLivePreview({
  name,
  symbol,
  description,
  imagePreview,
  startPriceUsd,
  quoteSymbol,
  liquidityLocked,
  antiSnipeBlocks,
}: {
  name: string;
  symbol: string;
  description: string;
  imagePreview: string | null;
  startPriceUsd: string;
  quoteSymbol: string;
  liquidityLocked: boolean;
  antiSnipeBlocks: number;
}) {
  const [tab, setTab] = useState<"board" | "page">("board");
  const sym = symbol.trim().toUpperCase() || "TICKER";
  const nm = name.trim() || "Your token";
  const cap = compactUsd(parseFloat(startPriceUsd) * LAUNCH_SUPPLY);
  const logo = <TokenLogo src={imagePreview ?? undefined} symbol={sym} size={36} />;

  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-2">
        <p className={eyebrow}>Preview</p>
        <div role="tablist" aria-label="Preview" className="flex gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1">
          {(
            [
              ["board", LayoutList, "On the board"],
              ["page", PanelTop, "Token page"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`relative isolate flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                tab === id ? "text-white" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
              }`}
            >
              {tab === id && <ActivePill layoutId="launch-preview-tab" className="bg-[var(--brand)]" />}
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "board" ? (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3">
          {logo}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-[var(--ink)]">{sym}</p>
            <p className="truncate text-[11px] text-[var(--ink-muted)]">{nm} · now</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-sm font-bold text-[var(--ink)]">{cap}</p>
            <p className="font-mono text-[11px] text-[var(--ink-muted)]">+0.0%</p>
          </div>
          <div className="hidden flex-col items-end gap-1 sm:flex">
            {liquidityLocked && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                <Lock size={10} /> LP locked
              </span>
            )}
            <span className="rounded-full bg-[var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-text)]">Just launched</span>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)]">
          <div className="h-12 bg-gradient-to-r from-[var(--brand)] via-blue-400 to-indigo-500 opacity-80" />
          <div className="-mt-6 space-y-2 px-3 pb-3">
            <div className="flex items-end gap-2">
              <span className="rounded-full ring-4 ring-[var(--surface-2)]">{logo}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-[var(--ink)]">{nm}</p>
                <p className="text-[11px] text-[var(--ink-muted)]">
                  ${sym} · paired with {quoteSymbol}
                </p>
              </div>
            </div>
            {description.trim() && <p className="line-clamp-2 text-xs text-[var(--ink-muted)]">{description}</p>}
            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
              <div className="rounded-lg bg-[var(--surface)] p-1.5">
                <p className="text-[var(--ink-muted)]">Market cap</p>
                <p className="font-mono font-bold text-[var(--ink)]">{cap}</p>
              </div>
              <div className="rounded-lg bg-[var(--surface)] p-1.5">
                <p className="text-[var(--ink-muted)]">Liquidity</p>
                <p className="font-bold text-[var(--ink)]">{liquidityLocked ? "Locked" : "Unlocked"}</p>
              </div>
              <div className="rounded-lg bg-[var(--surface)] p-1.5">
                <p className="text-[var(--ink-muted)]">Anti-snipe</p>
                <p className="font-bold text-[var(--ink)]">{antiSnipeBlocks > 0 ? `${antiSnipeBlocks} blocks` : "Off"}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
