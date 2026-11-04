"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  Trash2,
  Plus,
  Flame,
  TrendingDown,
  TrendingUp,
  DollarSign,
  Globe,
  BellRing,
  AlertCircle,
} from "lucide-react";
import { FEATURES } from "@/lib/constants/features";
import {
  readSmarterAlerts,
  saveSmarterAlert,
  deleteSmarterAlert,
  type SmarterAlert,
  type AlertTriggerType,
  type AlertChannel,
} from "@/lib/alerts/smarter-alerts";

interface SmarterAlertsPanelProps {
  walletAddress?: string | null;
  defaultSymbol?: string;
  className?: string;
}

export default function SmarterAlertsPanel({
  walletAddress,
  defaultSymbol = "ETH",
  className = "",
}: SmarterAlertsPanelProps) {
  const [alerts, setAlerts] = useState<SmarterAlert[]>([]);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [type, setType] = useState<AlertTriggerType>("whale_swap");
  const [channel, setChannel] = useState<AlertChannel>("in_app");
  const [symbol, setSymbol] = useState<string>(defaultSymbol);
  const [threshold, setThreshold] = useState<number>(25_000);
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [webhookUrl, setWebhookUrl] = useState<string>("");

  useEffect(() => {
    setAlerts(readSmarterAlerts(walletAddress));
  }, [walletAddress]);

  // Guard behind feature flag
  if (!FEATURES.SMARTER_ALERTS) {
    return null;
  }

  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim() || threshold <= 0) return;

    if (channel === "browser" && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission !== "granted") {
        await Notification.requestPermission();
      }
    }

    const updated = saveSmarterAlert(walletAddress, {
      type,
      channel,
      targetSymbol: symbol.trim().toUpperCase(),
      thresholdValue: threshold,
      direction: type === "price" ? direction : undefined,
      webhookUrl: channel === "webhook" ? webhookUrl.trim() : undefined,
    });

    setAlerts(updated);
    setShowCreateModal(false);
  };

  const handleDelete = (id: string) => {
    const updated = deleteSmarterAlert(walletAddress, id);
    setAlerts(updated);
  };

  const handleTypeChange = (newType: AlertTriggerType) => {
    setType(newType);
    if (newType === "whale_swap") setThreshold(25_000);
    else if (newType === "yield_spike") setThreshold(5);
    else if (newType === "liquidity_drop") setThreshold(15);
    else if (newType === "price") setThreshold(3500);
  };

  return (
    <div
      data-testid="smarter-alerts-panel"
      className={`card-pop rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 space-y-4 shadow-xs ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#0052FF]/10 text-[#0052FF] flex items-center justify-center border border-[#0052FF]/20 shadow-xs shrink-0">
            <Bell size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-[var(--ink)]">Smarter Alerts</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0052FF] text-white">
                Multi-Trigger
              </span>
            </div>
            <p className="text-xs text-[var(--ink-muted)]">
              Monitor price crosses, whale swaps (&gt;$25k), yield spikes (&gt;5%), and liquidity drops (&gt;15%)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="pop-pill inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--surface-2)] border border-[var(--border-subtle)] hover:border-[var(--brand)] text-[var(--ink)] cursor-pointer"
        >
          <Plus size={14} />
          <span>New Alert</span>
        </button>
      </div>

      {/* Create Alert Modal / Expandable Form */}
      {showCreateModal && (
        <form
          onSubmit={handleCreateAlert}
          className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-3.5 text-xs"
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-[var(--ink)]">Configure New Smart Alert</span>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer text-xs"
            >
              Cancel
            </button>
          </div>

          {/* Trigger Type Selection */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: "whale_swap", label: "Whale Swap (> $25k)", icon: DollarSign },
              { id: "price", label: "Price Target ($)", icon: TrendingUp },
              { id: "yield_spike", label: "Yield Spike (> 5%)", icon: Flame },
              { id: "liquidity_drop", label: "Liquidity Drop (> 15%)", icon: TrendingDown },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTypeChange(t.id as AlertTriggerType)}
                  className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col gap-1.5 ${
                    type === t.id
                      ? "bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand-text)] shadow-xs"
                      : "bg-[var(--surface)] border-[var(--border-subtle)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                >
                  <Icon size={14} />
                  <span className="font-bold text-[11px] leading-tight">{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Direction toggle for price alerts */}
          {type === "price" && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-[var(--ink-muted)]">Direction:</span>
              <button
                type="button"
                onClick={() => setDirection("above")}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                  direction === "above"
                    ? "bg-[var(--brand)] text-white shadow-xs"
                    : "bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--ink-muted)]"
                }`}
              >
                Crosses Above
              </button>
              <button
                type="button"
                onClick={() => setDirection("below")}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer transition ${
                  direction === "below"
                    ? "bg-[var(--brand)] text-white shadow-xs"
                    : "bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--ink-muted)]"
                }`}
              >
                Drops Below
              </button>
            </div>
          )}

          {/* Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider block mb-1">
                Target Token Symbol
              </label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. ETH, USDC, NVDAc"
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--ink)] font-bold outline-none focus:border-[var(--brand)]"
                required
              />
            </div>

            <div>
              <label className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider block mb-1">
                Threshold {type === "price" || type === "whale_swap" ? "USD" : "%"}
              </label>
              <input
                type="number"
                step="any"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--ink)] font-mono font-bold outline-none focus:border-[var(--brand)]"
                required
              />
            </div>

            <div>
              <label className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider block mb-1">
                Notification Channel
              </label>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value as AlertChannel)}
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--ink)] font-bold outline-none cursor-pointer"
              >
                <option value="in_app">In-App Banner</option>
                <option value="browser">Browser Push Notification</option>
                <option value="webhook">Custom Webhook (Discord/Slack)</option>
              </select>
            </div>
          </div>

          {channel === "webhook" && (
            <div>
              <label className="text-[10px] text-[var(--ink-muted)] uppercase tracking-wider block mb-1">
                Webhook URL (Discord / Slack / Telegram)
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--ink)] font-mono text-xs outline-none focus:border-[var(--brand)]"
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-3.5 py-1.5 rounded-xl text-[var(--ink-muted)] font-bold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-[#0052FF] text-white font-bold cursor-pointer hover:bg-[#0047e0] shadow-xs"
            >
              Save Alert
            </button>
          </div>
        </form>
      )}

      {/* Active Alerts List */}
      {alerts.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-2)]/30 text-center space-y-1.5 text-xs">
          <p className="font-bold text-[var(--ink)]">No active smart alerts configured</p>
          <p className="text-[var(--ink-muted)] max-w-sm mx-auto text-[11px]">
            Add an alert above to get notified of large whale swaps (&gt;$25k), yield rate spikes, or liquidity changes.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/50 overflow-hidden text-xs">
          {alerts.map((a) => (
            <div
              key={a.id}
              className="p-3.5 flex items-center justify-between gap-3 hover:bg-[var(--surface-2)] transition"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-[var(--brand-soft)] text-[var(--brand-text)] shrink-0">
                  {a.type === "whale_swap" ? (
                    <DollarSign size={14} />
                  ) : a.type === "yield_spike" ? (
                    <Flame size={14} />
                  ) : a.type === "liquidity_drop" ? (
                    <TrendingDown size={14} />
                  ) : (
                    <TrendingUp size={14} />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-[var(--ink)]">{a.targetSymbol}</span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--surface)] border border-[var(--border-subtle)] text-[var(--ink-muted)]">
                      {a.type === "whale_swap"
                        ? `Whale Swap >= $${a.thresholdValue.toLocaleString()}`
                        : a.type === "yield_spike"
                          ? `Yield Spike >= +${a.thresholdValue}%`
                          : a.type === "liquidity_drop"
                            ? `Liquidity Drop >= -${a.thresholdValue}%`
                            : `Price ${a.direction} $${a.thresholdValue.toLocaleString()}`}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--ink-muted)] flex items-center gap-1 mt-0.5">
                    {a.channel === "browser" ? (
                      <BellRing size={11} className="text-emerald-500" />
                    ) : a.channel === "webhook" ? (
                      <Globe size={11} className="text-blue-500" />
                    ) : (
                      <AlertCircle size={11} className="text-amber-500" />
                    )}
                    <span>Channel: {a.channel === "browser" ? "Browser Push" : a.channel === "webhook" ? "Webhook" : "In-App"}</span>
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleDelete(a.id)}
                className="p-1.5 rounded-lg text-[var(--ink-dim)] hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                title="Delete alert"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
