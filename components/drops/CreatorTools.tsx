"use client";

import React, { useCallback, useEffect, useState } from "react";
import { CalendarDays, Check, Globe, Loader2, RefreshCcw, Trash2, X } from "lucide-react";
import { dropsApi, ensureSignedIn, type CatalogEntry, type ConnType, type ListingCategory, type ListingView, type PublicDefinition, type RaffleView, type ReviewItemView } from "./drops-api";
import TaskLibrary, { dayLabel } from "./TaskLibrary";
import { draftsToDefinition, type TaskDraft } from "./TaskBuilder";
import { missingFields, TaskIcon } from "./task-meta";
import { Chips, Field, Notice, Pill, btnPrimary, btnSecondary, inputCls, untilText, useNow } from "./ui";

/**
 * Creator tools for a task drop (shown in My drops): approve submissions, show the live event
 * code on a screen, and draw the raffle.
 */
export interface CreatorDropInfo {
  committed: boolean;
  expiresAt: number;
  daily: boolean;
  closed: boolean;
  /** No link or gift-card secret, so it can be listed in Explore. */
  listable: boolean;
}

export default function CreatorTools({ dropId, address, connType, drop }: { dropId: string; address: string; connType: ConnType; drop: CreatorDropInfo }) {
  const [def, setDef] = useState<PublicDefinition | null>(null);
  const [error, setError] = useState("");
  const now = useNow(1000);

  useEffect(() => {
    dropsApi
      .definition(dropId)
      .then((r) => setDef(r.definition))
      .catch(() => setDef(null));
  }, [dropId]);

  if (!def) return null;
  const reviewTasks = def.tasks.filter((t) => t.type === "review");
  const liveTasks = def.tasks.filter((t) => t.type === "live_code");

  return (
    <div className="space-y-4 border-t border-[var(--border-subtle)] pt-4">
      <p className="text-sm font-black text-[var(--ink)]">Creator tools</p>
      {error && <Notice tone="error">{error}</Notice>}
      <TaskPlan dropId={dropId} address={address} connType={connType} def={def} drop={drop} onChange={setDef} onError={setError} />
      {drop.listable && !drop.closed && <ListingEditor dropId={dropId} address={address} connType={connType} onError={setError} />}
      {reviewTasks.length > 0 && <Reviews dropId={dropId} address={address} connType={connType} def={def} onError={setError} />}
      {liveTasks.map((t) => (
        <LiveCode key={t.id} dropId={dropId} address={address} connType={connType} taskId={t.id} title={t.title} now={now} onError={setError} />
      ))}
      {def.raffle && <Raffle dropId={dropId} def={def} now={now} onError={setError} />}
    </div>
  );
}

