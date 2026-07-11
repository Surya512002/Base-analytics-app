"use client";

import { useState } from "react";
import { Bell, BellOff, Trash2 } from "lucide-react";
import {
  addPriceAlert,
  readPriceAlerts,
  removePriceAlert,
  type PriceAlert,
} from "@/lib/utils/token-price-alerts";
import type { TokenMarketSummary } from "@/lib/launchpad/dexscreener";
import type { LaunchedToken } from "@/lib/launchpad/types";

async function syncServerAlert(input: {
  wallet: string;
  address: string;
  symbol: string;
  direction: "above" | "below";
  priceUsd: number;
}) {
  await fetch("/api/price-alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

async function removeServerAlert(wallet: string, address: string) {
  const qs = new URLSearchParams({ wallet, address });
  await fetch(`/api/price-alerts?${qs}`, { method: "DELETE" });
}

export default function WatchlistAlertsPanel({
  watchlist,
  tokens,
  markets,
  walletAddress,
}: {
  watchlist: string[];
  tokens: LaunchedToken[];
  markets: Record<string, TokenMarketSummary>;
  walletAddress?: string | null;
}) {
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => readPriceAlerts());
  const watched = tokens.filter((t) => watchlist.includes(t.address.toLowerCase()));
  const pushEnabled = Boolean(walletAddress?.match(/^0x[a-f0-9]{40}$/i));

  if (!watched.length) return null;

  const refresh = () => setAlerts(readPriceAlerts());

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.04] p-4">
      <p className="section-eyebrow text-cyan-300/90 flex items-center gap-2">
        <Bell size={12} /> Price alerts
      </p>
      <p className="readable-body text-xs mt-1 mb-3">
        {pushEnabled
          ? "Browser alert while the app is open, plus Base App push when price crosses your target."
          : "Get a browser notification when price crosses your target (while app is open). Connect wallet for push alerts."}
      </p>
      <div className="space-y-2">
        {watched.map((t) => {
          const m = markets[t.address.toLowerCase()];
          const price = m?.priceUsd ?? 0;
          const existing = alerts.find((a) => a.address === t.address.toLowerCase());
          return (
            <div
              key={t.address}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2"
            >
              <span className="text-sm font-bold text-white">${t.symbol}</span>
              <span className="text-[10px] text-slate-500 font-mono">
                now {price > 0 ? `$${price < 0.01 ? price.toExponential(2) : price.toFixed(4)}` : "—"}
              </span>
              {existing ? (
                <>
                  <span className="text-[10px] text-cyan-300">
                    Alert {existing.direction} ${existing.priceUsd}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      removePriceAlert(t.address);
                      if (walletAddress) {
                        void removeServerAlert(walletAddress, t.address);
                      }
                      refresh();
                    }}
                    className="ml-auto p-1 text-slate-500 hover:text-rose-400"
                    aria-label="Remove alert"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={price <= 0}
                  onClick={() => {
                    if (price <= 0) return;
                    if (typeof Notification !== "undefined" && Notification.permission === "default") {
                      void Notification.requestPermission();
                    }
                    const target = price * 1.05;
                    addPriceAlert({
                      address: t.address.toLowerCase(),
                      symbol: t.symbol,
                      direction: "above",
                      priceUsd: target,
                    });
                    if (walletAddress) {
                      void syncServerAlert({
                        wallet: walletAddress,
                        address: t.address.toLowerCase(),
                        symbol: t.symbol,
                        direction: "above",
                        priceUsd: target,
                      });
                    }
                    refresh();
                  }}
                  className="ml-auto text-[10px] font-bold text-cyan-300 flex items-center gap-1 disabled:opacity-40"
                >
                  <BellOff size={12} /> +5% alert
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
