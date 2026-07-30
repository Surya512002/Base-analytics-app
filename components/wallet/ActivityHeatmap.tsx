"use client";

import { useMemo } from "react";
import type { DayStats } from "@/lib/types/wallet";
import {
  buildHeatmapColumns,
  buildMonthLabelPositions,
  heatmapGridWidth,
  HEATMAP_DOW_LABELS,
  heatmapCellStyle,
} from "@/lib/utils/heatmap";

const CELL = 14;
const GAP = 4;

interface ActivityHeatmapProps {
  dailyStats: DayStats[];
  selectedDay: DayStats | null;
  onSelectDay: (day: DayStats | null) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

export function ActivityHeatmap({
  dailyStats,
  selectedDay,
  onSelectDay,
  scrollRef,
}: ActivityHeatmapProps) {
  const columns = useMemo(() => buildHeatmapColumns(dailyStats), [dailyStats]);
  const monthLabels = useMemo(
    () => buildMonthLabelPositions(columns, CELL, GAP),
    [columns]
  );
  const gridWidth = heatmapGridWidth(columns.length, CELL, GAP);
  const activeDays = dailyStats.filter((d) => d.count > 0).length;
  const totalTxs = dailyStats.reduce((s, d) => s + d.count, 0);

  if (!columns.length) {
    return (
      <p className="text-[var(--ink-dim)] text-sm text-center py-8">
        No onchain activity yet — your heatmap fills in as you transact on Base.
      </p>
    );
  }

  return (
    <div className="heatmap-shell space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-dim)]">
            Activity heatmap
          </p>
          <p className="text-[13px] text-[var(--ink-muted)] mt-1">
            <span className="text-[var(--ink)] font-bold tabular-nums">{activeDays}</span> active days ·{" "}
            <span className="text-[var(--ink)] font-bold tabular-nums">{totalTxs.toLocaleString()}</span>{" "}
            transactions
          </p>
        </div>
        {selectedDay && (
          <button
            type="button"
            onClick={() => onSelectDay(null)}
            className="text-[11px] font-semibold text-[var(--brand-dark)] hover:underline"
          >
            Clear selection
          </button>
        )}
      </div>

      <div ref={scrollRef} className="overflow-x-auto pb-1 no-scrollbar touch-scroll-x">
        <div className="inline-flex gap-2 min-w-max">
          <div className="flex flex-col shrink-0" style={{ gap: GAP, paddingTop: 18 }}>
            {HEATMAP_DOW_LABELS.map((label, i) => (
              <div
                key={i}
                className="flex items-center justify-end text-[9px] font-bold text-[var(--ink-dim)] pr-1"
                style={{ width: 16, height: CELL }}
              >
                {label}
              </div>
            ))}
          </div>

          <div>
            <div className="relative mb-1.5 overflow-visible" style={{ height: 16, width: gridWidth }}>
              {monthLabels.map(({ label, left, columnIndex }) => (
                <span
                  key={`${columnIndex}-${label}`}
                  className="absolute top-0 text-[10px] font-bold text-[var(--ink-muted)] uppercase tracking-wide whitespace-nowrap select-none"
                  style={{ left }}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="flex" style={{ gap: GAP }}>
              {columns.map((col, ci) => (
                <div key={`c-${ci}`} className="flex flex-col shrink-0" style={{ gap: GAP }}>
                  {col.days.map((day, di) => {
                    if (!day) {
                      return <div key={`${ci}-${di}`} style={{ width: CELL, height: CELL }} />;
                    }
                    const isSelected = selectedDay?.date === day.date;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        title={`${day.date}: ${day.count} tx${day.count === 1 ? "" : "s"}`}
                        onClick={() => onSelectDay(isSelected ? null : day)}
                        className="heatmap-cell-active rounded-[4px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6BA3FF]"
                        style={{
                          width: CELL,
                          height: CELL,
                          ...heatmapCellStyle(day.count, day.intensity),
                          outline: isSelected ? "2px solid #6BA3FF" : undefined,
                          outlineOffset: 1,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap pt-1 border-t border-[var(--border-subtle)]">
        <p className="text-[11px] text-[var(--ink-dim)]">
          Tap a cell for day details · darker blue = more activity
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--ink-dim)] font-semibold">Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className="rounded-[4px]"
              style={{
                width: CELL,
                height: CELL,
                ...heatmapCellStyle(level > 0 ? 1 : 0, level),
              }}
            />
          ))}
          <span className="text-[10px] text-[var(--ink-dim)] font-semibold">More</span>
        </div>
      </div>
    </div>
  );
}
