"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, Download, KeyRound, Lock, RefreshCcw, ShieldCheck } from "lucide-react";
import {
  VaultAuthError,
  commitNewVault,
  deleteRemoteVault,
  fetchRemoteVault,
  getLocalVaultKey,
  lockVaultOnThisDevice,
  prepareNewVault,
  replaceRecoveryPhrase,
  syncVault,
  unlockVault,
} from "@/lib/voucher/vault-client";
import { normalizePhrase, vaultStats, type VaultContents } from "@/lib/voucher/vault-crypto";

/**
 * "Recovery & backup" for My Cards: turns on the private vault (end-to-end encrypted, recovery
 * phrase), unlocks it on a new device, syncs, and replaces the phrase.
 */

type Stage =
  | { kind: "checking" }
  | { kind: "error"; message: string }
  | { kind: "off" }
  | { kind: "show-phrase"; phrase: string; purpose: "create" | "rotate"; commit: () => Promise<void> }
  | { kind: "confirm-phrase"; phrase: string; purpose: "create" | "rotate"; commit: () => Promise<void>; ask: number[] }
  | { kind: "locked" }
  | { kind: "on"; stats: ReturnType<typeof vaultStats>; syncedAt: number };

const btn =
  "inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 py-2 rounded-xl text-sm font-bold transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";
const primary = `${btn} bg-[var(--brand)] text-white hover:opacity-90`;
const secondary = `${btn} bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--ink)] hover:bg-[var(--border-subtle)]/40`;
const danger = `${btn} bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 hover:bg-red-500/15`;

function pickThree(): number[] {
  const idx = new Set<number>();
  const buf = new Uint32Array(8);
  crypto.getRandomValues(buf);
  for (const n of buf) {
    idx.add(n % 12);
    if (idx.size === 3) break;
  }
  while (idx.size < 3) idx.add(idx.size * 4);
  return [...idx].sort((a, b) => a - b);
}

