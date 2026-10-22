"use client";

import React, { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, AlertCircle, Check } from "lucide-react";
import type { InsiderAllocation, VestedAllocation } from "@/lib/launchpad/launch-config";
import { LAUNCH_PRESETS, type LaunchPresetId, getLaunchPreset, applyLaunchPreset } from "@/lib/launchpad/launch-presets";
import { MAX_INSIDERS, MAX_VESTED } from "@/lib/launchpad/launch-configs";

interface DistributionStepProps {
  creatorPct: number;
  onCreatorPctChange: (v: number) => void;
  insiders: InsiderAllocation[];
  onInsidersChange: (v: InsiderAllocation[]) => void;
  vested: VestedAllocation[];
  onVestedChange: (v: VestedAllocation[]) => void;
  activePreset: LaunchPresetId | null;
  onSelectPreset: (id: LaunchPresetId) => void;
}

export default function DistributionStep({
  creatorPct,
  onCreatorPctChange,
  insiders,
  onInsidersChange,
  vested,
  onVestedChange,
  activePreset,
  onSelectPreset,
}: DistributionStepProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Totals calculations
  const insiderTotalPct = insiders.reduce((s, i) => s + (i.pct || 0), 0);
  const vestedTotalPct = vested.reduce((s, v) => s + (v.pct || 0), 0);
  const allocatedPct = creatorPct + insiderTotalPct + vestedTotalPct;
  const poolReservePct = Math.max(0, 100 - allocatedPct);
  const isOverAllocated = allocatedPct > 100;

  const handleApplyPreset = (id: LaunchPresetId) => {
    onSelectPreset(id);
    const preset = getLaunchPreset(id);
    if (!preset) return;
    const applied = applyLaunchPreset(preset);
    onCreatorPctChange(applied.creatorPct);
    onInsidersChange(applied.insiders);
    onVestedChange(applied.vested);
  };

  const addInsider = () => {
    if (insiders.length >= MAX_INSIDERS) return;
    onInsidersChange([...insiders, { id: crypto.randomUUID(), address: "", pct: 2 }]);
  };

  const updateInsider = (id: string, patch: Partial<InsiderAllocation>) => {
    onInsidersChange(insiders.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const removeInsider = (id: string) => {
    onInsidersChange(insiders.filter((i) => i.id !== id));
  };

  const addVested = () => {
    if (vested.length >= MAX_VESTED) return;
    onVestedChange([
      ...vested,
      { id: crypto.randomUUID(), address: "", pct: 5, cliffMonths: 3, vestMonths: 12 },
    ]);
  };

  const updateVested = (id: string, patch: Partial<VestedAllocation>) => {
    onVestedChange(vested.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  };

  const removeVested = (id: string) => {
    onVestedChange(vested.filter((v) => v.id !== id));
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-black text-[var(--ink)]">Supply &amp; Distribution</h2>
        <p className="text-xs text-[var(--ink-muted)] mt-0.5">
          Fixed 1,000,000,000 (1B) supply. Choose a quick preset or customize token shares.
        </p>
      </div>

      {/* 1. Quick Presets FIRST */}
      <div className="space-y-2.5">
        <label className="text-xs font-black uppercase tracking-wider text-[var(--ink-muted)]">
          Quick Presets
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {LAUNCH_PRESETS.map((preset) => {
            const isSelected = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset.id)}
                className={`pop-pill p-3 rounded-xl border text-left transition relative cursor-pointer ${
                  isSelected
                    ? "border-[var(--brand-text)] bg-[var(--surface)] shadow-xs ring-1 ring-[var(--brand)]"
                    : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--ink-muted)] hover:border-[var(--ink-dim)] hover:text-[var(--ink)]"
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[var(--brand)] text-white flex items-center justify-center">
                    <Check size={10} strokeWidth={3} />
                  </span>
                )}
                <p className="text-xs font-black text-[var(--ink)]">{preset.label}</p>
                <p className="text-[11px] text-[var(--ink-muted)] mt-1 leading-snug">{preset.tagline}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Simple Distribution Bar */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--ink)]">Allocation Breakdown</span>
          <span
            className={`font-mono font-bold text-xs ${
              isOverAllocated ? "text-red-500" : "text-[var(--ink)]"
            }`}
          >
            {allocatedPct}% allocated · {poolReservePct}% pool reserve
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div className="h-3 w-full rounded-full bg-[var(--surface-2)] overflow-hidden flex border border-[var(--border-subtle)]">
          {creatorPct > 0 && (
            <div
              style={{ width: `${Math.min(creatorPct, 100)}%` }}
              className="bg-[var(--brand)] h-full transition-all"
              title={`Creator: ${creatorPct}%`}
            />
          )}
          {insiderTotalPct > 0 && (
            <div
              style={{ width: `${Math.min(insiderTotalPct, 100 - creatorPct)}%` }}
              className="bg-blue-400 dark:bg-blue-500 h-full transition-all"
              title={`Insiders: ${insiderTotalPct}%`}
            />
          )}
          {vestedTotalPct > 0 && (
            <div
              style={{
                width: `${Math.min(vestedTotalPct, 100 - creatorPct - insiderTotalPct)}%`,
              }}
              className="bg-indigo-500 h-full transition-all"
              title={`Vested: ${vestedTotalPct}%`}
            />
          )}
          {poolReservePct > 0 && (
            <div
              style={{ width: `${poolReservePct}%` }}
              className="bg-emerald-500 h-full transition-all"
              title={`Pool reserve: ${poolReservePct}%`}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs pt-1">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand)]" />
            <span className="text-[var(--ink-muted)]">Creator:</span>
            <span className="font-mono font-bold text-[var(--ink)]">{creatorPct}%</span>
          </div>
          {insiderTotalPct > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
              <span className="text-[var(--ink-muted)]">Insiders:</span>
              <span className="font-mono font-bold text-[var(--ink)]">{insiderTotalPct}%</span>
            </div>
          )}
          {vestedTotalPct > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
              <span className="text-[var(--ink-muted)]">Vested:</span>
              <span className="font-mono font-bold text-[var(--ink)]">{vestedTotalPct}%</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-[var(--ink-muted)]">Pool Reserve:</span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {poolReservePct}%
            </span>
          </div>
        </div>

        {isOverAllocated && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 flex items-center gap-2 font-medium">
            <AlertCircle size={14} className="shrink-0" />
            <span>Total allocations exceed 100% of the fixed 1B supply. Reduce creator or insider percentages.</span>
          </div>
        )}
      </div>

      {/* 3. Collapsible "Advanced distribution" */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-[var(--surface-2)]/60 transition cursor-pointer"
        >
          <div>
            <h3 className="text-xs font-bold text-[var(--ink)]">Advanced Distribution &amp; Vesting</h3>
            <p className="text-[11px] text-[var(--ink-muted)]">
              Creator wallet slider, team allocations ({insiders.length}/{MAX_INSIDERS}) &amp; linear vesting ({vested.length}/{MAX_VESTED})
            </p>
          </div>
          <span className="text-[var(--ink-muted)]">
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>

        {showAdvanced && (
          <div className="p-4 pt-0 border-t border-[var(--border-subtle)]/60 space-y-5">
            {/* Creator Wallet Slider */}
            <div className="space-y-2 pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[var(--ink)]">Creator Allocation</span>
                <span className="font-mono font-bold text-[var(--brand-text)]">{creatorPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={creatorPct}
                onChange={(e) => {
                  onCreatorPctChange(parseInt(e.target.value, 10));
                  onSelectPreset("creator" as LaunchPresetId);
                }}
                className="w-full accent-[var(--brand)] cursor-pointer"
              />
              <p className="text-[11px] text-[var(--ink-muted)]">
                Minted directly to your connected wallet upon launch. Max 30% recommended for healthy liquidity.
              </p>
            </div>

            {/* Insider Allocations */}
            <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]/40">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[var(--ink)]">Insider Allocations</span>
                  <span className="text-[11px] text-[var(--ink-muted)] ml-2">
                    ({insiders.length}/{MAX_INSIDERS})
                  </span>
                </div>
                {insiders.length < MAX_INSIDERS && (
                  <button
                    type="button"
                    onClick={addInsider}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-text)] hover:underline"
                  >
                    <Plus size={13} /> Add Insider
                  </button>
                )}
              </div>

              {insiders.map((ins) => (
                <div key={ins.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="0x… recipient wallet"
                    value={ins.address}
                    onChange={(e) => updateInsider(ins.id, { address: e.target.value })}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--brand-text)]"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0.1}
                      max={20}
                      step={0.5}
                      value={ins.pct}
                      onChange={(e) => updateInsider(ins.id, { pct: parseFloat(e.target.value) || 0 })}
                      className="w-16 px-2 py-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] text-xs font-mono text-[var(--ink)] text-right focus:outline-none focus:border-[var(--brand-text)]"
                    />
                    <span className="text-xs text-[var(--ink-muted)] font-bold">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeInsider(ins.id)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* Vested Allocations */}
            <div className="space-y-3 pt-2 border-t border-[var(--border-subtle)]/40">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-[var(--ink)]">Vested Allocations</span>
                  <span className="text-[11px] text-[var(--ink-muted)] ml-2">
                    ({vested.length}/{MAX_VESTED})
                  </span>
                </div>
                {vested.length < MAX_VESTED && (
                  <button
                    type="button"
                    onClick={addVested}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[var(--brand-text)] hover:underline"
                  >
                    <Plus size={13} /> Add Vested Schedule
                  </button>
                )}
              </div>

              {vested.map((v) => (
                <div key={v.id} className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="0x… beneficiary address"
                      value={v.address}
                      onChange={(e) => updateVested(v.id, { address: e.target.value })}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-xs font-mono text-[var(--ink)] focus:outline-none focus:border-[var(--brand-text)]"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0.5}
                        max={30}
                        step={0.5}
                        value={v.pct}
                        onChange={(e) => updateVested(v.id, { pct: parseFloat(e.target.value) || 0 })}
                        className="w-16 px-2 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] text-xs font-mono text-[var(--ink)] text-right focus:outline-none focus:border-[var(--brand-text)]"
                      />
                      <span className="text-xs text-[var(--ink-muted)] font-bold">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeVested(v.id)}
                      className="p-1 rounded-lg text-red-500 hover:bg-red-500/10 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[var(--ink-muted)]">
                    <div className="flex items-center gap-1.5">
                      <span>Cliff:</span>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={v.cliffMonths}
                        onChange={(e) => updateVested(v.id, { cliffMonths: parseInt(e.target.value, 10) || 0 })}
                        className="w-12 px-1.5 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--surface)] text-xs font-mono text-[var(--ink)] text-center"
                      />
                      <span>mo</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span>Vesting:</span>
                      <input
                        type="number"
                        min={1}
                        max={48}
                        value={v.vestMonths}
                        onChange={(e) => updateVested(v.id, { vestMonths: parseInt(e.target.value, 10) || 1 })}
                        className="w-12 px-1.5 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--surface)] text-xs font-mono text-[var(--ink)] text-center"
                      />
                      <span>mo</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
