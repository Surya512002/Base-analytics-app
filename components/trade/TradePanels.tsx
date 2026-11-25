"use client";

import { ALERTS_CHANGED, alertAddress } from "@/lib/alerts/price-watch";
import { deleteSmarterAlert, readSmarterAlerts, saveSmarterAlert, type SmarterAlert } from "@/lib/alerts/smarter-alerts";
import { useEffect, useState } from "react";
import { Bell, ExternalLink } from "lucide-react";
import type { RecentTrade } from "@/app/api/trade/trades/route";
import type { TokenHolding } from "@/hooks/useWalletHoldings";
import { formatPrice } from "./CandleChart";

export type MarketStats = {
  change: { m5: number | null; h1: number | null; h6: number | null; h24: number | null };
  buys24: number | null;
  sells24: number | null;
  dex: string | null;
  pairUrl: string | null;
};

function Pct({ v }: { v: number | null }) {
  if (v == null) return <span className="text-[var(--ink-muted)]">—</span>;
  return <span className={`font-semibold tabular-nums ${v >= 0 ? "text-green-600" : "text-red-600"}`}>{v >= 0 ? "+" : ""}{v.toFixed(2)}%</span>;
}

const card = "rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 sm:p-4 shadow-card";

export function MarketInfo({ stats, symbol }: { stats: MarketStats | null; symbol: string }) {
  const buys = stats?.buys24 ?? 0;
  const sells = stats?.sells24 ?? 0;
  const total = buys + sells;
  return (
    <section aria-label="Market stats" className={card}>
      <h3 className="mb-2 text-sm font-bold text-[var(--ink)]">{symbol} performance</h3>
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        {([["5m", stats?.change.m5], ["1h", stats?.change.h1], ["6h", stats?.change.h6], ["24h", stats?.change.h24]] as const).map(([l, v]) => (
          <div key={l} className="rounded-lg bg-[var(--surface-2)] py-2">
            <div className="text-[10px] text-[var(--ink-muted)]">{l}</div>
            <Pct v={v ?? null} />
          </div>
        ))}
      </div>
      {total > 0 && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[11px] text-[var(--ink-muted)]">
            <span>Buys {buys.toLocaleString()}</span>
            <span>24h transactions</span>
            <span>Sells {sells.toLocaleString()}</span>
          </div>
          <div className="flex h-1.5 overflow-hidden rounded-full bg-red-500/70">
            <div className="bg-green-500" style={{ width: `${(buys / total) * 100}%` }} />
          </div>
        </div>
      )}
      {stats?.pairUrl && (
        <a href={stats.pairUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--brand-text)] hover:underline">
          Pool on {stats.dex ?? "DEX"} <ExternalLink size={11} />
        </a>
      )}
    </section>
  );
}

