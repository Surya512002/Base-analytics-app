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

const CELL = 11;
const GAP = 3;

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

  if (!columns.length) {
    return (
      <p className="text-slate-600 text-sm text-center py-6">No activity history yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={scrollRef}
        className="overflow-x-auto pb-1 no-scrollbar touch-scroll-x"
      >
        <div className="inline-flex gap-2 min-w-max">
          {/* Day-of-week labels */}
          <div
            className="flex flex-col shrink-0"
            style={{ gap: GAP, paddingTop: 16 }}
          >
            {HEATMAP_DOW_LABELS.map((label, i) => (
              <div
                key={i}
                className="flex items-center justify-end text-[8px] font-bold text-slate-600 pr-0.5"
                style={{ width: 14, height: CELL }}
              >
                {label}
              </div>
            ))}
          </div>

          <div>
            {/* Month labels — collision-aware absolute positions */}
            <div
              className="relative mb-1 overflow-visible"
              style={{ height: 14, width: gridWidth }}
            >
              {monthLabels.map(({ label, left, columnIndex }) => (
                <span
                  key={`${columnIndex}-${label}`}
                  className="absolute top-0 text-[9px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap select-none"
                  style={{ left }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Activity grid */}
            <div className="flex" style={{ gap: GAP }}>
              {columns.map((col, ci) => (
                <div
                  key={`c-${ci}`}
                  className="flex flex-col shrink-0"
                  style={{ gap: GAP }}
                >
                  {col.days.map((day, di) => {
                    if (!day) {
                      return (
                        <div
                          key={`${ci}-${di}`}
                          style={{ width: CELL, height: CELL }}
                        />
                      );
                    }
                    const isSelected = selectedDay?.date === day.date;
                    return (
                      <button
                        key={day.date}
                        type="button"
                        title={`${day.date}: ${day.count} tx${day.count === 1 ? "" : "s"}`}
                        onClick={() =>
                          onSelectDay(isSelected ? null : day)
                        }
                        className="rounded-[3px] transition-all duration-150 hover:scale-125 hover:z-20 focus:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
                        style={{
                          width: CELL,
                          height: CELL,
                          ...heatmapCellStyle(day.count, day.intensity),
                          outline: isSelected
                            ? "2px solid rgba(0, 229, 255, 0.8)"
                            : undefined,
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

      {/* Legend */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[9px] text-slate-600 font-bold">
          {dailyStats.length} days · click a cell for details
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-slate-600 font-bold">Less</span>
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className="rounded-[3px]"
              style={{
                width: CELL,
                height: CELL,
                ...heatmapCellStyle(level > 0 ? 1 : 0, level),
              }}
            />
          ))}
          <span className="text-[9px] text-slate-600 font-bold">More</span>
        </div>
      </div>
    </div>
  );
}