export default function VoucherVaultPanel({
  address,
  onChanged,
}: {
  address: string;
  /** Called after secrets were restored onto this device, so My Cards can re-read them. */
  onChanged?: () => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "checking" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phraseInput, setPhraseInput] = useState("");
  const [confirmInputs, setConfirmInputs] = useState<string[]>(["", "", ""]);
  const [savedIt, setSavedIt] = useState(false);
  const [copied, setCopied] = useState(false);
  const [resetText, setResetText] = useState("");
  const [showReset, setShowReset] = useState(false);

  const fail = useCallback((e: unknown) => {
    const msg = e instanceof Error ? e.message : "Something went wrong. Try again.";
    setError(e instanceof VaultAuthError ? "Your sign-in expired. Sign out and sign in again." : msg);
  }, []);

  const onSynced = useCallback(
    (contents: VaultContents) => {
      setStage({ kind: "on", stats: vaultStats(contents), syncedAt: Date.now() });
      onChanged?.();
    },
    [onChanged]
  );

  const load = useCallback(async () => {
    setError("");
    setStage({ kind: "checking" });
    try {
      const remote = await fetchRemoteVault(address);
      if (!remote) return setStage({ kind: "off" });
      if (!getLocalVaultKey(address)) return setStage({ kind: "locked" });
      onSynced(await syncVault(address));
    } catch (e) {
      // A stale local key is dropped by syncVault; fall back to the unlock screen.
      if (!getLocalVaultKey(address)) {
        try {
          if (await fetchRemoteVault(address)) {
            fail(e);
            return setStage({ kind: "locked" });
          }
        } catch {
          /* fall through */
        }
      }
      setStage({ kind: "error", message: e instanceof Error ? e.message : "Couldn't load your backup." });
    }
  }, [address, fail, onSynced]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const startCreate = () =>
    run(async () => {
      const prepared = await prepareNewVault(address);
      setSavedIt(false);
      setStage({
        kind: "show-phrase",
        phrase: prepared.phrase,
        purpose: "create",
        commit: async () => {
          await commitNewVault(address, prepared.envelope, prepared.vaultKey, prepared.contents);
          onSynced(prepared.contents);
        },
      });
    });

  const startRotate = () =>
    run(async () => {
      const { phrase, commit } = await replaceRecoveryPhrase(address);
      setSavedIt(false);
      setStage({
        kind: "show-phrase",
        phrase,
        purpose: "rotate",
        commit: async () => {
          await commit();
          onSynced(await syncVault(address));
        },
      });
    });

  const words = useMemo(() => (stage.kind === "show-phrase" || stage.kind === "confirm-phrase" ? stage.phrase.split(" ") : []), [stage]);

  const copyPhrase = async () => {
    if (stage.kind !== "show-phrase") return;
    try {
      await navigator.clipboard.writeText(stage.phrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy. Write the words down instead.");
    }
  };

  const downloadPhrase = () => {
    if (stage.kind !== "show-phrase") return;
    const text = [
      "Base gift backup — backup words",
      `Wallet: ${address}`,
      "",
      stage.phrase,
      "",
      "Anyone with these words and access to your wallet session can read your unclaimed gift links.",
      "Keep them offline. We can't recover them for you.",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `gift-backup-words-${address.slice(2, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirmOk =
    stage.kind === "confirm-phrase" &&
    stage.ask.every((wordIdx, i) => normalizePhrase(confirmInputs[i] ?? "") === words[wordIdx]);

  return (
    <section
      aria-labelledby="vault-title"
      className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-5 sm:p-6 space-y-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          {stage.kind === "on" ? <ShieldCheck size={18} /> : stage.kind === "locked" ? <Lock size={18} /> : <KeyRound size={18} />}
        </div>
        <div className="min-w-0 flex-1">
          <h3 id="vault-title" className="text-base font-black text-[var(--ink)]">
            Private backup
          </h3>
          <p className="text-xs text-[var(--ink-muted)]">
            {stage.kind === "on"
              ? "Private backup is on. Your claim links are encrypted on this device before they're saved, so only you can read them."
              : stage.kind === "locked"
                ? "This wallet has a private backup. Enter the 12 backup words this app gave you to load your claim links on this device."
                : "Keep your claim links safe if you lose this device. Private backup encrypts them so only you can read them."}
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}

      {stage.kind === "checking" && <div className="h-11 rounded-xl bg-[var(--surface-2)] animate-pulse" aria-busy="true" />}

      {stage.kind === "error" && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--ink-muted)]">{stage.message}</p>
          <button type="button" className={secondary} onClick={() => void load()}>
            <RefreshCcw size={14} /> Try again
          </button>
        </div>
      )}

      {stage.kind === "off" && (
        <div className="space-y-3">
          <ul className="space-y-1.5 text-xs text-[var(--ink-muted)]">
            <li>• This app gives you 12 backup words. With them, any device can load your claim links.</li>
            <li>• They are not your wallet&apos;s recovery phrase. Keep them private.</li>
            <li>• Our server stores only encrypted data and can&apos;t read your links. The copy it keeps today is deleted.</li>
            <li>• If you lose the words and every signed-in device, the links are gone for good. Gift funds stay onchain.</li>
          </ul>
          <button type="button" className={primary} disabled={busy} onClick={() => void startCreate()}>
            <ShieldCheck size={15} /> {busy ? "Preparing…" : "Turn on private backup"}
          </button>
        </div>
      )}

      {stage.kind === "show-phrase" && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-[var(--ink)]">
            {stage.purpose === "create" ? "Your backup words" : "Your new backup words"}
          </p>
          <p className="text-xs text-[var(--ink-muted)]">
            Write these 12 words down in order and keep them offline. We can&apos;t show them again
            {stage.purpose === "rotate" ? ", and your old words stop working" : ""}.
          </p>
          <ol className="grid grid-cols-2 sm:grid-cols-3 gap-2" aria-label="Backup words">
            {words.map((w, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2 font-mono text-sm text-[var(--ink)]"
              >
                <span className="w-5 text-right text-xs text-[var(--ink-dim)]">{i + 1}</span>
                <span className="font-bold">{w}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={secondary} onClick={() => void copyPhrase()}>
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
            </button>
            <button type="button" className={secondary} onClick={downloadPhrase}>
              <Download size={14} /> Download
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--ink)] min-h-[44px] cursor-pointer">
            <input type="checkbox" className="h-5 w-5" checked={savedIt} onChange={(e) => setSavedIt(e.target.checked)} />
            I saved my backup words somewhere safe
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={primary}
              disabled={!savedIt}
              onClick={() => {
                setConfirmInputs(["", "", ""]);
                setStage({ ...stage, kind: "confirm-phrase", ask: pickThree() });
              }}
            >
              Continue
            </button>
            <button type="button" className={secondary} onClick={() => void load()}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {stage.kind === "confirm-phrase" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!confirmOk) return;
            void run(stage.commit);
          }}
        >
          <p className="text-sm font-bold text-[var(--ink)]">Check your backup words</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {stage.ask.map((wordIdx, i) => (
              <label key={wordIdx} className="space-y-1 text-xs font-semibold text-[var(--ink-muted)]">
                Word #{wordIdx + 1}
                <input
                  value={confirmInputs[i] ?? ""}
                  onChange={(e) => setConfirmInputs((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full min-h-[44px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 font-mono text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-text)]"
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={primary} disabled={!confirmOk || busy}>
              <ShieldCheck size={15} />{" "}
              {busy ? "Saving…" : stage.purpose === "create" ? "Turn on private backup" : "Use new words"}
            </button>
            <button type="button" className={secondary} onClick={() => setStage({ ...stage, kind: "show-phrase" })}>
              Back
            </button>
          </div>
        </form>
      )}

      {stage.kind === "locked" && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              onSynced(await unlockVault(address, phraseInput));
              setPhraseInput("");
            });
          }}
        >
          <p role="note" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-semibold text-[var(--ink)]">
            Only type the 12 backup words this app showed you. Never type your wallet&apos;s recovery phrase here or on any website.
          </p>
          <label className="block space-y-1 text-xs font-semibold text-[var(--ink-muted)]">
            Backup words (12)
            <textarea
              value={phraseInput}
              onChange={(e) => setPhraseInput(e.target.value)}
              rows={3}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 font-mono text-sm text-[var(--ink)] outline-none focus:border-[var(--brand-text)]"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className={primary} disabled={busy || !phraseInput.trim()}>
              <Lock size={15} /> {busy ? "Unlocking…" : "Unlock on this device"}
            </button>
            <button type="button" className={secondary} onClick={() => setShowReset((v) => !v)}>
              Lost your backup words?
            </button>
          </div>
          {showReset && (
            <div className="space-y-2 rounded-xl border border-red-500/25 bg-red-500/5 p-3">
              <p className="text-xs text-[var(--ink-muted)]">
                If another device still has your backup unlocked, open My Cards there and choose{" "}
                <strong>New backup words</strong>. Otherwise you can reset: the saved links in this backup are
                deleted. Your gifts and their funds are not affected, and unclaimed gifts with an expiry can still
                be reclaimed.
              </p>
              <label className="block space-y-1 text-xs font-semibold text-[var(--ink-muted)]">
                Type RESET to confirm
                <input
                  value={resetText}
                  onChange={(e) => setResetText(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 text-sm text-[var(--ink)]"
                />
              </label>
              <button
                type="button"
                className={danger}
                disabled={busy || resetText !== "RESET"}
                onClick={() =>
                  void run(async () => {
                    await deleteRemoteVault(address);
                    setResetText("");
                    setShowReset(false);
                    setStage({ kind: "off" });
                  })
                }
              >
                Reset private backup
              </button>
            </div>
          )}
        </form>
      )}

      {stage.kind === "on" && (
        <div className="space-y-3">
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--ink-muted)]">
            <span>
              <strong className="text-[var(--ink)]">{stage.stats.cards}</strong> card links in{" "}
              <strong className="text-[var(--ink)]">{stage.stats.batches}</strong> batches
            </span>
            <span>
              <strong className="text-[var(--ink)]">{stage.stats.links}</strong> one-link gifts
            </span>
            <span>Synced {new Date(stage.syncedAt).toLocaleTimeString()}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondary}
              disabled={busy}
              onClick={() => void run(async () => onSynced(await syncVault(address)))}
            >
              <RefreshCcw size={14} className={busy ? "animate-spin" : ""} /> Sync now
            </button>
            <button type="button" className={secondary} disabled={busy} onClick={() => void startRotate()}>
              <KeyRound size={14} /> New backup words
            </button>
            <button
              type="button"
              className={secondary}
              disabled={busy}
              onClick={() => {
                lockVaultOnThisDevice(address);
                setStage({ kind: "locked" });
              }}
            >
              <Lock size={14} /> Lock on this device
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
