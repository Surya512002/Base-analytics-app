"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { bollinger, ema, rsi as rsiCalc, sma, type Series } from "@/lib/trade/indicators";

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

export type PriceLine = { price: number; label: string; tone: "buy" | "sell" | "stop" | "info" };

const TONE_COLOR: Record<PriceLine["tone"], string> = {
  buy: "#16a34a",
  sell: "#0052FF",
  stop: "#dc2626",
  info: "#a1a1aa",
};

const UP = "#16a34a";
const DOWN = "#dc2626";
const PAD = { top: 12, right: 64, bottom: 22, left: 8 };
const VOL_FRAC = 0.18;

export function formatPrice(p: number): string {
  if (!Number.isFinite(p)) return "—";
  const abs = Math.abs(p);
  if (abs >= 1000) return p.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (abs >= 1) return p.toFixed(2);
  if (abs >= 0.01) return p.toFixed(4);
  if (abs === 0) return "0";
  return p.toPrecision(3);
}

function formatTime(t: number, intraday: boolean): string {
  const d = new Date(t * 1000);
  return intraday
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export type Indicators = { ma: boolean; ema: boolean; boll: boolean; rsi: boolean };
export type ChartType = "candles" | "line";

function path(series: Series, x: (i: number) => number, y: (v: number) => number): string {
  let d = "";
  series.forEach((v, i) => {
    if (v == null) return;
    d += `${d ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  });
  return d;
}

type Props = {
  chartType?: ChartType;
  indicators?: Indicators;
  candles: Candle[];
  intraday: boolean;
  lines?: PriceLine[];
  /** Called with the price under the cursor when the user clicks the plot */
  onPickPrice?: (price: number) => void;
  height?: number;
};

export default function CandleChart({ chartType = "candles", indicators, candles, intraday, lines = [], onPickPrice, height = 380 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const plotW = width - PAD.left - PAD.right;
  const showRsi = !!indicators?.rsi;
  const rsiH = showRsi ? 64 : 0;
  const rsiGap = showRsi ? 10 : 0;
  const plotH = height - PAD.top - PAD.bottom;
  const mainH = plotH - rsiH - rsiGap;
  const volH = mainH * VOL_FRAC;
  const priceH = mainH - volH - 6;

  const geo = useMemo(() => {
    if (candles.length === 0) return null;
    const lineMin = lines.map((l) => l.price).filter((p) => p > 0);
    let lo = Math.min(...candles.map((c) => c.l), ...lineMin);
    let hi = Math.max(...candles.map((c) => c.h), ...lineMin);
    if (lo === hi) {
      lo *= 0.99;
      hi *= 1.01;
    }
    const pad = (hi - lo) * 0.06;
    lo -= pad;
    hi += pad;
    const maxV = Math.max(...candles.map((c) => c.v), 1e-9);
    const step = plotW / candles.length;
    const closes = candles.map((c) => c.c);
    const ind = {
      ma7: indicators?.ma ? sma(closes, 7) : null,
      ma25: indicators?.ma ? sma(closes, 25) : null,
      ema21: indicators?.ema ? ema(closes, 21) : null,
      boll: indicators?.boll ? bollinger(closes) : null,
      rsi: indicators?.rsi ? rsiCalc(closes) : null,
    };
    return { lo, hi, maxV, step, ind };
  }, [candles, lines, plotW, indicators?.ma, indicators?.ema, indicators?.boll, indicators?.rsi]);

  if (!geo) {
    return (
      <div
        ref={wrapRef}
        style={{ height }}
        className="flex items-center justify-center text-sm text-[var(--ink-muted)]"
      >
        No chart data for this market yet
      </div>
    );
  }

  const { lo, hi, maxV, step, ind } = geo;
  const yPrice = (p: number) => PAD.top + ((hi - p) / (hi - lo)) * priceH;
  const priceAt = (y: number) => hi - ((y - PAD.top) / priceH) * (hi - lo);
  const xCenter = (i: number) => PAD.left + step * i + step / 2;
  const bodyW = Math.max(1, Math.min(14, step * 0.7));
  const volTop = PAD.top + priceH + 6;
  const rsiTop = PAD.top + mainH + rsiGap;
  const yRsi = (v: number) => rsiTop + ((100 - v) / 100) * rsiH;
  const lastRsi = ind.rsi ? [...ind.rsi].reverse().find((v) => v != null) ?? null : null;

  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / 5);
  const timeTickEvery = Math.max(1, Math.round(candles.length / Math.max(2, Math.floor(plotW / 110))));

  const last = candles[candles.length - 1];
  const hoverIdx =
    hover && hover.x >= PAD.left && hover.x <= PAD.left + plotW
      ? Math.min(candles.length - 1, Math.max(0, Math.floor((hover.x - PAD.left) / step)))
      : null;
  const shown = hoverIdx !== null ? candles[hoverIdx] : last;
  const inPriceArea = hover && hover.y >= PAD.top && hover.y <= PAD.top + priceH;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  return (
    <div ref={wrapRef} className="w-full select-none">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-2 pb-1 text-[11px] tabular-nums text-[var(--ink-muted)]">
        <span>O <b className="text-[var(--ink)]">{formatPrice(shown.o)}</b></span>
        <span>H <b className="text-[var(--ink)]">{formatPrice(shown.h)}</b></span>
        <span>L <b className="text-[var(--ink)]">{formatPrice(shown.l)}</b></span>
        <span>C <b style={{ color: shown.c >= shown.o ? UP : DOWN }}>{formatPrice(shown.c)}</b></span>
        <span>Vol <b className="text-[var(--ink)]">${shown.v >= 1000 ? `${(shown.v / 1000).toFixed(1)}K` : shown.v.toFixed(0)}</b></span>
      </div>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Candlestick price chart"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onClick={() => {
          if (onPickPrice && hover && inPriceArea) onPickPrice(priceAt(hover.y));
        }}
        className={onPickPrice ? "cursor-crosshair" : undefined}
      >
        {ticks.map((p) => (
          <g key={p}>
            <line x1={PAD.left} x2={PAD.left + plotW} y1={yPrice(p)} y2={yPrice(p)} stroke="var(--border-subtle)" strokeDasharray="2 4" />
            <text x={width - PAD.right + 6} y={yPrice(p) + 3} fontSize="10" fill="var(--ink-muted)" className="tabular-nums">
              {formatPrice(p)}
            </text>
          </g>
        ))}

        {candles.map((c, i) => {
          const up = c.c >= c.o;
          const col = up ? UP : DOWN;
          const x = xCenter(i);
          const top = yPrice(Math.max(c.o, c.c));
          const bot = yPrice(Math.min(c.o, c.c));
          const vh = (c.v / maxV) * volH;
          return (
            <g key={c.t}>
              {chartType === "candles" && (
                <>
                  <line x1={x} x2={x} y1={yPrice(c.h)} y2={yPrice(c.l)} stroke={col} strokeWidth={1} />
                  <rect x={x - bodyW / 2} y={top} width={bodyW} height={Math.max(1, bot - top)} fill={col} />
                </>
              )}
              <rect x={x - bodyW / 2} y={volTop + volH - vh} width={bodyW} height={vh} fill={col} opacity={0.28} />
              {i % timeTickEvery === 0 && (
                <text x={x} y={height - 6} fontSize="10" textAnchor="middle" fill="var(--ink-muted)">
                  {formatTime(c.t, intraday)}
                </text>
              )}
            </g>
          );
        })}

        {chartType === "line" && (
          <path d={path(candles.map((c) => c.c), xCenter, yPrice)} fill="none" stroke="#0052FF" strokeWidth={1.75} />
        )}
        {ind.boll && (
          <>
            <path d={path(ind.boll.upper, xCenter, yPrice)} fill="none" stroke="#a78bfa" strokeWidth={1} opacity={0.8} />
            <path d={path(ind.boll.mid, xCenter, yPrice)} fill="none" stroke="#a78bfa" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            <path d={path(ind.boll.lower, xCenter, yPrice)} fill="none" stroke="#a78bfa" strokeWidth={1} opacity={0.8} />
          </>
        )}
        {ind.ma7 && <path d={path(ind.ma7, xCenter, yPrice)} fill="none" stroke="#f59e0b" strokeWidth={1.25} />}
        {ind.ma25 && <path d={path(ind.ma25, xCenter, yPrice)} fill="none" stroke="#06b6d4" strokeWidth={1.25} />}
        {ind.ema21 && <path d={path(ind.ema21, xCenter, yPrice)} fill="none" stroke="#ec4899" strokeWidth={1.25} />}

        {ind.rsi && (
          <g>
            <rect x={PAD.left} y={rsiTop} width={plotW} height={rsiH} fill="none" stroke="var(--border-subtle)" />
            {[30, 70].map((lv) => (
              <g key={lv}>
                <line x1={PAD.left} x2={PAD.left + plotW} y1={yRsi(lv)} y2={yRsi(lv)} stroke="var(--border-subtle)" strokeDasharray="3 3" />
                <text x={width - PAD.right + 6} y={yRsi(lv) + 3} fontSize="9" fill="var(--ink-muted)">{lv}</text>
              </g>
            ))}
            <path d={path(ind.rsi, xCenter, yRsi)} fill="none" stroke="#8b5cf6" strokeWidth={1.25} />
            <text x={PAD.left + 4} y={rsiTop + 11} fontSize="10" fill="var(--ink-muted)">RSI 14{lastRsi != null ? ` · ${lastRsi.toFixed(1)}` : ""}</text>
          </g>
        )}

        {/* last price */}
        <line
          x1={PAD.left}
          x2={PAD.left + plotW}
          y1={yPrice(last.c)}
          y2={yPrice(last.c)}
          stroke={last.c >= last.o ? UP : DOWN}
          strokeDasharray="4 3"
          opacity={0.7}
        />
        <rect x={width - PAD.right + 2} y={yPrice(last.c) - 8} width={PAD.right - 4} height={16} rx={3} fill={last.c >= last.o ? UP : DOWN} />
        <text x={width - PAD.right + 6} y={yPrice(last.c) + 3} fontSize="10" fontWeight="700" fill="#fff" className="tabular-nums">
          {formatPrice(last.c)}
        </text>

        {/* open-order markers */}
        {lines
          .filter((l) => l.price > 0)
          .map((l, i) => (
            <g key={`${l.label}-${i}`}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={yPrice(l.price)} y2={yPrice(l.price)} stroke={TONE_COLOR[l.tone]} strokeWidth={1.25} strokeDasharray="6 3" />
              <rect x={PAD.left + 4} y={yPrice(l.price) - 16} width={Math.max(54, l.label.length * 6 + 10)} height={14} rx={3} fill={TONE_COLOR[l.tone]} />
              <text x={PAD.left + 9} y={yPrice(l.price) - 6} fontSize="10" fontWeight="700" fill="#fff">
                {l.label}
              </text>
            </g>
          ))}

        {/* crosshair */}
        {hover && hoverIdx !== null && (
          <g pointerEvents="none">
            <line x1={xCenter(hoverIdx)} x2={xCenter(hoverIdx)} y1={PAD.top} y2={PAD.top + mainH + rsiGap + rsiH} stroke="var(--ink-muted)" strokeDasharray="3 3" opacity={0.6} />
            {inPriceArea && (
              <>
                <line x1={PAD.left} x2={PAD.left + plotW} y1={hover.y} y2={hover.y} stroke="var(--ink-muted)" strokeDasharray="3 3" opacity={0.6} />
                <rect x={width - PAD.right + 2} y={hover.y - 8} width={PAD.right - 4} height={16} rx={3} fill="var(--ink)" />
                <text x={width - PAD.right + 6} y={hover.y + 3} fontSize="10" fontWeight="700" fill="var(--surface)" className="tabular-nums">
                  {formatPrice(priceAt(hover.y))}
                </text>
              </>
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
