"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PredictionAsset } from "@/lib/constants/predictions";
import {
  TV_INTERVALS,
  TV_SYMBOLS,
  type TvInterval,
} from "@/lib/constants/tradingview";

const TV_SCRIPT = "https://s3.tradingview.com/tv.js";

type TvWidget = { remove?: () => void };

declare global {
  interface Window {
    TradingView?: {
      widget: new (options: Record<string, unknown>) => TvWidget;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTradingView(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.TradingView) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TV_SCRIPT}"]`);
    if (existing) {
      if (window.TradingView) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("TradingView script error")),
        { once: true }
      );
      return;
    }
    const script = document.createElement("script");
    script.src = TV_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load TradingView"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/** TradingView remove() throws if React already detached the iframe parent. */
function safeDisposeWidget(
  widget: TvWidget | null,
  container: HTMLElement | null
): void {
  if (container) {
    container.replaceChildren();
  }
  if (!widget) return;
  try {
    widget.remove?.();
  } catch {
    // ignore — DOM already gone (Strict Mode / fast tab switch)
  }
}

export default function TradingViewChart({
  asset,
  interval,
  onIntervalChange,
  openPrice,
  height = 420,
}: {
  asset: PredictionAsset;
  interval: TvInterval;
  onIntervalChange: (tf: TvInterval) => void;
  openPrice?: number;
  height?: number;
}) {
  const reactId = useId().replace(/:/g, "");
  const containerId = `tv_chart_${reactId}`;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<TvWidget | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      setStatus("loading");
      const container = containerRef.current;
      if (!container) return;

      safeDisposeWidget(widgetRef.current, container);
      widgetRef.current = null;

      try {
        await loadTradingView();
        if (cancelled || !containerRef.current || !window.TradingView) return;

        widgetRef.current = new window.TradingView.widget({
          autosize: true,
          symbol: TV_SYMBOLS[asset],
          interval,
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "en",
          toolbar_bg: "#080f18",
          enable_publishing: false,
          allow_symbol_change: false,
          hide_top_toolbar: false,
          hide_legend: false,
          hide_side_toolbar: false,
          withdateranges: true,
          save_image: false,
          container_id: containerId,
          studies: ["Volume@tv-basicstudies"],
          disabled_features: [
            "header_symbol_search",
            "symbol_search_hot_key",
            "header_compare",
            "display_market_status",
          ],
          enabled_features: ["study_templates"],
          overrides: {
            "paneProperties.background": "#060d14",
            "paneProperties.backgroundType": "solid",
            "paneProperties.vertGridProperties.color": "rgba(255,255,255,0.06)",
            "paneProperties.horzGridProperties.color": "rgba(255,255,255,0.06)",
            "mainSeriesProperties.candleStyle.upColor": "#22c55e",
            "mainSeriesProperties.candleStyle.downColor": "#ef4444",
            "mainSeriesProperties.candleStyle.borderUpColor": "#22c55e",
            "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
            "mainSeriesProperties.candleStyle.wickUpColor": "#22c55e",
            "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444",
          },
        });

        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    void mount();

    return () => {
      cancelled = true;
      safeDisposeWidget(widgetRef.current, containerRef.current);
      widgetRef.current = null;
    };
  }, [asset, interval, containerId, height]);

  const intraday = TV_INTERVALS.filter((t) => t.group === "intraday");
  const swing = TV_INTERVALS.filter((t) => t.group === "swing");

  return (
    <div className="terminal-chart rounded-xl border border-white/10 overflow-hidden bg-[#060d14]">
      <div className="flex flex-col gap-2 px-3 py-2 border-b border-white/8 bg-[#080f18] sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            TradingView · {TV_SYMBOLS[asset]}
          </p>
          {openPrice != null && openPrice > 0 && (
            <p className="text-[10px] font-bold text-amber-300/90 mt-0.5 tabular-nums">
              Round open{" "}
              <span className="text-white">
                $
                {openPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
              <span className="text-slate-500"> — compare vs candles</span>
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5 sm:items-end">
          <div className="flex gap-0.5 overflow-x-auto no-scrollbar max-w-full">
            {intraday.map((tf) => (
              <IntervalBtn
                key={tf.id}
                label={tf.label}
                active={interval === tf.id}
                onClick={() => onIntervalChange(tf.id)}
              />
            ))}
          </div>
          <div className="flex gap-0.5">
            {swing.map((tf) => (
              <IntervalBtn
                key={tf.id}
                label={tf.label}
                active={interval === tf.id}
                onClick={() => onIntervalChange(tf.id)}
                accent
              />
            ))}
          </div>
        </div>
      </div>

      <div className="relative" style={{ minHeight: height }}>
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#060d14] z-10 pointer-events-none">
            <p className="text-sm font-bold text-slate-500 animate-pulse">Loading TradingView…</p>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#060d14] z-10 px-4 text-center">
            <p className="text-sm font-bold text-rose-400">Chart failed to load</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Check network / ad-blocker for tradingview.com
            </p>
          </div>
        )}
        <div
          ref={containerRef}
          id={containerId}
          className="w-full"
          style={{ height }}
        />
      </div>

      <p className="px-3 py-1.5 text-[9px] text-slate-600 border-t border-white/8">
        Market data by TradingView · not financial advice
      </p>
    </div>
  );
}

function IntervalBtn({
  label,
  active,
  onClick,
  accent,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase whitespace-nowrap transition-colors shrink-0 ${
        active
          ? accent
            ? "bg-amber-500/20 text-amber-300 border border-amber-500/35"
            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/35"
          : "text-slate-500 hover:text-slate-300 border border-transparent"
      }`}
    >
      {label}
    </button>
  );
}
