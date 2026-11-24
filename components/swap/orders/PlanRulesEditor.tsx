"use client";

import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { describeRules, rulesMessage, validateRules, type PlanRules } from "@/limit-orders/shared/planRules";

export interface PlanRulesContext {
  chainId: number;
  orderBook: string;
  owner: string;
  sign: (message: string) => Promise<string>;
}

const DAYS = [
  [1, "Mon"],
  [2, "Tue"],
  [3, "Wed"],
  [4, "Thu"],
  [5, "Fri"],
  [6, "Sat"],
  [0, "Sun"],
] as const;

const WINDOWS = [
  { id: "any", label: "Any time", win: null },
  { id: "open", label: "First hour after the US market opens (9:30 to 10:30 ET)", win: { startMin: 570, endMin: 630 } },
  { id: "mid", label: "Midday (12:00 to 14:00 ET)", win: { startMin: 720, endMin: 840 } },
  { id: "close", label: "Last hour before the close (15:00 to 16:00 ET)", win: { startMin: 900, endMin: 960 } },
] as const;

/**
 * Rules for one recurring plan: which days and hours it may run, and optional price filters. They can
 * only make a run wait. They never change an amount, a fee or where funds go, and cancelling the plan
 * always works. The owner signs the rules in plain English (no gas) and the keeper checks that signature.
 */
