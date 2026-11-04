"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Radar, Plus, ExternalLink, ArrowRight, TrendingUp, RefreshCw, AlertCircle } from "lucide-react";
import { FEATURES } from "@/lib/constants/features";
import {
  readFollowedSmartMoney,
  followSmartMoney,
  unfollowSmartMoney,
  type SmartMoneyWallet,
  type SmartMoneyBuyEvent,
} from "@/lib/smart-money/smart-money-store";
import { shortAddr } from "@/lib/launchpad/format";
import Link from "next/link";

interface SmartMoneyRadarProps {
  userWallet?: string | null;
  onTradeToken?: (address: string) => void;
}

export default function SmartMoneyRadar({ userWallet, onTradeToken }: SmartMoneyRadarProps) {
  const [wallets, setWallets] = useState<SmartMoneyWallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [events, setEvents] = useState<SmartMoneyBuyEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [customAddress, setCustomAddress] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const loadFeed = useCallback(async (walletToQuery?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const q = walletToQuery ? `?wallet=${encodeURIComponent(walletToQuery)}` : "";
      const res = await fetch(`/api/smart-money${q}`);
      if (!res.ok) throw new Error("Failed to load smart money feed");
      const data = (await res.json()) as { recentBuys?: SmartMoneyBuyEvent[] };
      setEvents(data?.recentBuys || []);
    } catch {
      setError("Base indexer temporarily busy. Tap refresh to retry.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const list = readFollowedSmartMoney(userWallet);
    setWallets(list);
    void loadFeed(selectedWallet || list[0]?.address);
  }, [userWallet, selectedWallet, loadFeed]);

  // Guard behind feature flag
  if (!FEATURES.SMART_MONEY_RADAR) {
    return null;
  }

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customAddress.startsWith("0x") || customAddress.length !== 42) return;
    const updated = followSmartMoney(userWallet, {
      address: customAddress,
      label: customLabel || undefined,
    });
    setWallets(updated);
    setSelectedWallet(customAddress);
    setCustomAddress("");
    setCustomLabel("");
    setShowAddForm(false);
  };

  const handleRemove = (addr: string) => {
    const updated = unfollowSmartMoney(userWallet, addr);
    setWallets(updated);
    if (selectedWallet?.toLowerCase() === addr.toLowerCase()) {
      setSelectedWallet(updated[0]?.address || null);
    }
  };

  return (
    <div
      data-testid="smart-money-radar"
      className="card-pop rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 space-y-5 shadow-xs"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center border border-[#0052FF]/20 shadow-xs shrink-0">
            <Radar size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-[var(--ink)]">Smart Money Radar</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0052FF] text-white">
                Live On-Chain
              </span>
            </div>
            <p className="text-xs text-[var(--ink-muted)]">
              Follow top Base whale addresses and track real-time token buys
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => void loadFeed(selectedWallet || undefined)}
            disabled={isLoading}
            className="pop-pill p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
            title="Refresh feed"
          >
            <RefreshCw size={13} className={isLoading ? "animate-spin text-[var(--brand)]" : ""} />
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm((v) => !v)}
            className="pop-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--surface-2)] border border-[var(--border-subtle)] hover:border-[var(--brand)] text-[var(--ink)] cursor-pointer"
          >
            <Plus size={14} />
            <span>Follow Wallet</span>
          </button>
        </div>
      </div>

      {/* Add Custom Wallet Form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-3 text-xs">
          <p className="font-bold text-[var(--ink)]">Track a new Base Smart Money wallet</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="0x… Base wallet address"
              value={customAddress}
              onChange={(e) => setCustomAddress(e.target.value.trim())}
              className="px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--ink)] outline-none focus:border-[var(--brand)] font-mono"
            />
            <input
              type="text"
              placeholder="Wallet label (e.g. Aerodrome Whale)"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--ink)] outline-none focus:border-[var(--brand)]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 rounded-xl text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-[#0052FF] text-white font-bold cursor-pointer hover:bg-[#0047e0]"
            >
              Follow
            </button>
          </div>
        </form>
      )}

      {/* Wallets Pill Bar */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs">
        {wallets.map((w) => {
          const isSelected = selectedWallet?.toLowerCase() === w.address.toLowerCase();
          return (
            <div
              key={w.address}
              onClick={() => setSelectedWallet(w.address)}
              className={`shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer transition ${
                isSelected
                  ? "bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)]"
                  : "bg-[var(--surface-2)] border-[var(--border-subtle)] text-[var(--ink)] hover:border-[var(--brand-muted)]"
              }`}
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <div className="flex flex-col">
                <span className="font-bold text-[11px] leading-tight">{w.label}</span>
                <span className="font-mono text-[9px] text-[var(--ink-muted)]">{w.tag || shortAddr(w.address)}</span>
              </div>
              {!w.isPreset && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(w.address);
                  }}
                  className="text-[var(--ink-dim)] hover:text-rose-500 cursor-pointer text-xs ml-1"
                  title="Unfollow"
                >
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Live Recent Buys Stream */}
      <div className="space-y-2">
        <span className="text-[10px] font-black uppercase tracking-wider text-[var(--ink-muted)] block">
          Recent Smart Money Inflows
        </span>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/40 flex items-center justify-between animate-pulse"
              >
                <div className="space-y-1.5">
                  <div className="h-3.5 w-36 bg-[var(--border-subtle)] rounded" />
                  <div className="h-2.5 w-48 bg-[var(--border-subtle)] rounded" />
                </div>
                <div className="h-7 w-20 bg-[var(--border-subtle)] rounded-xl" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-xs text-[var(--ink-muted)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="text-amber-500 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadFeed(selectedWallet || undefined)}
              className="px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] text-[11px] font-bold text-[var(--ink)] cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-2)]/30 text-center space-y-1.5 text-xs">
            <p className="font-bold text-[var(--ink)]">No recent inflows detected in the last 24h</p>
            <p className="text-[var(--ink-muted)] max-w-sm mx-auto text-[11px]">
              This tracked wallet has not acquired new tokens recently on Base mainnet. Switch wallets above or follow another whale address.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/50 overflow-hidden text-xs">
            {events.map((ev, idx) => (
              <div
                key={`${ev.txHash}-${idx}`}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-[var(--surface-2)] transition"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <TrendingUp size={15} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--ink)]">{ev.walletLabel}</span>
                      <span className="text-[10px] text-[var(--ink-dim)]">acquired</span>
                      <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">
                        +{ev.amount} ${ev.tokenSymbol}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-[var(--ink-muted)]">
                      {ev.usdValue !== null
                        ? `Est. Value: $${ev.usdValue.toLocaleString()} USD`
                        : "Verified on-chain transfer"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <a
                    href={`https://basescan.org/tx/${ev.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)] transition"
                    title="View on BaseScan"
                  >
                    <ExternalLink size={13} />
                  </a>
                  {onTradeToken ? (
                    <button
                      type="button"
                      onClick={() => onTradeToken(ev.tokenAddress)}
                      className="pop-pill inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold bg-[#0052FF] text-white hover:bg-[#0047e0] transition shadow-xs text-xs cursor-pointer"
                    >
                      <span>Trade</span>
                      <ArrowRight size={13} />
                    </button>
                  ) : (
                    <Link
                      href={`/swap?buy=${ev.tokenAddress}`}
                      className="pop-pill inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold bg-[#0052FF] text-white hover:bg-[#0047e0] transition shadow-xs text-xs cursor-pointer"
                    >
                      <span>Trade</span>
                      <ArrowRight size={13} />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
