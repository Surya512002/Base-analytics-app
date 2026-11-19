"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, ExternalLink, Gift, Loader2, RefreshCcw, XCircle } from "lucide-react";
import { encodeContractCall } from "@/lib/utils/tx";
import { DROPS_EXPLORER } from "@/lib/drops/network";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { BASE_DROPS_ABI } from "@/lib/drops/abi";
import { DROPS_CHAIN_ID, DROPS_CONTRACT, emptyClaimArgs, explainDropError, fromUnits, signCode, signLink, type ParsedDropLink } from "@/lib/drops/client";
import {
  type RaffleView,
  dropsApi,
  ensureSignedIn,
  isSet,
  readDropView,
  readWalletStatus,
  tokenMeta,
  type ConnType,
  type DropView,
  type Progress,
  type PublicDefinition,
  type PublicTask,
} from "./drops-api";
import LinkedAccounts from "./LinkedAccounts";
import { Card, Field, Notice, Pill, btnPrimary, btnSecondary, inputCls, untilText, useNow, TRUST_LABEL } from "./ui";

/** A drop's claim page: who sent it, what it pays, the rules, the task checklist and the claim button. */
export default function DropClaim({
  link,
  address,
  connType,
  onRequestConnect,
}: {
  link: ParsedDropLink & { id: string };
  address: string | null;
  connType: ConnType;
  onRequestConnect: () => void;
}) {
  const id = useMemo(() => BigInt(link.id), [link.id]);
  const [drop, setDrop] = useState<DropView | null | undefined>(undefined);
  const [meta, setMeta] = useState({ symbol: "", decimals: 18 });
  const [def, setDef] = useState<PublicDefinition | null>(null);
  const [status, setStatus] = useState<{ blocker: string; nextClaimAt: number; claims: number } | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [inputs, setInputs] = useState<Record<string, string | string[]>>({});
  const [checking, setChecking] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [claimed, setClaimed] = useState<string | null>(null);
  const [raffle, setRaffle] = useState<RaffleView | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const now = useNow();
  // Invite links carry ?ref=<wallet>; it is only emitted onchain (for referral counts).
  const [referrer] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const r = new URLSearchParams(window.location.search).get("ref");
    return r && /^0x[0-9a-fA-F]{40}$/.test(r) ? r.toLowerCase() : null;
  });

  const loadDrop = useCallback(async () => {
    try {
      const d = await readDropView(id);
      setDrop(d);
      if (d) setMeta(await tokenMeta(d.token));
      if (d && isSet(d.ticketSigner)) setDef((await dropsApi.definition(link.id)).definition);
    } catch {
      setDrop(null);
    }
  }, [id, link.id]);

  const loadWallet = useCallback(async () => {
    if (!address || !drop) return;
    setStatus(await readWalletStatus(id, address as `0x${string}`).catch(() => null));
    if (def?.raffle) setRaffle(await dropsApi.raffle(link.id, address).catch(() => null));
    if (isSet(drop.ticketSigner) && def) {
      try {
        setProgress(await dropsApi.progress(link.id, address));
        setNeedsSignIn(false);
      } catch (e) {
        if ((e as { requiresAuth?: boolean }).requiresAuth) setNeedsSignIn(true);
      }
    }
  }, [address, drop, def, id, link.id]);

  useEffect(() => {
    void loadDrop();
  }, [loadDrop]);
  useEffect(() => {
    void loadWallet();
  }, [loadWallet]);

  if (drop === undefined) {
    return (
      <Card>
        <div className="h-24 rounded-2xl bg-[var(--surface-2)] animate-pulse" aria-busy="true" />
      </Card>
    );
  }
  if (!drop) {
    return (
      <Card>
        <Notice tone="error">{DROPS_CONTRACT ? "This drop doesn't exist." : "Drops aren't live on this deployment yet."}</Notice>
      </Card>
    );
  }

  const usesTasks = isSet(drop.ticketSigner);
  const needsLink = isSet(drop.linkSigner);
  const needsCode = isSet(drop.codesRoot);
  const fmt = (v: bigint) => `${fromUnits(v, meta.decimals)} ${meta.symbol}`;
  const left = drop.maxClaimsTotal ? Math.max(0, drop.maxClaimsTotal - drop.claimedCount) : null;
  const missingSecret = (needsLink && !link.linkKey) || (needsCode && !link.codeKey);

  const signIn = async () => {
    if (!address) return onRequestConnect();
    setError("");
    try {
      await ensureSignedIn(address, connType);
      await loadWallet();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    }
  };

  const check = async (task: PublicTask) => {
    if (!address) return onRequestConnect();
    setChecking(task.id);
    setError("");
    try {
      const v = inputs[task.id];
      const submission =
        task.type === "x_post"
          ? { url: v }
          : task.type === "quiz"
            ? { answers: v }
            : task.type === "secret_word"
              ? { answer: v }
              : task.type === "live_code"
                ? { code: v }
                : task.type === "review"
                  ? { content: v }
                  : undefined;
      await dropsApi.checkTask(link.id, address, task.id, submission);
      setProgress(await dropsApi.progress(link.id, address));
    } catch (e) {
      if ((e as { requiresAuth?: boolean }).requiresAuth) setNeedsSignIn(true);
      setError(e instanceof Error ? e.message : "Check failed");
    } finally {
      setChecking("");
    }
  };

  const claim = async () => {
    if (!address) return onRequestConnect();
    if (!DROPS_CONTRACT) return;
    setError("");
    try {
      const args = emptyClaimArgs();
      if (needsLink) {
        if (!link.linkKey) throw new Error("This link is missing its key. Ask the sender for the full link.");
        args.linkSig = await signLink(link.linkKey, DROPS_CONTRACT, id, address);
      }
      if (needsCode) {
        if (!link.codeKey) throw new Error("This gift card link is missing its code.");
        const { privateKeyToAccount } = await import("viem/accounts");
        args.code = privateKeyToAccount(link.codeKey).address;
        args.codeProof = link.codeProof;
        args.codeSig = await signCode(link.codeKey, DROPS_CONTRACT, id, address);
      }
      if (isSet(drop.allowlistRoot)) {
        const { proof } = await dropsApi.allowlistProof(link.id, address);
        if (proof) args.allowlistProof = proof;
        else if (!isSet(drop.gate)) throw new Error("Your wallet isn't on this drop's list.");
      }
      if (usesTasks) {
        setBusy("Checking your tasks…");
        await ensureSignedIn(address, connType);
        const { ticket } = await dropsApi.ticket(link.id, address);
        args.amount = BigInt(ticket.amount);
        args.deadline = BigInt(ticket.deadline);
        args.ticket = ticket.ticket;
      }
      if (referrer && referrer !== address.toLowerCase()) args.referrer = referrer as `0x${string}`;
      setBusy("Confirm in your wallet…");
      const call = encodeContractCall(DROPS_CONTRACT, BASE_DROPS_ABI, "claim", [id, args]);
      const hash = await sendAppTransactions(connType ?? "injected", address, [call], { targetChainId: DROPS_CHAIN_ID });
      setBusy("Waiting for confirmation…");
      try {
        const { dropsClient } = await import("./drops-api");
        await dropsClient().waitForTransactionReceipt({ hash: hash as `0x${string}`, timeout: 120_000 });
      } catch {
        /* bundle id: the balance updates shortly */
      }
      setClaimed(fmt(args.amount > BigInt(0) ? args.amount : drop.amountPerClaim));
      await loadDrop();
      await loadWallet();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/[a-z]/.test(msg) && !/revert|execution|0x/i.test(msg) ? msg : explainDropError(msg));
    } finally {
      setBusy("");
    }
  };

  const ev = progress?.evaluation;
  const blocker = status?.blocker ?? "";
  const accountProviders = (["x", "discord", "telegram"] as const).filter((p) =>
    def?.tasks.some((t) =>
      p === "x" ? t.type === "x_account" || t.type === "x_post" : p === "discord" ? t.type === "discord_member" : t.type === "telegram_member"
    )
  );
  const raffleBlocks = Boolean(def?.raffle) && !raffle?.result?.won;
  const canClaim = Boolean(address) && !blocker && !missingSecret && (!usesTasks || ev?.eligible) && !raffleBlocks;
  const inviteLink =
    address && typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}?ref=${address.toLowerCase()}${window.location.hash}`
      : "";

  const enterRaffle = async () => {
    if (!address) return onRequestConnect();
    setError("");
    try {
      setBusy("Entering…");
      await ensureSignedIn(address, connType);
      await dropsApi.enterRaffle(link.id, address);
      setRaffle(await dropsApi.raffle(link.id, address));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't enter");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand-text)]">
            <Gift size={22} />
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-bold text-[var(--ink-muted)]">
              Drop #{link.id} from {drop.senderLabel ? `${drop.senderLabel} · ` : ""}
              <a className="underline" href={`${DROPS_EXPLORER}/address/${drop.creator}`} target="_blank" rel="noopener noreferrer">
                {drop.creator.slice(0, 6)}…{drop.creator.slice(-4)}
              </a>
            </p>
            <h2 className="text-xl font-black text-[var(--ink)]">{fmt(drop.amountPerClaim)} per claim</h2>
            {drop.message && <p className="text-sm text-[var(--ink-soft)]">“{drop.message}”</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {left !== null && <Pill tone={left > 0 ? "ok" : "bad"}>{left} left</Pill>}
          <Pill>{fmt(drop.budget)} in escrow</Pill>
          {drop.maxClaimsPerWallet > 0 && <Pill>{drop.maxClaimsPerWallet} per wallet</Pill>}
          {drop.cooldown > 0 && <Pill>every {Math.round(drop.cooldown / 3600)}h</Pill>}
          {drop.maxClaimsPerPeriod > 0 && <Pill>{drop.maxClaimsPerPeriod}/day</Pill>}
          {drop.committed && <Pill tone="brand">Locked until it ends</Pill>}
          <Pill>{drop.expiresAt > now ? `ends in ${untilText(drop.expiresAt, now)}` : "ended"}</Pill>
          {needsCode && <Pill tone="brand">Gift card</Pill>}
          {isSet(drop.gate) && <Pill tone="brand">Holders only</Pill>}
          {isSet(drop.allowlistRoot) && <Pill tone="brand">List only</Pill>}
        </div>
      </Card>

      {usesTasks && def && accountProviders.length > 0 && (
        <LinkedAccounts address={address} connType={connType} providers={accountProviders} title="Link your accounts for these tasks" />
      )}

      {usesTasks && def && (
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-black text-[var(--ink)]">Tasks</h3>
            {ev && (
              <Pill tone={ev.eligible ? "ok" : "warn"}>
                {ev.eligible ? "All done" : "Not done yet"}
                {ev.points ? ` · ${ev.points} pts` : ""}
              </Pill>
            )}
          </div>
          {needsSignIn && (
            <div className="space-y-2">
              <Notice>Sign in with your wallet to check tasks (one free signature).</Notice>
              <button type="button" className={btnPrimary} onClick={() => void signIn()}>
                Sign in
              </button>
            </div>
          )}
          {!address && <Notice>Connect your wallet to start the tasks.</Notice>}
          <ul className="space-y-3">
            {def.tasks.map((t) => {
              const r = progress?.results[t.id];
              const icon =
                r?.status === "passed" ? (
                  <CheckCircle2 size={18} className="text-emerald-500" />
                ) : r?.status === "pending" ? (
                  <Loader2 size={18} className="text-amber-500" />
                ) : r?.status === "failed" ? (
                  <XCircle size={18} className="text-red-500" />
                ) : (
                  <Circle size={18} className="text-[var(--ink-dim)]" />
                );
              const code = progress?.extras[t.id]?.code;
              return (
                <li key={t.id} className="rounded-2xl border border-[var(--border-subtle)] p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5">{icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[var(--ink)]">{t.title}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {!t.required && <Pill>optional{t.points ? ` · +${t.points} pts` : ""}</Pill>}
                        {t.repeat && <Pill>every claim</Pill>}
                        {t.group && <Pill>either/or: {t.group}</Pill>}
                        {t.trust && <Pill>{TRUST_LABEL[t.trust] ?? t.trust}</Pill>}
                      </div>
                      {r?.message && <p className="text-xs text-[var(--ink-muted)] mt-1">{r.message}</p>}
                    </div>
                  </div>

                  {t.type === "x_post" && code && (
                    <div className="space-y-2">
                      <p className="text-xs text-[var(--ink-muted)]">
                        Post publicly on X including <strong className="font-mono text-[var(--ink)]">{code}</strong>
                        {t.config.mention ? ` and mention @${String(t.config.mention)}` : ""}
                        {t.config.mustInclude ? ` and "${String(t.config.mustInclude)}"` : ""}, then paste the link.
                      </p>
                      <a
                        className={btnSecondary}
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`https://x.com/intent/post?text=${encodeURIComponent(
                          [t.config.mention ? `@${String(t.config.mention)}` : "", t.config.mustInclude ? String(t.config.mustInclude) : "", code].filter(Boolean).join(" ")
                        )}`}
                      >
                        <ExternalLink size={14} /> Post on X
                      </a>
                      <input className={inputCls} placeholder="https://x.com/you/status/…" value={String(inputs[t.id] ?? "")} onChange={(e) => setInputs((s) => ({ ...s, [t.id]: e.target.value }))} />
                    </div>
                  )}
                  {t.type === "quiz" && Array.isArray(t.config.questions) && (
                    <div className="space-y-2">
                      {(t.config.questions as string[]).map((q, i) => (
                        <Field key={i} label={q}>
                          <input
                            className={inputCls}
                            value={(inputs[t.id] as string[] | undefined)?.[i] ?? ""}
                            onChange={(e) =>
                              setInputs((s) => {
                                const arr = [...((s[t.id] as string[] | undefined) ?? (t.config.questions as string[]).map(() => ""))];
                                arr[i] = e.target.value;
                                return { ...s, [t.id]: arr };
                              })
                            }
                          />
                        </Field>
                      ))}
                    </div>
                  )}
                  {t.type === "secret_word" && (
                    <Field label={t.config.hint ? `Hint: ${String(t.config.hint)}` : "Secret word"}>
                      <input className={inputCls} value={String(inputs[t.id] ?? "")} onChange={(e) => setInputs((s) => ({ ...s, [t.id]: e.target.value }))} />
                    </Field>
                  )}
                  {t.type === "live_code" && (
                    <Field label={t.config.place ? `Code shown at ${String(t.config.place)}` : "6-digit event code"}>
                      <input
                        className={inputCls}
                        inputMode="numeric"
                        maxLength={6}
                        value={String(inputs[t.id] ?? "")}
                        onChange={(e) => setInputs((s) => ({ ...s, [t.id]: e.target.value.replace(/\D/g, "") }))}
                      />
                    </Field>
                  )}
                  {t.type === "review" && r?.status !== "pending" && (
                    <Field label={String(t.config.instructions ?? "Your submission")}>
                      <input
                        className={inputCls}
                        value={String(inputs[t.id] ?? "")}
                        placeholder={t.config.kind === "text" ? "" : "https://…"}
                        onChange={(e) => setInputs((s) => ({ ...s, [t.id]: e.target.value }))}
                      />
                    </Field>
                  )}
                  {t.type === "referrals" && inviteLink && (
                    <div className="flex gap-2">
                      <input readOnly className={inputCls} value={inviteLink} onFocus={(e) => e.currentTarget.select()} />
                      <button
                        type="button"
                        className={btnSecondary}
                        onClick={() =>
                          void navigator.clipboard.writeText(inviteLink).then(() => {
                            setCopiedInvite(true);
                            setTimeout(() => setCopiedInvite(false), 1500);
                          })
                        }
                      >
                        {copiedInvite ? "Copied" : "Copy invite"}
                      </button>
                    </div>
                  )}

                  {r?.status !== "passed" && (
                    <button type="button" className={btnSecondary} disabled={checking === t.id || !address} onClick={() => void check(t)}>
                      {checking === t.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                      {t.needsSubmission ? "Submit" : "Check"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {def?.raffle && (
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-black text-[var(--ink)]">Raffle</h3>
            <Pill tone="brand">
              {def.raffle.winners} winner{def.raffle.winners === 1 ? "" : "s"}
            </Pill>
          </div>
          {!raffle?.result ? (
            <>
              <p className="text-sm text-[var(--ink-soft)]">
                Finish the tasks, then enter. {raffle ? `${raffle.entrants} entered so far. ` : ""}
                {now < def.raffle.drawAt ? `Draw in ${untilText(def.raffle.drawAt, now)}.` : "Drawing soon."}
              </p>
              {raffle?.entered ? (
                <Notice tone="ok">You&apos;re in. Come back after the draw.</Notice>
              ) : (
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={!address || !ev?.eligible || now >= def.raffle.drawAt || Boolean(busy)}
                  onClick={() => void enterRaffle()}
                >
                  Enter raffle
                </button>
              )}
            </>
          ) : raffle.result.won ? (
            <Notice tone="ok">You won! Claim below.</Notice>
          ) : (
            <Notice>
              Drawn: {raffle.result.winners.length} winners from {raffle.result.entrants} entries. This wallet wasn&apos;t picked this time.
            </Notice>
          )}
          {def.raffle.commit && (
            <p className="text-[11px] text-[var(--ink-muted)] break-all">
              Fairness: the draw uses a secret committed before entries opened ({def.raffle.commit.slice(0, 14)}…)
              {raffle?.result ? ` plus block #${raffle.result.blockNumber}. Seed: ${raffle.result.seed}` : " plus a future block hash."}
            </p>
          )}
        </Card>
      )}

      <Card>
        {progress?.streak && progress.streak.next > 1 && (
          <Notice tone="ok">
            Day {progress.streak.next} streak: +{((progress.streak.multiplierBps - 10_000) / 100).toFixed(0)}% on this claim.
          </Notice>
        )}
        {claimed ? (
          <Notice tone="ok">You claimed {claimed}. It&apos;s in your wallet.</Notice>
        ) : (
          <>
            {missingSecret && <Notice tone="error">This link is missing its key. Ask the sender for the full link.</Notice>}
            {address && blocker && (
              <Notice tone="warn">
                {blocker === "Cooldown active" && status?.nextClaimAt
                  ? `You can claim again in ${untilText(status.nextClaimAt, now)}.`
                  : explainDropError(blocker)}
              </Notice>
            )}
            {address && status && status.claims > 0 && !blocker && <Notice>You&apos;ve claimed {status.claims} time{status.claims === 1 ? "" : "s"}.</Notice>}
            {error && <Notice tone="error">{error}</Notice>}
            {address ? (
              <button type="button" className={`${btnPrimary} w-full`} disabled={!canClaim || Boolean(busy)} onClick={() => void claim()}>
                {busy || (def?.rewards?.mode === "random" ? "Claim your lucky amount" : `Claim ${fmt(ev && ev.amount !== "0" ? BigInt(ev.amount) : drop.amountPerClaim)}`)}
              </button>
            ) : (
              <button type="button" className={`${btnPrimary} w-full`} onClick={onRequestConnect}>
                Connect wallet to claim
              </button>
            )}
            <p className="text-[11px] text-[var(--ink-muted)]">
              Funds come straight from the drop&apos;s escrow contract on Base. Your claim proof only works for your wallet.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
