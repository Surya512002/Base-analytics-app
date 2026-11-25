"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Compass,
  Clock,
  Radar,
  Bell,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Plus,
} from "lucide-react";
import { BASE_STOCKS } from "@/lib/stocks/base-stocks";
import {
  computeNavSpread,
  getEquityMarketStatus,
  type StockNavComparison,
} from "@/lib/stocks/nav-tracker";
import {
  readFollowedSmartMoney,
  followSmartMoney,
  type SmartMoneyWallet,
  type SmartMoneyBuyEvent,
} from "@/lib/smart-money/smart-money-store";
import {
  readSmarterAlerts,
  saveSmarterAlert,
  deleteSmarterAlert,
  type SmarterAlert,
  type AlertTriggerType,
  type AlertChannel,
} from "@/lib/alerts/smarter-alerts";
import { ALERTS_CHANGED, alertAddress, isWatchable } from "@/lib/alerts/price-watch";
import { ageText, readChainlinkReference } from "@/lib/stocks/chainlink-reference";
import { shortAddr } from "@/lib/launchpad/format";
import type { StockMarketItem } from "@/lib/markets/types";
import BodyPortal from "@/components/ui/BodyPortal";

type IntelligenceTab = "nav" | "smart_money" | "alerts";

interface MarketIntelligenceHubProps {
  userWallet?: string | null;
  onTradeToken?: (address: string) => void;
  stockMarkets?: StockMarketItem[];
}

