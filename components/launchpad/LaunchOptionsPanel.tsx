"use client";

import { Lock, Plus, Trash2, Shield } from "lucide-react";
import { DEFAULT_ANTI_SNIPE_BLOCKS } from "@/lib/launchpad/anti-snipe";
import type { InsiderAllocation, VestedAllocation } from "@/lib/launchpad/launch-config";
import {
  LAUNCH_PRESETS,
  type LaunchPresetId,
} from "@/lib/launchpad/launch-presets";

export default function LaunchOptionsPanel({
  metadataEditable,
  onMetadataEditable,
  creatorPct,
  onCreatorPct,
  insiders,
  onInsiders,
  vested,
  onVested,
  poolPct,
  activePreset,
  onPreset,
  antiSnipeBlocks,
  onAntiSnipeBlocks,
  maxInsiders = 8,
  maxVested = 6,
}: {
  metadataEditable: boolean;
  onMetadataEditable: (v: boolean) => void;
  creatorPct: number;
  onCreatorPct: (v: number) => void;
  insiders: InsiderAllocation[];
  onInsiders: (v: InsiderAllocation[]) => void;
  vested: VestedAllocation[];
  onVested: (v: VestedAllocation[]) => void;
  poolPct: number;
  activePreset: LaunchPresetId | null;
  onPreset: (id: LaunchPresetId) => void;
  antiSnipeBlocks: number;
  onAntiSnipeBlocks: (v: number) => void;
  maxInsiders?: number;
  maxVested?: number;
}) {
  const addInsider = () => {
    if (insiders.length >= maxInsiders) return;
    onInsiders([
      ...insiders,
      { id: crypto.randomUUID(), address: "", pct: 1 },
    ]);
  };

  const updateInsider = (id: string, patch: Partial<InsiderAllocation>) => {
    onInsiders(insiders.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const removeInsider = (id: string) => {
    onInsiders(insiders.filter((a) => a.id !== id));
  };

  const addVested = () => {
    if (vested.length >= maxVested) return;
    onVested([
      ...vested,
      { id: crypto.randomUUID(), address: "", pct: 5, cliffMonths: 3, vestMonths: 12 },
    ]);
  };

  const updateVested = (id: string, patch: Partial<VestedAllocation>) => {
    onVested(vested.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };

  const removeVested = (id: string) => {
    onVested(vested.filter((a) => a.id !== id));
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-5">
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase mb-3">Quick presets</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {LAUNCH_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onPreset(preset.id)}
              className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                activePreset === preset.id
                  ? "border-[var(--brand)] bg-[var(--brand-soft)]"
                  : "border-[var(--border-subtle)] bg-[var(--surface-2)] hover:border-[var(--brand)]"
              }`}
            >
              <p className="text-[11px] font-bold text-[var(--ink)]">{preset.label}</p>
              <p className="text-[9px] text-[var(--ink-muted)] mt-0.5 leading-snug">{preset.tagline}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase mb-3">Launch options</p>
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <span className="text-sm text-slate-300">Metadata editable after launch</span>
          <input
            type="checkbox"
            checked={metadataEditable}
            onChange={(e) => onMetadataEditable(e.target.checked)}
            className="accent-[var(--accent)] w-4 h-4"
          />
        </label>
        <p className="text-[10px] text-slate-500 mt-1.5">
          Grants METADATA role to you. Off by default — fully admin-less, renounced control.
        </p>
      </div>

      <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-amber-100 flex items-center gap-1.5">
              <Shield size={14} /> Anti-snipe window
            </p>
            <p className="text-[10px] text-amber-200/60">
              Blocks buys via Base Analytics for N blocks after pool opens (~2s/block on Base)
            </p>
          </div>
          <span className="text-sm font-black text-amber-200">{antiSnipeBlocks} blocks</span>
        </div>
        <input
          type="range"
          min={0}
          max={32}
          step={1}
          value={antiSnipeBlocks}
          onChange={(e) => onAntiSnipeBlocks(parseInt(e.target.value, 10))}
          className="w-full accent-amber-400"
        />
        <p className="text-[10px] text-amber-200/50">
          Default {DEFAULT_ANTI_SNIPE_BLOCKS} blocks (~16s). Set 0 to disable. Direct DEX trades bypass
          this — disclosed on token page.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">Creator wallet</p>
            <p className="text-[10px] text-slate-500">Liquid at genesis via batch mint</p>
          </div>
          <span className="text-sm font-black text-[var(--ink-muted)]">{creatorPct}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={50}
          step={1}
          value={creatorPct}
          onChange={(e) => onCreatorPct(parseInt(e.target.value, 10))}
          className="w-full accent-[var(--accent)]"
        />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-white">Insider allocations</p>
            <p className="text-[10px] text-slate-500">Immediate, liquid at genesis</p>
          </div>
          <span className="text-[10px] text-slate-500">
            {insiders.length}/{maxInsiders} slots
          </span>
        </div>
        {insiders.map((a) => (
          <div key={a.id} className="flex gap-2 items-center">
            <input
              value={a.address}
              onChange={(e) => updateInsider(a.id, { address: e.target.value })}
              placeholder="0x…"
              className="flex-1 min-w-0 bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-2 text-xs font-mono text-white outline-none focus:border-[var(--accent)]"
            />
            <input
              type="number"
              min={0.1}
              max={50}
              step={0.1}
              value={a.pct}
              onChange={(e) => updateInsider(a.id, { pct: parseFloat(e.target.value) || 0 })}
              className="w-16 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-2 text-xs text-white text-center outline-none"
            />
            <span className="text-[10px] text-slate-500">%</span>
            <button
              type="button"
              onClick={() => removeInsider(a.id)}
              className="p-2 text-rose-400 hover:text-rose-300"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addInsider}
          disabled={insiders.length >= maxInsiders}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold border border-dashed border-white/15 text-slate-400 hover:text-white disabled:opacity-40"
        >
          <Plus size={14} /> Add liquid allocation
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--ink)] flex items-center gap-1.5">
              <Lock size={14} /> Vested allocations
            </p>
            <p className="text-[10px] text-[var(--ink-muted)]">
              Stay unminted — true lock until on-chain vault (better than liquid &quot;vesting&quot;)
            </p>
          </div>
          <span className="text-[10px] text-[var(--ink-muted)]">
            {vested.length}/{maxVested}
          </span>
        </div>
        {vested.map((a) => (
          <div key={a.id} className="space-y-2 rounded-lg border border-[var(--border-subtle)] bg-black/20 p-3">
            <input
              value={a.address}
              onChange={(e) => updateVested(a.id, { address: e.target.value })}
              placeholder="Beneficiary 0x…"
              className="w-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg px-2.5 py-2 text-xs font-mono text-white outline-none focus:border-[var(--border-focus)]"
            />
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="number"
                min={0.5}
                max={40}
                step={0.5}
                value={a.pct}
                onChange={(e) => updateVested(a.id, { pct: parseFloat(e.target.value) || 0 })}
                className="w-16 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-2 text-xs text-white text-center outline-none"
              />
              <span className="text-[10px] text-slate-500">%</span>
              <span className="text-[10px] text-slate-500">cliff</span>
              <input
                type="number"
                min={0}
                max={24}
                value={a.cliffMonths}
                onChange={(e) =>
                  updateVested(a.id, { cliffMonths: parseInt(e.target.value, 10) || 0 })
                }
                className="w-14 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-2 text-xs text-white text-center outline-none"
              />
              <span className="text-[10px] text-slate-500">mo · vest</span>
              <input
                type="number"
                min={1}
                max={48}
                value={a.vestMonths}
                onChange={(e) =>
                  updateVested(a.id, { vestMonths: parseInt(e.target.value, 10) || 1 })
                }
                className="w-14 bg-white/[0.04] border border-white/10 rounded-lg px-2 py-2 text-xs text-white text-center outline-none"
              />
              <span className="text-[10px] text-slate-500">mo</span>
              <button
                type="button"
                onClick={() => removeVested(a.id)}
                className="ml-auto p-2 text-rose-400 hover:text-rose-300"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addVested}
          disabled={vested.length >= maxVested}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-bold border border-dashed border-[var(--border-strong)] text-[var(--ink-muted)] hover:text-[var(--ink)] disabled:opacity-40"
        >
          <Plus size={14} /> Add vested allocation
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-4 text-[11px] text-slate-400 leading-relaxed space-y-2">
        <p>
          <span className="text-[var(--ink-muted)] font-bold">{poolPct}%</span> of supply stays unminted as
          pool seed reserve. Add liquidity on Uniswap V3 or Aerodrome after launch — our router
          auto-picks the best price.
        </p>
        <p className="text-slate-500">
          Fixed 1B supply · one atomic genesis mint · no bonding curve · no migration tax.
        </p>
      </div>
    </div>
  );
}
