"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, RefreshCcw, X } from "lucide-react";
import { dropsApi, ensureSignedIn, type ConnType, type PublicDefinition, type RaffleView, type ReviewItemView } from "./drops-api";
import { Notice, Pill, btnPrimary, btnSecondary, untilText, useNow } from "./ui";

/**
 * Creator tools for a task drop (shown in My drops): approve submissions, show the live event
 * code on a screen, and draw the raffle.
 */
export default function CreatorTools({ dropId, address, connType }: { dropId: string; address: string; connType: ConnType }) {
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
  if (!reviewTasks.length && !liveTasks.length && !def.raffle) return null;

  return (
    <div className="space-y-4 border-t border-[var(--border-subtle)] pt-4">
      <p className="text-sm font-black text-[var(--ink)]">Creator tools</p>
      {error && <Notice tone="error">{error}</Notice>}
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
