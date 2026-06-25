import type { CSSProperties } from "react";
import { MONTH_NAMES } from "@/lib/constants/season";
import type { DayStats } from "@/lib/types/wallet";

export interface HeatmapColumn {
  days: (DayStats | null)[];
  monthLabel: string | null;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthFromDate(dateStr: string): string {
  return MONTH_NAMES[new Date(`${dateStr}T12:00:00Z`).getUTCMonth()];
}

function monthLabelForColumn(
  days: (DayStats | null)[],
  lastMonth: string
): string | null {
  for (const day of days) {
    if (!day) continue;
    const m = monthFromDate(day.date);
    if (m !== lastMonth) return m;
  }
  return null;
}

/** GitHub-style columns: Sun–Sat rows, oldest → newest left to right. */
export function buildHeatmapColumns(dailyStats: DayStats[]): HeatmapColumn[] {
  if (!dailyStats.length) return [];

  const columns: HeatmapColumn[] = [];
  let idx = 0;
  let lastMonth = "";

  const firstDow = new Date(`${dailyStats[0].date}T12:00:00Z`).getUTCDay();
  const firstCol: (DayStats | null)[] = Array(7).fill(null);
  for (let row = firstDow; row < 7 && idx < dailyStats.length; row++) {
    firstCol[row] = dailyStats[idx++];
  }

  const firstLabel = monthFromDate(dailyStats[0].date);
  columns.push({ days: firstCol, monthLabel: firstLabel });
  lastMonth = firstLabel;

  while (idx < dailyStats.length) {
    const col: (DayStats | null)[] = [];
    for (let row = 0; row < 7 && idx < dailyStats.length; row++) {
      col.push(dailyStats[idx++]);
    }
    while (col.length < 7) col.push(null);

    const label = monthLabelForColumn(col, lastMonth);
    if (label) lastMonth = label;
    columns.push({ days: col, monthLabel: label });
  }

  return columns;
}

export const HEATMAP_DOW_LABELS = DOW.map((name, i) =>
  i % 2 === 1 ? name.slice(0, 1) : ""
);

export interface HeatmapMonthLabel {
  label: string;
  left: number;
  columnIndex: number;
}

/** Place month labels with minimum spacing so "Jul" + "Aug" never overlap. */
export function buildMonthLabelPositions(
  columns: HeatmapColumn[],
  cell = 11,
  gap = 3
): HeatmapMonthLabel[] {
  const colWidth = cell + gap;
  const labelWidth = 24;
  const positions: HeatmapMonthLabel[] = [];
  let lastEnd = -gap;

  for (let i = 0; i < columns.length; i++) {
    const label = columns[i].monthLabel;
    if (!label) continue;

    const idealLeft = i * colWidth;
    const left = Math.max(idealLeft, lastEnd + 3);
    positions.push({ label, left, columnIndex: i });
    lastEnd = left + labelWidth;
  }

  return positions;
}

export function heatmapGridWidth(columnCount: number, cell = 11, gap = 3): number {
  if (columnCount <= 0) return 0;
  return columnCount * cell + (columnCount - 1) * gap;
}

export function heatmapCellStyle(count: number, intensity: number): CSSProperties {
  if (count <= 0) {
    return {
      background: "rgba(15, 23, 42, 0.55)",
      border: "1px solid rgba(0, 229, 255, 0.06)",
    };
  }
  const alpha = 0.22 + intensity * 0.18;
  return {
    background: `rgba(0, 229, 255, ${alpha})`,
    border: "1px solid rgba(0, 229, 255, 0.35)",
    boxShadow: intensity >= 3 ? "0 0 6px rgba(0, 229, 255, 0.35)" : undefined,
  };
}
