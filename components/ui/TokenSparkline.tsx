"use client";

import React, { useMemo } from "react";

interface TokenSparklineProps {
  change24h: number;
  seed?: string;
  width?: number;
  height?: number;
  className?: string;
  showGradient?: boolean;
}

/**
 * 24h trend line from the net 24h change: a straight line from start to end.
 */
function generateDeterministicPoints(change24h: number, _seed: string = "base"): number[] {
  // Only the net 24h change is known, not the intraday path, so the line is straight:
  // no made-up wiggles. (`seed` is kept so callers don't change.)
  void _seed;

  const pointCount = 10;
  const points: number[] = [];
  const startVal = 50;
  const endVal = change24h >= 0 
    ? Math.min(85, startVal + Math.min(35, change24h * 1.5))
    : Math.max(15, startVal - Math.min(35, Math.abs(change24h) * 1.5));

  for (let i = 0; i < pointCount; i++) {
    const progress = i / (pointCount - 1);
    // Base trend from startVal to endVal
    const baseline = startVal + (endVal - startVal) * progress;
    const val = Math.max(8, Math.min(92, baseline));
    points.push(val);
  }

  return points;
}

export default function TokenSparkline({
  change24h,
  seed = "0x",
  width = 72,
  height = 26,
  className = "",
  showGradient = true,
}: TokenSparklineProps) {
  const isUp = change24h >= 0;
  const isZero = change24h === 0;

  const points = useMemo(() => {
    return generateDeterministicPoints(change24h, seed);
  }, [change24h, seed]);

  // Convert points to SVG coordinates
  const svgData = useMemo(() => {
    if (points.length < 2) return { path: "", area: "", lastX: 0, lastY: 0 };

    const paddingY = 3;
    const availableHeight = height - paddingY * 2;
    const stepX = width / (points.length - 1);

    const coords = points.map((p, i) => {
      const x = i * stepX;
      // Invert Y because SVG 0 is top
      const y = paddingY + (1 - p / 100) * availableHeight;
      return { x, y };
    });

    // Build smooth cubic bezier curve
    let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const curr = coords[i];
      const next = coords[i + 1];
      const midX = (curr.x + next.x) / 2;
      d += ` C ${midX.toFixed(1)} ${curr.y.toFixed(1)}, ${midX.toFixed(1)} ${next.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
    }

    const last = coords[coords.length - 1];
    const area = `${d} L ${last.x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`;

    return { path: d, area, lastX: last.x, lastY: last.y };
  }, [points, width, height]);

  const strokeColor = isZero
    ? "var(--ink-muted)"
    : isUp
      ? "#10b981"
      : "#ef4444";

  const gradientId = `spark-grad-${seed.slice(0, 8)}-${isUp ? "up" : "dn"}`;

  return (
    <div
      className={`relative inline-flex items-center shrink-0 select-none ${className}`}
      style={{ width, height }}
      title={`24h trend: ${isUp ? "+" : ""}${change24h.toFixed(2)}%`}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={strokeColor}
              stopOpacity={isZero ? "0.08" : "0.28"}
            />
            <stop
              offset="100%"
              stopColor={strokeColor}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {showGradient && (
          <path d={svgData.area} fill={`url(#${gradientId})`} />
        )}

        <path
          d={svgData.path}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Latest-price marker. Static: lists render dozens of these, and an endless
            pulse on each one costs battery on phones. */}
        <circle cx={svgData.lastX} cy={svgData.lastY} r="2.5" fill={strokeColor} />
      </svg>
    </div>
  );
}
