"use client";

import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Plus, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import ActivePill from "@/components/ui/motion/ActivePill";
import { TYPE_HELP, TypeFields, newDraft, type TaskDraft } from "./TaskBuilder";
import { TASK_CATEGORIES, TASK_META, TASK_TEMPLATES, TaskIcon, missingFields, type TaskCategory } from "./task-meta";
import { accountsApi, type AccountsInfo, type CatalogEntry } from "./drops-api";
import { Field, Pill, Toggle, TRUST_LABEL, inputCls } from "./ui";

const MAX_TASKS = 20;

/**
 * Task picker for quest drops: browse tasks by category (or start from a template), tap one to
 * add it, and its settings open right away. Added tasks are numbered, reorderable and show
 * whether they still need something filled in.
 */
export default function TaskLibrary({
  catalog,
  drafts,
  onChange,
  daily,
}: {
  catalog: CatalogEntry[];
  drafts: TaskDraft[];
  onChange: (d: TaskDraft[]) => void;
  daily: boolean;
}) {
  const reduce = useReducedMotion();
  const [cat, setCat] = React.useState<TaskCategory | "templates">("social");
  const [open, setOpen] = React.useState<string | null>(drafts[0]?.key ?? null);
  const [bots, setBots] = React.useState<AccountsInfo["bots"] | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    accountsApi
      .info(null)
      .then((r) => setBots(r.bots))
      .catch(() => setBots(null));
  }, []);

  const available = new Map(catalog.map((c) => [c.type, c]));
  const countOf = (type: string) => drafts.filter((d) => d.type === type).length;

  const add = (items: Array<[string, string]>) => {
    const room = MAX_TASKS - drafts.length;
    const fresh = items
      .filter(([t]) => available.has(t))
      .slice(0, room)
      .map(([t, title]) => ({ ...newDraft(t, title), repeat: daily }));
    if (!fresh.length) return;
    onChange([...drafts, ...fresh]);
    setOpen(fresh[0]!.key);
    requestAnimationFrame(() => listRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }));
  };

  const update = (key: string, d: TaskDraft) => onChange(drafts.map((x) => (x.key === key ? d : x)));
  const move = (i: number, by: number) => {
    const j = i + by;
    if (j < 0 || j >= drafts.length) return;
    const next = [...drafts];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };

  const inCat = catalog.filter((c) => (TASK_META[c.type]?.category ?? "community") === cat);
  const ready = drafts.filter((d) => missingFields(d).length === 0).length;

  return (
    <div className="space-y-5">
      {/* library */}
      <div className="space-y-3">
        <div role="tablist" aria-label="Task categories" className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1 no-scrollbar">
          {[{ id: "templates" as const, label: "Templates" }, ...TASK_CATEGORIES].map((c) => {
            const selected = cat === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setCat(c.id)}
                className={`relative isolate min-h-[40px] shrink-0 rounded-xl px-3 text-xs font-bold transition-colors sm:flex-1 ${
                  selected ? "text-[var(--ink)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
                }`}
              >
                {selected && <ActivePill layoutId="drops-task-cat" className="bg-[var(--surface)] shadow-sm" />}
                {c.id === "templates" && <Sparkles size={12} className="mr-1 inline text-amber-500" aria-hidden />}
                {c.label}
              </button>
            );
          })}
        </div>

        {cat === "templates" ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {TASK_TEMPLATES.map((t) => {
              const usable = t.tasks.filter(([type]) => available.has(type));
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={!usable.length || drafts.length >= MAX_TASKS}
                  onClick={() => add(usable)}
                  className="group flex min-h-[64px] items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/60 p-3 text-left transition hover:border-[var(--brand)]/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex -space-x-2">
                    {usable.slice(0, 3).map(([type]) => (
                      <span key={type} className="rounded-xl ring-2 ring-[var(--surface)]">
                        <TaskIcon type={type} size={14} />
                      </span>
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-[var(--ink)]">{t.title}</span>
                    <span className="block text-xs text-[var(--ink-muted)]">{t.note}</span>
                  </span>
                  <Plus size={16} className="shrink-0 text-[var(--brand-text)] transition group-hover:scale-110" />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {inCat.map((c) => {
              const n = countOf(c.type);
              return (
                <button
                  key={c.type}
                  type="button"
                  disabled={drafts.length >= MAX_TASKS}
                  onClick={() => add([[c.type, c.label]])}
                  className={`group flex min-h-[64px] items-center gap-3 rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    n ? "border-[var(--brand)]/50 bg-[var(--brand-soft)]/40" : "border-[var(--border-subtle)] bg-[var(--surface-2)]/60 hover:border-[var(--brand)]/50"
                  }`}
                >
                  <TaskIcon type={c.type} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black leading-tight text-[var(--ink)]">{c.label}</span>
                    <span className="block text-xs text-[var(--ink-muted)]">{TASK_META[c.type]?.blurb ?? TYPE_HELP[c.type]}</span>
                  </span>
                  {n > 0 ? (
                    <Pill tone="brand">
                      <Check size={11} /> {n}
                    </Pill>
                  ) : (
                    <Plus size={16} className="shrink-0 text-[var(--brand-text)] transition group-hover:scale-110" />
                  )}
                </button>
              );
            })}
            {inCat.length === 0 && <p className="text-xs text-[var(--ink-muted)]">No tasks of this kind on this deployment.</p>}
          </div>
        )}
      </div>

      {/* chosen tasks */}
      <div ref={listRef} className="scroll-mt-24 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-black text-[var(--ink)]">
            Your tasks <span className="text-[var(--ink-muted)]">({drafts.length}/{MAX_TASKS})</span>
          </p>
          {drafts.length > 0 && (
            <Pill tone={ready === drafts.length ? "ok" : "warn"}>
              {ready === drafts.length ? "All set" : `${drafts.length - ready} need setup`}
            </Pill>
          )}
        </div>

        {drafts.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-5 text-center text-sm text-[var(--ink-muted)]">
            Tap a task above to add it. Claimers will see them in this order.
          </div>
        )}

        <AnimatePresence initial={false}>
          {drafts.map((d, i) => {
            const entry = available.get(d.type);
            const missing = missingFields(d);
            const isOpen = open === d.key;
            return (
              <motion.div
                key={d.key}
                layout={!reduce}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: -20 }}
                className={`overflow-hidden rounded-2xl border bg-[var(--surface)] ${isOpen ? "border-[var(--brand)]/60 shadow-sm" : "border-[var(--border-subtle)]"}`}
              >
                <div className="flex items-center gap-2 p-2.5 pr-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[11px] font-black text-[var(--ink-muted)]">{i + 1}</span>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : d.key)}
                    className="flex min-h-[44px] min-w-0 flex-1 items-center gap-2.5 text-left"
                  >
                    <TaskIcon type={d.type} size={15} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[var(--ink)]">{d.title || entry?.label || d.type}</span>
                      <span className="flex flex-wrap items-center gap-1 pt-0.5">
                        {missing.length ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                            <TriangleAlert size={11} /> Needs: {missing.join(", ")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                            <Check size={11} /> Ready
                          </span>
                        )}
                        {!d.required && <Pill>Optional{d.points ? ` · ${d.points} pts` : ""}</Pill>}
                        {d.repeat && <Pill>Every claim</Pill>}
                        {d.group && <Pill>Either: {d.group}</Pill>}
                      </span>
                    </span>
                    <ChevronDown size={16} className={`shrink-0 text-[var(--ink-muted)] transition ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  <div className="flex shrink-0 items-center">
                    <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                      <ArrowUp size={14} />
                    </IconBtn>
                    <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === drafts.length - 1}>
                      <ArrowDown size={14} />
                    </IconBtn>
                    <IconBtn label="Remove task" onClick={() => onChange(drafts.filter((x) => x.key !== d.key))} danger>
                      <Trash2 size={14} />
                    </IconBtn>
                  </div>
                </div>

                {isOpen && (
                  <div className="space-y-3 border-t border-[var(--border-subtle)] bg-[var(--surface-2)]/40 p-3.5">
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--ink-muted)]">
                      {TYPE_HELP[d.type]} {entry && <Pill tone="brand">{TRUST_LABEL[entry.trust] ?? entry.trust}</Pill>}
                    </p>
                    <Field label="Title claimers see">
                      <input className={inputCls} value={d.title} maxLength={80} onChange={(e) => update(d.key, { ...d, title: e.target.value })} />
                    </Field>
                    <TypeFields d={d} onChange={(nd) => update(d.key, nd)} bots={bots} />
                    <details className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1">
                      <summary className="flex min-h-[40px] cursor-pointer list-none items-center justify-between text-xs font-bold text-[var(--ink-muted)]">
                        More options (optional, points, either/or)
                        <ChevronDown size={14} className="transition group-open:rotate-180" />
                      </summary>
                      <div className="space-y-2 pb-2">
                        <Toggle checked={d.required} onChange={(v) => update(d.key, { ...d, required: v })} label="Required" hint="Off = optional; optional tasks can add points." />
                        <Toggle checked={d.repeat} onChange={(v) => update(d.key, { ...d, repeat: v })} label="Redo before every claim" hint="For daily drops: checked again each time." />
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Field label="Points (optional tasks)">
                            <input
                              className={inputCls}
                              inputMode="numeric"
                              value={String(d.points)}
                              onChange={(e) => update(d.key, { ...d, points: Math.max(0, Math.min(1000, Number(e.target.value.replace(/\D/g, "")) || 0)) })}
                            />
                          </Field>
                          <Field label="Either/or group" hint="Same name = any one of them is enough.">
                            <input className={inputCls} value={d.group} maxLength={32} onChange={(e) => update(d.key, { ...d, group: e.target.value })} placeholder="social" />
                          </Field>
                        </div>
                      </div>
                    </details>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition disabled:opacity-30 ${
        danger ? "text-[var(--ink-muted)] hover:bg-red-500/10 hover:text-red-500" : "text-[var(--ink-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}