function ago(t: number): string {
  const s = Math.max(1, Math.floor(Date.now() / 1000) - t);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function RecentTrades({ pool, token, symbol }: { pool: string | null; token: string; symbol: string }) {
  const [trades, setTrades] = useState<RecentTrade[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setTrades([]);
    setLoaded(false);
    if (!pool) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/trade/trades?pool=${pool}&token=${token}`);
        const d = (await r.json()) as { trades?: RecentTrade[] };
        if (!cancelled) {
          setTrades(d.trades ?? []);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    };
    void load();
    const id = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pool, token]);

  return (
    <section aria-label="Recent trades" className={card}>
      <h3 className="mb-2 text-sm font-bold text-[var(--ink)]">Recent trades</h3>
      <div className="grid grid-cols-[1fr_1fr_1fr_36px] gap-2 border-b border-[var(--border-subtle)] pb-1 text-[10px] uppercase tracking-wider text-[var(--ink-muted)]">
        <span>Price (USD)</span>
        <span className="text-right">{symbol}</span>
        <span className="text-right">Value</span>
        <span className="text-right">Age</span>
      </div>
      <div className="max-h-[260px] overflow-y-auto">
        {!loaded && <p className="py-4 text-center text-xs text-[var(--ink-muted)]">Loading…</p>}
        {loaded && trades.length === 0 && <p className="py-4 text-center text-xs text-[var(--ink-muted)]">No recent trades</p>}
        {trades.map((t, i) => (
          <a
            key={`${t.tx}-${i}`}
            href={t.tx ? `https://basescan.org/tx/${t.tx}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="grid grid-cols-[1fr_1fr_1fr_36px] gap-2 py-0.5 text-xs tabular-nums hover:bg-[var(--surface-2)]"
          >
            <span className={t.side === "buy" ? "text-green-600" : "text-red-600"}>{formatPrice(t.priceUsd)}</span>
            <span className="text-right text-[var(--ink)]">{t.amount >= 1000 ? `${(t.amount / 1000).toFixed(1)}K` : t.amount.toFixed(t.amount < 1 ? 4 : 2)}</span>
            <span className="text-right text-[var(--ink-muted)]">${t.volumeUsd.toFixed(0)}</span>
            <span className="text-right text-[var(--ink-muted)]">{ago(t.t)}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

export function Position({ holding, price, symbol }: { holding: TokenHolding | undefined; price: number | null; symbol: string }) {
  const value = holding && price != null ? holding.balanceNumber * price : null;
  return (
    <section aria-label="Your position" className={card}>
      <h3 className="mb-2 text-sm font-bold text-[var(--ink)]">Your {symbol} balance</h3>
      {holding && holding.balanceNumber > 0 ? (
        <div className="flex items-end justify-between">
          <div className="text-lg font-extrabold tabular-nums text-[var(--ink)]">{holding.balanceNumber.toLocaleString(undefined, { maximumFractionDigits: 6 })}</div>
          <div className="text-sm tabular-nums text-[var(--ink-muted)]">{value != null ? `≈ $${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ""}</div>
        </div>
      ) : (
        <p className="text-xs text-[var(--ink-muted)]">You don&apos;t hold any {symbol}, or no wallet is connected.</p>
      )}
    </section>
  );
}

export function AlertButton({ wallet, address, symbol, price, onToast }: { wallet?: string; address: string; symbol: string; price: number | null; onToast: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [mine, setMine] = useState<Array<{ owner: string | null; alert: SmarterAlert }>>([]);

  useEffect(() => {
    const read = () =>
      setMine(
        (wallet ? [wallet, null] : [null]).flatMap((owner) =>
          readSmarterAlerts(owner)
            .filter((a) => a.type === "price" && alertAddress(a) === address.toLowerCase())
            .map((alert) => ({ owner, alert }))
        )
      );
    read();
    window.addEventListener(ALERTS_CHANGED, read);
    return () => window.removeEventListener(ALERTS_CHANGED, read);
  }, [wallet, address]);

  const changed = () => window.dispatchEvent(new Event(ALERTS_CHANGED));
  // Base App push is a bonus on top of the in-app check, so a failure here is not an error.
  const syncPush = (init: RequestInit, query = "") => {
    if (wallet) void fetch(`/api/price-alerts${query}`, init).catch(() => undefined);
  };

  const submit = async () => {
    const px = Number(target);
    if (price == null) return onToast("The price is still loading. Try again in a moment.");
    if (!Number.isFinite(px) || px <= 0) return onToast("Enter a price above zero.");
    // Asked straight from the click, which browsers require.
    const permission = "Notification" in window ? await Notification.requestPermission().catch(() => "denied") : "denied";
    const direction = px < price ? "below" : "above";
    saveSmarterAlert(wallet, { type: "price", channel: permission === "granted" ? "browser" : "in_app", targetSymbol: symbol, targetAddress: address, thresholdValue: px, direction });
    syncPush({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet, address, symbol, direction, priceUsd: px }) });
    changed();
    setTarget("");
    onToast(`Alert set: ${symbol} ${direction} ${formatPrice(px)}. It is checked while Base Analytics is open.`);
  };

  const remove = (owner: string | null, id: string) => {
    deleteSmarterAlert(owner, id);
    syncPush({ method: "DELETE" }, `?wallet=${wallet}&address=${address}`);
    changed();
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Price alerts"
        aria-expanded={open}
        title="Price alerts"
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-10 w-10 place-items-center rounded-xl text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
      >
        <Bell size={17} />
        {mine.some((m) => !m.alert.triggered) && <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--brand)]" />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-card">
          <label className="block text-[11px] font-semibold text-[var(--ink-muted)]" htmlFor="alert-price">Tell me when {symbol} reaches (USD)</label>
          <input
            id="alert-price"
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder={price != null ? formatPrice(price) : "0.00"}
            className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 text-base sm:text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-text)]"
          />
          <button type="button" onClick={() => void submit()} className="h-9 w-full rounded-lg bg-[var(--brand)] text-sm font-semibold text-white">
            Set alert
          </button>
          <p className="text-[11px] text-[var(--ink-muted)]">Checked about once a minute while Base Analytics is open in a tab.</p>
          {mine.length > 0 && (
            <ul className="space-y-1 border-t border-[var(--border-subtle)] pt-2">
              {mine.map(({ owner, alert }) => (
                <li key={alert.id} className="flex items-center justify-between gap-2 text-xs text-[var(--ink)]">
                  <span>
                    {alert.direction} {formatPrice(alert.thresholdValue)}
                    {alert.triggered && <span className="ml-1 text-emerald-600 dark:text-emerald-400">· reached</span>}
                  </span>
                  <button type="button" aria-label={`Delete alert ${alert.direction} ${alert.thresholdValue}`} onClick={() => remove(owner, alert.id)} className="grid h-8 w-8 place-items-center rounded-lg text-[var(--ink-muted)] hover:text-red-500">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