function Reviews({
  dropId,
  address,
  connType,
  def,
  onError,
}: {
  dropId: string;
  address: string;
  connType: ConnType;
  def: PublicDefinition;
  onError: (e: string) => void;
}) {
  const [items, setItems] = useState<ReviewItemView[] | null>(null);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    onError("");
    try {
      await ensureSignedIn(address, connType);
      setItems((await dropsApi.reviews(dropId, address)).items);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't load submissions");
    }
  }, [address, connType, dropId, onError]);

  const decide = async (it: ReviewItemView, approve: boolean) => {
    setBusy(`${it.wallet}:${it.taskId}`);
    try {
      await dropsApi.decideReview(dropId, address, it.wallet, it.taskId, approve);
      await load();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy("");
    }
  };

  const pending = items?.filter((i) => !i.decided) ?? [];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-[var(--ink)]">Submissions to review</p>
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCcw size={14} /> {items ? "Refresh" : "Load"}
        </button>
      </div>
      {items && pending.length === 0 && <p className="text-xs text-[var(--ink-muted)]">Nothing waiting.</p>}
      {pending.map((it) => {
        const title = def.tasks.find((t) => t.id === it.taskId)?.title ?? it.taskId;
        const key = `${it.wallet}:${it.taskId}`;
        return (
          <div key={key} className="rounded-xl border border-[var(--border-subtle)] p-3 space-y-2">
            <p className="text-xs text-[var(--ink-muted)]">
              {title} · {it.wallet.slice(0, 6)}…{it.wallet.slice(-4)}
            </p>
            {/^https:\/\//.test(it.content) ? (
              <a className="text-sm underline break-all text-[var(--brand-text)]" href={it.content} target="_blank" rel="noopener noreferrer nofollow">
                {it.content}
              </a>
            ) : (
              <p className="text-sm text-[var(--ink)] break-words whitespace-pre-wrap">{it.content}</p>
            )}
            <div className="flex gap-2">
              <button type="button" className={btnPrimary} disabled={busy === key} onClick={() => void decide(it, true)}>
                <Check size={14} /> Approve
              </button>
              <button type="button" className={btnSecondary} disabled={busy === key} onClick={() => void decide(it, false)}>
                <X size={14} /> Reject
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LiveCode({
  dropId,
  address,
  connType,
  taskId,
  title,
  now,
  onError,
}: {
  dropId: string;
  address: string;
  connType: ConnType;
  taskId: string;
  title: string;
  now: number;
  onError: (e: string) => void;
}) {
  const [on, setOn] = useState(false);
  const [code, setCode] = useState<{ code: string; until: number } | null>(null);

  useEffect(() => {
    if (!on) return;
    let alive = true;
    const tick = async () => {
      try {
        const r = await dropsApi.liveCode(dropId, address, taskId);
        if (alive) setCode({ code: r.code, until: Math.floor(Date.now() / 1000) + r.expiresIn });
      } catch (e) {
        if (alive) {
          onError(e instanceof Error ? e.message : "Couldn't load the code");
          setOn(false);
        }
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [on, dropId, address, taskId, onError]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-[var(--ink)]">Event code · {title}</p>
        <button
          type="button"
          className={on ? btnSecondary : btnPrimary}
          onClick={async () => {
            if (on) return setOn(false);
            try {
              await ensureSignedIn(address, connType);
              setOn(true);
            } catch (e) {
              onError(e instanceof Error ? e.message : "Sign-in failed");
            }
          }}
        >
          {on ? "Hide" : "Show on screen"}
        </button>
      </div>
      {on && code && (
        <div className="rounded-2xl bg-[var(--surface-2)] p-6 text-center space-y-1">
          <p className="font-mono text-5xl font-black tracking-[0.3em] text-[var(--ink)]" aria-live="polite">
            {code.code}
          </p>
          <p className="text-xs text-[var(--ink-muted)]">changes in {Math.max(0, code.until - now)}s</p>
        </div>
      )}
    </div>
  );
}

function Raffle({ dropId, def, now, onError }: { dropId: string; def: PublicDefinition; now: number; onError: (e: string) => void }) {
  const [view, setView] = useState<RaffleView | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => dropsApi.raffle(dropId).then(setView).catch(() => setView(null)), [dropId]);
  useEffect(() => {
    void load();
  }, [load]);
  const drawAt = def.raffle!.drawAt;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-[var(--ink)]">Raffle</p>
        {view && <Pill>{view.entrants} entered</Pill>}
      </div>
      {view?.result ? (
        <div className="space-y-1">
          <Notice tone="ok">
            Drawn: {view.result.winners.length} winners from {view.result.entrants} entries (block #{view.result.blockNumber}).
          </Notice>
          <p className="text-[11px] text-[var(--ink-muted)] break-all">Winners: {view.result.winners.join(", ") || "none"}</p>
        </div>
      ) : now < drawAt ? (
        <p className="text-xs text-[var(--ink-muted)]">Draw opens in {untilText(drawAt, now)}.</p>
      ) : (
        <button
          type="button"
          className={btnPrimary}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await dropsApi.drawRaffle(dropId);
              await load();
            } catch (e) {
              onError(e instanceof Error ? e.message : "Couldn't draw");
            } finally {
              setBusy(false);
            }
          }}
        >
          Draw winners
        </button>
      )}
    </div>
  );
}

/** Day-by-day task plan: see what's scheduled, remove tasks, add new ones (e.g. tomorrow's post). */
function TaskPlan({
  dropId,
  address,
  connType,
  def,
  drop,
  onChange,
  onError,
}: {
  dropId: string;
  address: string;
  connType: ConnType;
  def: PublicDefinition;
  drop: CreatorDropInfo;
  onChange: (d: PublicDefinition) => void;
  onError: (e: string) => void;
}) {
  const now = useNow();
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState("");
  const [ok, setOk] = useState("");
  const day = def.day ?? 1;
  const totalDays = Math.max(1, Math.min(365, Math.ceil((drop.expiresAt - (def.start ?? now)) / 86_400)));

  useEffect(() => {
    if (adding && catalog.length === 0) {
      dropsApi
        .catalog()
        .then((c) => setCatalog(c.tasks))
        .catch(() => undefined);
    }
  }, [adding, catalog.length]);

  const locked = drop.committed;
  const run = async (label: string, change: { add?: unknown[]; remove?: string[] }) => {
    onError("");
    setOk("");
    setBusy(label);
    try {
      await ensureSignedIn(address, connType);
      const r = await dropsApi.updateTasks(dropId, address, change);
      onChange(r.definition);
      setOk("Saved. Claimers see the change right away.");
      return true;
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't save");
      return false;
    } finally {
      setBusy("");
    }
  };

  const save = async () => {
    const bad = drafts.find((d) => missingFields(d).length);
    if (bad) return onError(`“${bad.title || bad.type}” needs: ${missingFields(bad).join(", ")}.`);
    let add: unknown[] = [];
    try {
      add = ((await draftsToDefinition(drafts)) as { tasks: Array<Record<string, unknown>> }).tasks.map(({ id: _id, ...rest }) => rest);
    } catch (e) {
      return onError(e instanceof Error ? e.message : "Check your tasks.");
    }
    if (await run("Saving…", { add })) {
      setDrafts([]);
      setAdding(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/40 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-black text-[var(--ink)]">
          <CalendarDays size={15} className="text-[var(--brand-text)]" /> Tasks by day
        </p>
        <Pill tone="brand">Today is day {day}</Pill>
      </div>
      {def.tasks.length === 0 ? (
        <p className="text-xs text-[var(--ink-muted)]">This drop has no tasks.</p>
      ) : (
        <ul className="space-y-1.5">
          {def.tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2">
              <TaskIcon type={t.type} size={13} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-[var(--ink)]">{t.title}</span>
                <span className="flex flex-wrap gap-1 pt-0.5">
                  <Pill tone={t.days ? "brand" : "muted"}>{dayLabel(t.days)}</Pill>
                  {t.activeNow === false ? <Pill>Not today</Pill> : <Pill tone="ok">Active today</Pill>}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Remove ${t.title}`}
                disabled={locked || Boolean(busy)}
                onClick={() => void run("Removing…", { remove: [t.id] })}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--ink-muted)] hover:bg-red-500/10 hover:text-red-500 disabled:opacity-30"
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {locked ? (
        <Notice>This drop is locked until it ends, so its tasks can&apos;t change. (Lock is off by default so you can plan new days later.)</Notice>
      ) : adding ? (
        <div className="space-y-3">
          <TaskLibrary
            catalog={catalog}
            drafts={drafts}
            onChange={setDrafts}
            daily={drop.daily}
            maxDays={totalDays}
            startDay={day}
            existingDays={def.tasks.flatMap((t) => (t.days ? Array.from({ length: Math.min(40, t.days.to - t.days.from + 1) }, (_, i) => t.days!.from + i) : []))}
            maxTasks={Math.max(1, 40 - def.tasks.length)}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={!drafts.length || Boolean(busy)} onClick={() => void save()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {busy || `Add ${drafts.length || ""} task${drafts.length === 1 ? "" : "s"}`}
            </button>
            <button type="button" className={btnSecondary} onClick={() => { setAdding(false); setDrafts([]); }} disabled={Boolean(busy)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={btnSecondary} onClick={() => setAdding(true)} disabled={Boolean(busy)}>
          Add tasks for another day
        </button>
      )}
      {ok && <Notice tone="ok">{ok}</Notice>}
    </div>
  );
}

const LISTING_CATS: Array<{ value: ListingCategory; label: string }> = [
  { value: "quest", label: "Quest" },
  { value: "daily", label: "Daily" },
  { value: "holders", label: "Holders" },
  { value: "airdrop", label: "Airdrop" },
  { value: "gift", label: "Gift" },
];

/** List the drop in Explore, edit how it's listed, or take it off. */
function ListingEditor({ dropId, address, connType, onError }: { dropId: string; address: string; connType: ConnType; onError: (e: string) => void }) {
  const [listing, setListing] = useState<ListingView | null | undefined>(undefined);
  const [form, setForm] = useState<{ title: string; blurb: string; category: ListingCategory }>({ title: "", blurb: "", category: "quest" });
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    dropsApi
      .listing(dropId)
      .then((r) => {
        setListing(r.listing);
        if (r.listing) setForm({ title: r.listing.title, blurb: r.listing.blurb, category: r.listing.category });
      })
      .catch(() => setListing(null));
  }, [dropId]);

  const save = async (value: typeof form | null) => {
    onError("");
    setBusy(true);
    try {
      await ensureSignedIn(address, connType);
      const r = await dropsApi.saveListing(dropId, address, value);
      setListing(r.listing);
      setOpen(false);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't save the listing");
    } finally {
      setBusy(false);
    }
  };

  if (listing === undefined) return null;
  return (
    <div className="space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/40 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-black text-[var(--ink)]">
          <Globe size={15} className="text-[var(--brand-text)]" /> Public listing
        </p>
        {listing ? <Pill tone="ok">Listed in Explore</Pill> : <Pill>Not listed</Pill>}
      </div>
      {open ? (
        <div className="space-y-2">
          <Field label="Title">
            <input className={inputCls} maxLength={60} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>
          <Field label="One line about it (optional)">
            <input className={inputCls} maxLength={160} value={form.blurb} onChange={(e) => setForm((f) => ({ ...f, blurb: e.target.value }))} />
          </Field>
          <Chips value={form.category} onPick={(v) => setForm((f) => ({ ...f, category: v }))} options={LISTING_CATS} />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnPrimary} disabled={busy || form.title.trim().length < 3} onClick={() => void save(form)}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : null} {listing ? "Update listing" : "List in Explore"}
            </button>
            <button type="button" className={btnSecondary} onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} onClick={() => setOpen(true)}>
            {listing ? "Edit listing" : "List in Explore"}
          </button>
          {listing && (
            <button type="button" className={btnSecondary} disabled={busy} onClick={() => void save(null)}>
              Remove from Explore
            </button>
          )}
        </div>
      )}
    </div>
  );
}