export default function PlanRulesEditor({ planId, ctx }: { planId: string; ctx: PlanRulesContext }) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState<PlanRules | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [windowId, setWindowId] = useState<string>("any");
  const [dipOn, setDipOn] = useState(false);
  const [dipDays, setDipDays] = useState<7 | 30>(7);
  const [dipPct, setDipPct] = useState("5");
  const [skipOn, setSkipOn] = useState(false);
  const [skipDays, setSkipDays] = useState<7 | 30>(7);
  const [skipPct, setSkipPct] = useState("15");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetch(`/api/plans/rules?chainId=${ctx.chainId}&planId=${planId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { rules?: PlanRules | null } | null) => {
        if (!alive || !j) return;
        const r = j.rules ?? null;
        setSaved(r);
        setDays(r?.weekdays ?? []);
        setWindowId(WINDOWS.find((w) => w.win && r?.window && w.win.startMin === r.window.startMin && w.win.endMin === r.window.endMin)?.id ?? "any");
        setDipOn(Boolean(r?.dip));
        if (r?.dip) {
          setDipDays(r.dip.refDays);
          setDipPct(String(r.dip.minDropPct));
        }
        setSkipOn(Boolean(r?.skipIfUp));
        if (r?.skipIfUp) {
          setSkipDays(r.skipIfUp.days);
          setSkipPct(String(r.skipIfUp.pct));
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open, ctx.chainId, planId]);

  const draft = useMemo(() => {
    const raw: Record<string, unknown> = { v: 1 };
    if (days.length > 0) raw.weekdays = days;
    const w = WINDOWS.find((x) => x.id === windowId)?.win;
    if (w) raw.window = { ...w };
    if (dipOn) raw.dip = { refDays: dipDays, minDropPct: Number(dipPct) };
    if (skipOn) raw.skipIfUp = { days: skipDays, pct: Number(skipPct) };
    return validateRules(raw);
  }, [days, windowId, dipOn, dipDays, dipPct, skipOn, skipDays, skipPct]);

  const post = async (rules: PlanRules | null) => {
    setBusy(true);
    setMsg(null);
    try {
      const issuedAt = Math.floor(Date.now() / 1000);
      const message = rulesMessage({ chainId: ctx.chainId, orderBook: ctx.orderBook, planId, rules, issuedAt });
      const signature = await ctx.sign(message);
      const r = await fetch("/api/plans/rules", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chainId: ctx.chainId, planId, rules, issuedAt, signature }) });
      const j = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !j.ok) throw new Error(j.error ?? "Could not save the rules.");
      setSaved(rules);
      setMsg(rules ? "Rules saved. The keeper checks them before each run." : "Rules removed. The plan runs on its schedule only.");
    } catch (e) {
      const m = e instanceof Error ? e.message.split("\n")[0] : "Could not save the rules.";
      setMsg(/reject|denied|cancel/i.test(m) ? "Signing was cancelled. Nothing changed." : m);
    } finally {
      setBusy(false);
    }
  };

  const field = "min-h-[34px] rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-2)] px-2 text-xs font-bold text-[var(--ink)]";

  return (
    <div className="border-t border-[var(--border-subtle)] pt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)]">
        <SlidersHorizontal size={12} /> {saved ? "Rules on · edit" : "Add rules (days, time, dips)"}
      </button>
      {open && (
        <div className="mt-2 space-y-3 rounded-xl bg-[var(--surface-2)] p-3">
          <p className="text-[11px] text-[var(--ink-muted)]">
            Rules only make a run <b>wait</b>. They cannot change the amount, the fees or where your funds go, and you can cancel the plan any time. The keeper still needs the price feed to be fresh, so nothing runs on weekends.
          </p>
          {saved && <p className="text-[11px] font-semibold text-[var(--ink)]">Current: {describeRules(saved)}</p>}

          <div className="space-y-1">
            <span className="text-[11px] font-bold text-[var(--ink-soft)]">Only on these days (US Eastern)</span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weekdays">
              {DAYS.map(([d, label]) => (
                <button key={d} type="button" aria-pressed={days.includes(d)} onClick={() => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))} className={`min-h-[32px] rounded-full border px-3 text-[11px] font-bold ${days.includes(d) ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--ink-muted)]"}`}>
                  {label}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-[var(--ink-muted)]">None selected means any day.</span>
          </div>

          <label className="block space-y-1 text-[11px] font-bold text-[var(--ink-soft)]">
            Time of day
            <select value={windowId} onChange={(e) => setWindowId(e.target.value)} className={`${field} block w-full`}>
              {WINDOWS.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--ink-soft)]">
              <input type="checkbox" checked={dipOn} onChange={(e) => setDipOn(e.target.checked)} /> Only buy on a dip
            </label>
            {dipOn && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-muted)]">
                at least
                <input aria-label="Dip percent" inputMode="decimal" value={dipPct} onChange={(e) => setDipPct(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))} className={`${field} w-16 text-center`} />% below the
                <select aria-label="Dip reference" value={dipDays} onChange={(e) => setDipDays(Number(e.target.value) as 7 | 30)} className={field}>
                  <option value={7}>7-day</option>
                  <option value={30}>30-day</option>
                </select>
                high
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--ink-soft)]">
              <input type="checkbox" checked={skipOn} onChange={(e) => setSkipOn(e.target.checked)} /> Skip when the price has run up
            </label>
            {skipOn && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-muted)]">
                up more than
                <input aria-label="Skip percent" inputMode="decimal" value={skipPct} onChange={(e) => setSkipPct(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))} className={`${field} w-16 text-center`} />% over
                <select aria-label="Skip window" value={skipDays} onChange={(e) => setSkipDays(Number(e.target.value) as 7 | 30)} className={field}>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                </select>
              </div>
            )}
          </div>

          {(dipOn || skipOn) && <p className="text-[11px] text-[var(--ink-muted)]">Price rules wait if the price history cannot be read, so a feed problem delays a run instead of buying blindly. A rule that is never met leaves the plan waiting until you change it or cancel.</p>}
          {!draft.ok && <p role="alert" className="text-[11px] font-semibold text-amber-600 dark:text-amber-300">{draft.error}</p>}
          {draft.ok && <p className="text-[11px] text-[var(--ink)]">You will sign: {describeRules(draft.rules)}.</p>}
          {msg && <p role="status" className="text-[11px] font-semibold text-[var(--ink)]">{msg}</p>}

          <div className="flex gap-2">
            <button type="button" disabled={busy || !draft.ok} onClick={() => draft.ok && void post(draft.rules)} className="min-h-[36px] flex-1 rounded-lg bg-[var(--brand)] text-xs font-bold text-white disabled:opacity-40">
              {busy ? "Waiting for your wallet…" : "Sign and save rules"}
            </button>
            {saved && (
              <button type="button" disabled={busy} onClick={() => void post(null)} className="min-h-[36px] rounded-lg border border-[var(--border-subtle)] px-3 text-xs font-bold text-rose-500 disabled:opacity-40">
                Remove rules
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