export default function MarketIntelligenceHub({
  userWallet,
  onTradeToken,
  stockMarkets = [],
}: MarketIntelligenceHubProps) {
  const [activeTab, setActiveTab] = useState<IntelligenceTab>("nav");

  // ─────────────────────────────────────────────────────────────
  // 1. NAV TRACKER STATE & CALCULATIONS
  // ─────────────────────────────────────────────────────────────
  const [selectedNavSymbol, setSelectedNavSymbol] = useState<string>("NVDAc");
  const marketStatus = useMemo(() => getEquityMarketStatus(), []);

  // Map stock with live prices from stockMarkets if available
  const activeStock = useMemo(() => {
    const fromBase = BASE_STOCKS.find((s) => s.symbol === selectedNavSymbol) ?? BASE_STOCKS[0];
    const liveMarket = stockMarkets.find(
      (m) => m.symbol.toLowerCase() === selectedNavSymbol.toLowerCase()
    );

    const price = liveMarket?.price || 135.25; // live price or fallback anchor
    const change24h = liveMarket?.change24h || 1.85;

    return {
      symbol: fromBase?.symbol || selectedNavSymbol,
      name: fromBase?.name || "Nvidia Corp (Backed)",
      address: fromBase?.address || "0xb20000000000000000000078ee7ce2fe4908108c",
      price,
      change24h,
    };
  }, [selectedNavSymbol, stockMarkets]);

  // The stock's Chainlink price on Base, read live. Stocks without a feed show no comparison.
  const [reference, setReference] = useState<{ address: string; price: number | null; updatedAt: number } | null>(null);
  const referenceAddress = activeStock?.address;
  useEffect(() => {
    if (!referenceAddress) return;
    let alive = true;
    void readChainlinkReference(referenceAddress).then((r) => {
      if (alive) setReference({ address: referenceAddress, price: r?.price ?? null, updatedAt: r?.updatedAt ?? 0 });
    });
    return () => {
      alive = false;
    };
  }, [referenceAddress]);

  const navComparison: StockNavComparison | null = useMemo(() => {
    if (!activeStock) return null;
    return computeNavSpread({
      symbol: activeStock.symbol,
      name: activeStock.name,
      contractAddress: activeStock.address,
      dexPriceUsd: activeStock.price,
      oracleNavUsd: reference?.address === activeStock.address ? reference.price : null,
    });
  }, [activeStock, reference]);

  // ─────────────────────────────────────────────────────────────
  // 2. SMART MONEY RADAR STATE & FEED
  // ─────────────────────────────────────────────────────────────
  const [wallets, setWallets] = useState<SmartMoneyWallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [radarEvents, setRadarEvents] = useState<SmartMoneyBuyEvent[]>([]);
  const [isLoadingRadar, setIsLoadingRadar] = useState<boolean>(false);
  const [radarError, setRadarError] = useState<string | null>(null);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [customWalletAddr, setCustomWalletAddr] = useState("");
  const [customWalletLabel, setCustomWalletLabel] = useState("");

  const loadSmartMoneyFeed = React.useCallback(async (targetWallet?: string) => {
    setIsLoadingRadar(true);
    setRadarError(null);
    try {
      const q = targetWallet ? `?wallet=${encodeURIComponent(targetWallet)}` : "";
      const res = await fetch(`/api/smart-money${q}`);
      if (!res.ok) throw new Error("Feed query error");
      const data = await res.json();
      setRadarEvents(data?.recentBuys || []);
    } catch {
      setRadarEvents([]);
      setRadarError("Wallet activity is unavailable right now.");
    } finally {
      setIsLoadingRadar(false);
    }
  }, []);

  React.useEffect(() => {
    const list = readFollowedSmartMoney(userWallet);
    setWallets(list);
    if (!selectedWallet && list.length > 0) {
      setSelectedWallet(list[0].address);
    }
    void loadSmartMoneyFeed(selectedWallet || list[0]?.address);
  }, [userWallet, selectedWallet, loadSmartMoneyFeed]);

  const handleAddWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customWalletAddr.startsWith("0x") || customWalletAddr.length !== 42) return;
    const updated = followSmartMoney(userWallet, {
      address: customWalletAddr,
      label: customWalletLabel || undefined,
    });
    setWallets(updated);
    setSelectedWallet(customWalletAddr);
    setCustomWalletAddr("");
    setCustomWalletLabel("");
    setShowAddWallet(false);
  };

  // ─────────────────────────────────────────────────────────────
  // 3. SMARTER ALERTS STATE
  // ─────────────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState<SmarterAlert[]>([]);
  const [showAlertModal, setShowAlertModal] = useState<boolean>(false);
  const [alertError, setAlertError] = useState("");
  const [alertChannel, setAlertChannel] = useState<AlertChannel>("in_app");
  const [alertSymbol, setAlertSymbol] = useState<string>("NVDAc");
  const [alertThreshold, setAlertThreshold] = useState<number>(0);
  const [alertDirection, setAlertDirection] = useState<"above" | "below">("above");

  React.useEffect(() => {
    const read = () => setAlerts(readSmarterAlerts(userWallet));
    read();
    window.addEventListener(ALERTS_CHANGED, read);
    return () => window.removeEventListener(ALERTS_CHANGED, read);
  }, [userWallet]);

  const alertsChanged = () => window.dispatchEvent(new Event(ALERTS_CHANGED));

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    const symbol = alertSymbol.trim();
    if (!alertAddress({ targetSymbol: symbol })) return setAlertError("Use a stock symbol such as NVDAc, or a major token such as ETH or cbBTC.");
    if (!(alertThreshold > 0)) return setAlertError("Enter a price above zero.");
    setAlertError("");

    if (alertChannel === "browser" && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission !== "granted") {
        await Notification.requestPermission();
      }
    }

    setAlerts(
      saveSmarterAlert(userWallet, {
        type: "price",
        channel: alertChannel,
        targetSymbol: symbol,
        thresholdValue: alertThreshold,
        direction: alertDirection,
      })
    );
    setShowAlertModal(false);
    alertsChanged();
  };

  const handleDeleteAlert = (id: string) => {
    setAlerts(deleteSmarterAlert(userWallet, id));
    alertsChanged();
  };

  const handleQuickAddAlert = (preset: {
    type: AlertTriggerType;
    targetSymbol: string;
    thresholdValue: number;
    direction?: "above" | "below";
  }) => {
    setAlerts(
      saveSmarterAlert(userWallet, {
        type: preset.type,
        channel: "in_app",
        targetSymbol: preset.targetSymbol,
        thresholdValue: preset.thresholdValue,
        direction: preset.direction,
      })
    );
    alertsChanged();
  };

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, []);

  return (
    <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 sm:p-6 shadow-xs space-y-4 transition-all">
      {/* ─────────────────────────────────────────────────────────────
          MASTER HEADER & SEGMENTED TABS
          ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]/70">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center border border-[#0052FF]/20 shadow-xs shrink-0">
            <Compass size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-[var(--ink)] tracking-tight">
                Market Intelligence Hub
              </h3>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
            <p className="text-[11px] text-[var(--ink-muted)]">
              Stock price check against Chainlink, wallet watch and price alerts
            </p>
          </div>
        </div>

        {/* Sleek Segmented Switcher */}
        <div className="flex items-center p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] gap-1 self-start md:self-auto overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab("nav")}
            className={`pop-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "nav"
                ? "bg-[#0052FF] text-white shadow-xs"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Clock size={13} />
            <span>Stock NAV Tracker</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === "nav" ? "bg-white/20 text-white" : "bg-[var(--surface)] text-[var(--ink-muted)] border border-[var(--border-subtle)]"
              }`}
            >
              24/5
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("smart_money")}
            className={`pop-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "smart_money"
                ? "bg-[#0052FF] text-white shadow-xs"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Radar size={13} />
            <span>Smart Money Radar</span>
            <span
              className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                activeTab === "smart_money" ? "bg-white/20 text-white" : "bg-[var(--surface)] text-[var(--ink-muted)] border border-[var(--border-subtle)]"
              }`}
            >
              Wallets
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("alerts")}
            className={`pop-pill px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "alerts"
                ? "bg-[#0052FF] text-white shadow-xs"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Bell size={13} />
            <span>Smarter Alerts</span>
            {alerts.length > 0 && (
              <span
                className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  activeTab === "alerts" ? "bg-white text-[#0052FF]" : "bg-[#0052FF] text-white"
                }`}
              >
                {alerts.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: STOCK NAV TRACKER (24/5 vs 24/7)
          ───────────────────────────────────────────────────────────── */}
      {activeTab === "nav" && (
        <div className="space-y-3.5 animate-fadeIn">
          {/* Subheader: Stock Selector Chips + Market Hours */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
              {BASE_STOCKS.slice(0, 8).map((stk) => {
                const isSelected = stk.symbol === selectedNavSymbol;
                return (
                  <button
                    key={stk.symbol}
                    type="button"
                    onClick={() => setSelectedNavSymbol(stk.symbol)}
                    className={`pop-pill shrink-0 px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? "bg-[#0052FF] text-white shadow-xs"
                        : "bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {stk.symbol}
                  </button>
                );
              })}
            </div>

            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold self-start sm:self-auto shrink-0 ${
                marketStatus.isOpen
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  marketStatus.isOpen ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              <span>{marketStatus.statusText} · {todayFormatted}</span>
            </div>
          </div>

          {/* Pricing Grid */}
          {navComparison && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] space-y-0.5">
                <span className="text-[11px] text-[var(--ink-muted)] block font-medium">
                  24/7 DEX AMM Pool Price
                </span>
                <span className="font-mono font-black text-base text-[var(--ink)] block tabular-nums">
                  ${navComparison.dexPriceUsd?.toFixed(2)}
                </span>
                <span className="text-[11px] text-[var(--ink-dim)]">Aerodrome / Uniswap on Base</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] space-y-0.5">
                <span className="text-[11px] text-[var(--ink-muted)] block font-medium">
                  Chainlink price
                </span>
                <span className="font-mono font-black text-base text-[var(--ink)] block tabular-nums">
                  {navComparison.oracleNavUsd != null ? `$${navComparison.oracleNavUsd.toFixed(2)}` : "—"}
                </span>
                <span className="text-[11px] text-[var(--ink-dim)]">
                  {navComparison.oracleNavUsd != null && reference ? `On-chain feed, updated ${ageText(reference.updatedAt)}` : "No live Chainlink feed for this stock"}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--surface-2)]/60 border border-[var(--border-subtle)] space-y-0.5">
                <span className="text-[11px] text-[var(--ink-muted)] block font-medium">
                  Difference
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono font-black text-base block tabular-nums text-[var(--ink)]">
                    {navComparison.spreadPct == null ? "—" : `${navComparison.spreadPct >= 0 ? "+" : ""}${navComparison.spreadPct.toFixed(2)}%`}
                  </span>
                  {navComparison.spreadPct != null && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full font-bold font-mono border border-[var(--border-subtle)] text-[var(--ink-muted)]">
                      {navComparison.statusLabel}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-[var(--ink-dim)]">Pool price against Chainlink. Stock feeds pause outside US market hours, so gaps are normal then.</span>
              </div>
            </div>
          )}

          {/* Footer Proof Links */}
          <div className="flex items-center justify-between pt-1 text-[11px] text-[var(--ink-muted)] border-t border-[var(--border-subtle)]/60">
            <span className="flex items-center gap-1">
              <ShieldCheck size={12} className="text-[#0052FF]" />
              <span>For information only. Check the issuer&apos;s terms before trading.</span>
            </span>
            <div className="flex items-center gap-3 font-semibold">
              <a
                href={`https://basescan.org/token/${activeStock.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--brand)] inline-flex items-center gap-0.5 underline transition"
              >
                <span>Basescan</span>
                <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: SMART MONEY RADAR
          ───────────────────────────────────────────────────────────── */}
      {activeTab === "smart_money" && (
        <div className="space-y-3 animate-fadeIn">
          {/* Whale Selector Pills & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
              {wallets.map((w) => {
                const isSelected = selectedWallet?.toLowerCase() === w.address.toLowerCase();
                return (
                  <button
                    key={w.address}
                    type="button"
                    onClick={() => {
                      setSelectedWallet(w.address);
                      void loadSmartMoneyFeed(w.address);
                    }}
                    className={`pop-pill shrink-0 px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? "bg-[#0052FF] text-white shadow-xs"
                        : "bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>{w.label || shortAddr(w.address)}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => void loadSmartMoneyFeed(selectedWallet || undefined)}
                disabled={isLoadingRadar}
                className="pop-pill p-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition cursor-pointer"
                title="Refresh feed"
              >
                <RefreshCw size={13} className={isLoadingRadar ? "animate-spin text-[#0052FF]" : ""} />
              </button>

              <button
                type="button"
                onClick={() => setShowAddWallet((v) => !v)}
                className="pop-pill px-2.5 py-1 rounded-xl border border-[var(--brand)]/30 bg-[var(--brand-soft)] text-[var(--brand-text)] text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Plus size={12} />
                <span>Follow Wallet</span>
              </button>
            </div>
          </div>

          {/* Follow Custom Wallet Form */}
          {showAddWallet && (
            <form
              onSubmit={handleAddWallet}
              className="p-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] flex flex-col sm:flex-row items-center gap-2"
            >
              <input
                type="text"
                placeholder="0x... Base wallet address"
                value={customWalletAddr}
                onChange={(e) => setCustomWalletAddr(e.target.value)}
                className="w-full sm:flex-1 px-3 py-1.5 text-xs rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] font-mono focus:outline-none focus:border-[#0052FF]"
              />
              <input
                type="text"
                placeholder="Label (optional)"
                value={customWalletLabel}
                onChange={(e) => setCustomWalletLabel(e.target.value)}
                className="w-full sm:w-44 px-3 py-1.5 text-xs rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] focus:outline-none focus:border-[#0052FF]"
              />
              <button
                type="submit"
                className="w-full sm:w-auto px-4 py-1.5 rounded-xl bg-[#0052FF] text-white text-xs font-bold hover:opacity-95 transition cursor-pointer"
              >
                Save
              </button>
            </form>
          )}

          <p className="text-[11px] text-[var(--ink-muted)]">
            Verified tokens these wallets recently received. Receiving is not the same as buying, and this is not advice.
          </p>

          {/* Event Stream or Compact Empty State */}
          {isLoadingRadar ? (
            <div className="h-28 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] skeleton-shimmer" />
          ) : radarError ? (
            <div className="p-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-center space-y-2">
              <p className="text-xs font-bold text-[var(--ink)]">{radarError}</p>
              <button
                type="button"
                onClick={() => void loadSmartMoneyFeed(selectedWallet || undefined)}
                className="px-3 py-1 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-xs font-bold hover:border-[#0052FF]"
              >
                Retry Feed
              </button>
            </div>
          ) : radarEvents.length === 0 ? (
            <div className="p-4 sm:p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/40 text-center space-y-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-mono font-bold border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Base mainnet</span>
              </div>
              <p className="text-xs font-bold text-[var(--ink)]">
                No verified tokens received recently by {wallets.find((w) => w.address.toLowerCase() === selectedWallet?.toLowerCase())?.label || shortAddr(selectedWallet || "")}
              </p>
              <p className="text-[11px] text-[var(--ink-muted)] max-w-md mx-auto">
                Only verified tokens are listed here.
              </p>
              {selectedWallet && (
                <div className="pt-1">
                  <a
                    href={`https://basescan.org/address/${selectedWallet}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0052FF] hover:underline"
                  >
                    <span>Inspect wallet on BaseScan</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden bg-[var(--surface-2)]/40">
              {radarEvents.slice(0, 4).map((evt) => (
                <div key={evt.txHash} className="p-3 flex items-center justify-between text-xs hover:bg-[var(--surface-2)] transition">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--ink)]">{evt.tokenSymbol}</span>
                    {evt.usdValue !== null ? (
                      <span className="font-mono text-[11px] text-[var(--ink-muted)]">
                        ${evt.usdValue.toLocaleString()}
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] text-[var(--ink-muted)]">
                        {evt.amount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onTradeToken?.(evt.tokenAddress)}
                      className="text-[11px] text-[#0052FF] font-bold hover:underline"
                    >
                      Swap →
                    </button>
                    <a
                      href={`https://basescan.org/tx/${evt.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--ink-muted)] hover:text-[var(--ink)]"
                    >
                      <ExternalLink size={11} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: SMARTER ALERTS
          ───────────────────────────────────────────────────────────── */}
      {activeTab === "alerts" && (
        <div className="space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--ink-muted)]">
              Price alerts, checked about once a minute while Base Analytics is open in a tab.
            </span>
            <button
              type="button"
              onClick={() => setShowAlertModal(true)}
              className="pop-pill px-3 py-1.5 rounded-xl bg-[#0052FF] text-white text-xs font-bold flex items-center gap-1 hover:opacity-95 transition cursor-pointer shrink-0"
            >
              <Plus size={12} />
              <span>New Alert</span>
            </button>
          </div>

          {alerts.length === 0 ? (
            <div className="p-4 sm:p-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/40 space-y-3">
              <div className="text-center space-y-1">
                <p className="text-xs font-bold text-[var(--ink)]">No price alerts yet</p>
                <p className="text-[11px] text-[var(--ink-muted)]">
                  Pick a starter or set your own price:
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                {activeStock &&
                  activeStock.price > 0 &&
                  ([["above", 1.05], ["below", 0.95]] as const).map(([direction, factor]) => {
                    const level = Number((activeStock.price * factor).toFixed(2));
                    return (
                      <button
                        key={direction}
                        type="button"
                        onClick={() => handleQuickAddAlert({ type: "price", targetSymbol: activeStock.symbol, thresholdValue: level, direction })}
                        className="pop-pill px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink)] hover:border-[#0052FF] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Plus size={11} className="text-[#0052FF]" />
                        <span>{activeStock.symbol} {direction} ${level}</span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {alerts.map((alt) => (
                <div
                  key={alt.id}
                  className="p-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/60 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-[var(--ink)]">{alt.targetSymbol}</span>
                      <span className="text-[11px] px-1.5 py-0.2 rounded-full font-mono bg-blue-500/10 text-[#0052FF] border border-blue-500/20">
                        {!isWatchable(alt) ? "never sent" : alt.triggered ? "reached" : "waiting"}
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--ink-muted)] block font-mono">
                      {isWatchable(alt) ? `${alt.direction} $${alt.thresholdValue.toLocaleString()}` : "This kind of alert was never checked. Delete it."}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteAlert(alt.id)}
                    className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                    title="Delete alert"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* New Alert Modal Overlay */}
          {showAlertModal && (
            <BodyPortal><div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
              <div className="w-full max-w-sm rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-[var(--ink)]">New price alert</h4>
                  <button
                    type="button"
                    onClick={() => setShowAlertModal(false)}
                    className="text-[var(--ink-muted)] hover:text-[var(--ink)] text-sm"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleCreateAlert} className="space-y-3 text-xs">
                  <div>
                      <label className="block text-[11px] font-medium text-[var(--ink-muted)] mb-1">
                        Direction
                      </label>
                      <select
                        value={alertDirection}
                        onChange={(e) => setAlertDirection(e.target.value as "above" | "below")}
                        className="w-full p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] font-medium"
                      >
                        <option value="above">Crosses Above ($)</option>
                        <option value="below">Crosses Below ($)</option>
                      </select>
                    </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[var(--ink-muted)] mb-1">
                      Target Token / Stock
                    </label>
                    <input
                      type="text"
                      value={alertSymbol}
                      onChange={(e) => setAlertSymbol(e.target.value)}
                      placeholder="e.g. NVDAc, ETH, cbBTC"
                      className="w-full p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] font-bold uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[var(--ink-muted)] mb-1">
                      Price (USD)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={alertThreshold}
                      onChange={(e) => setAlertThreshold(Number(e.target.value))}
                      className="w-full p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[var(--ink-muted)] mb-1">
                      Notification Channel
                    </label>
                    <select
                      value={alertChannel}
                      onChange={(e) => setAlertChannel(e.target.value as AlertChannel)}
                      className="w-full p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink)] font-medium"
                    >
                      <option value="in_app">Message in the app</option>
                      <option value="browser">Browser notification too</option>
                    </select>
                  </div>

                  {alertError && <p role="alert" className="text-[11px] font-semibold text-amber-600">{alertError}</p>}

                  <div className="pt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAlertModal(false)}
                      className="px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] text-[var(--ink-muted)] font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-[#0052FF] text-white font-bold cursor-pointer"
                    >
                      Save Alert
                    </button>
                  </div>
                </form>
              </div>
            </div></BodyPortal>
          )}
        </div>
      )}
    </div>
  );
}
