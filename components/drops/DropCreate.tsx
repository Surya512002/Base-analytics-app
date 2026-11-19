"use client";

import React, { useEffect, useMemo, useState } from "react";
import { parseEventLogs } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CheckCircle2, ChevronLeft, ChevronRight, Copy, Download } from "lucide-react";
import { ERC20_ABI } from "@/lib/constants/contracts";
import { DROPS_USDC } from "@/lib/drops/network";
import { encodeContractCall, type ContractCall } from "@/lib/utils/tx";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { BASE_DROPS_ABI } from "@/lib/drops/abi";
import {
  DROPS_CHAIN_ID,
  DROPS_CONTRACT,
  PRESETS,
  ZERO_ADDRESS,
  codeLink,
  defaultForm,
  dropLink,
  explainDropError,
  fromUnits,
  prepareDrop,
  toUnits,
  type Access,
  type DropForm,
  type PresetId,
} from "@/lib/drops/client";
import { syncVaultInBackground } from "@/lib/voucher/vault-client";
import TaskBuilder, { draftsToDefinition, type TaskDraft } from "./TaskBuilder";
import { dropsApi, dropsClient, ensureSignedIn, saveDrop, tokenMeta, updateSavedDrop, type CatalogEntry, type ConnType } from "./drops-api";
import { Card, Field, Notice, Pill, Toggle, btnPrimary, btnSecondary, inputCls, useNow } from "./ui";

type Step = "preset" | "reward" | "rules" | "tasks" | "review" | "done";

const ACCESS_LABEL: Record<Access, { title: string; note: string }> = {
  link: { title: "Anyone with the link", note: "One private link. Copying someone's claim from the chain doesn't work." },
  codes: { title: "Unique codes", note: "Gift cards: each code works once." },
  allowlist: { title: "Wallets on my list", note: "Paste addresses." },
  holders: { title: "Token holders or my list", note: "Hold a token, NFT or stock — or be on your list." },
  tasks: { title: "Wallets that finish tasks", note: "Follows, buys, posts, quizzes… checked by the app." },
};

interface Done {
  id: string;
  link: string | null;
  codeLinks: string[];
  publicLink: string;
  warnings: string[];
}

export default function DropCreate({
  address,
  connType,
  onCreated,
}: {
  address: string;
  connType: ConnType;
  onCreated?: (id: string) => void;
}) {
  const [step, setStep] = useState<Step>("preset");
  const [form, setForm] = useState<DropForm>(() => defaultForm("group"));
  const [asset, setAsset] = useState<"ETH" | "USDC" | "TOKEN">("ETH");
  const [customToken, setCustomToken] = useState("");
  const [drafts, setDrafts] = useState<TaskDraft[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [appSigner, setAppSigner] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [copied, setCopied] = useState("");
  const now = useNow();

  useEffect(() => {
    dropsApi
      .catalog()
      .then((c) => {
        setCatalog(c.tasks);
        setAppSigner(c.ticketSigner);
      })
      .catch(() => {
        /* task drops show as unavailable */
      });
  }, []);

  const set = (patch: Partial<DropForm>) => setForm((f) => ({ ...f, ...patch }));
  const usesTasks = form.access.includes("tasks");
  const daily = form.cooldownHours > 0;

  // Asset → token address + metadata.
  useEffect(() => {
    let alive = true;
    if (asset === "ETH") set({ token: ZERO_ADDRESS, symbol: "ETH", decimals: 18 });
    else if (asset === "USDC") set({ token: DROPS_USDC, symbol: "USDC", decimals: 6 });
    else if (/^0x[0-9a-fA-F]{40}$/.test(customToken.trim())) {
      void tokenMeta(customToken.trim()).then((m) => alive && set({ token: customToken.trim() as `0x${string}`, ...m }));
    }
    return () => {
      alive = false;
    };
  }, [asset, customToken]);

  const preview = useMemo(
    () => prepareDrop(form, { now, appTicketSigner: appSigner, creator: address }),
    [form, appSigner, address, now]
  );

  const steps: Step[] = usesTasks ? ["preset", "reward", "rules", "tasks", "review"] : ["preset", "reward", "rules", "review"];
  const idx = steps.indexOf(step);
  const go = (delta: number) => {
    setError("");
    setStep(steps[Math.max(0, Math.min(steps.length - 1, idx + delta))]!);
  };

  const pickPreset = (id: PresetId) => {
    const next = defaultForm(id);
    setForm((f) => ({ ...next, token: f.token, symbol: f.symbol, decimals: f.decimals, amountPerClaim: f.amountPerClaim, message: f.message, senderLabel: f.senderLabel }));
    setStep("reward");
  };

  const toggleAccess = (a: Access) => {
    const has = form.access.includes(a);
    let next = has ? form.access.filter((x) => x !== a) : [...form.access, a];
    // Codes replace a shared link; holders/allowlist are one option in the form.
    if (a === "codes" && !has) next = next.filter((x) => x !== "link");
    if (a === "link" && !has) next = next.filter((x) => x !== "codes");
    if (a === "holders" && !has) next = next.filter((x) => x !== "allowlist");
    if (a === "allowlist" && !has) next = next.filter((x) => x !== "holders");
    set({ access: next });
  };

  const create = async () => {
    setError("");
    if (!DROPS_CONTRACT) return setError("Drops aren't live on this deployment yet.");
    if (!preview.ok) return setError(preview.error);
    const { params, linkKey, codeKeys, allowlist } = preview.prepared;

    let definition: unknown = null;
    try {
      if (usesTasks) definition = await draftsToDefinition(drafts);
    } catch (e) {
      return setError(e instanceof Error ? e.message : "Check your tasks.");
    }

    try {
      setBusy("Preparing…");
      const pub = dropsClient();
      const calls: ContractCall[] = [];
      if (params.token === ZERO_ADDRESS) {
        calls.push(encodeContractCall(DROPS_CONTRACT, BASE_DROPS_ABI, "createDrop", [params], params.budget));
      } else {
        const allowance = (await pub.readContract({
          address: params.token,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address as `0x${string}`, DROPS_CONTRACT],
        })) as bigint;
        // Approve exactly this drop's budget — never an unlimited allowance.
        if (allowance < params.budget) calls.push(encodeContractCall(params.token, ERC20_ABI, "approve", [DROPS_CONTRACT, params.budget]));
        calls.push(encodeContractCall(DROPS_CONTRACT, BASE_DROPS_ABI, "createDrop", [params]));
      }
      const fromBlock = await pub.getBlockNumber();

      setBusy("Confirm in your wallet…");
      const hash = await sendAppTransactions(connType ?? "injected", address, calls, { targetChainId: DROPS_CHAIN_ID });

      setBusy("Waiting for confirmation…");
      let id: bigint | null = null;
      try {
        const receipt = await pub.waitForTransactionReceipt({ hash: hash as `0x${string}`, timeout: 120_000 });
        const logs = parseEventLogs({ abi: BASE_DROPS_ABI, logs: receipt.logs, eventName: "DropCreated" });
        const mine = logs.find((l) => l.address.toLowerCase() === DROPS_CONTRACT.toLowerCase());
        if (mine) id = mine.args.dropId as bigint;
      } catch {
        /* a calls-bundle id instead of a tx hash: scan events below */
      }
      if (id === null) {
        const logs = await pub.getContractEvents({
          address: DROPS_CONTRACT,
          abi: BASE_DROPS_ABI,
          eventName: "DropCreated",
          args: { creator: address as `0x${string}` },
          fromBlock: fromBlock > BigInt(50) ? fromBlock - BigInt(50) : BigInt(0),
        });
        const last = logs[logs.length - 1];
        if (last) id = last.args.dropId as bigint;
      }
      if (id === null) throw new Error("Your drop was funded but its id couldn't be read yet. It will show in My drops in a minute.");

      // Keep the secrets in this browser (and the private vault when it's on).
      const idStr = id.toString();
      saveDrop(address, { id: idStr, createdAt: Date.now(), linkKey: linkKey ?? undefined, codeKeys: codeKeys.length ? codeKeys : undefined, title: form.message.slice(0, 60) });
      try {
        const slot = `base_campaign_links_v1_${address.toLowerCase()}`;
        const prev = JSON.parse(localStorage.getItem(slot) ?? "[]") as Array<{ id: string }>;
        const entries = [
          ...(linkKey ? [{ id: `drop:${idStr}`, secret: linkKey.slice(2), createdAt: Date.now(), asset: form.symbol, slots: params.maxClaimsTotal }] : []),
          ...codeKeys.map((k, i) => ({ id: `drop:${idStr}:c${i + 1}`, secret: k.slice(2), createdAt: Date.now(), asset: form.symbol, slots: 1 })),
        ];
        localStorage.setItem(slot, JSON.stringify([...entries, ...prev.filter((p) => !entries.some((e) => e.id === p.id))].slice(0, 200)));
        syncVaultInBackground(address);
      } catch {
        /* private mode */
      }

      const warnings: string[] = [];
      if (definition || allowlist.length) {
        setBusy("Sign in to save the rules…");
        try {
          await ensureSignedIn(address, connType);
          if (definition) await dropsApi.saveDefinition(idStr, address, definition);
          if (allowlist.length) await dropsApi.saveAllowlist(idStr, address, allowlist);
        } catch (e) {
          updateSavedDrop(address, idStr, { pendingDefinition: definition ?? undefined, pendingAllowlist: allowlist.length ? allowlist : undefined });
          warnings.push(
            `Your drop is live, but its ${definition ? "tasks" : "list"} weren't saved (${e instanceof Error ? e.message : "error"}). Open My drops and tap “Save rules” to retry.`
          );
        }
      }

      const origin = window.location.origin;
      setDone({
        id: idStr,
        link: linkKey ? dropLink(origin, id, linkKey) : null,
        codeLinks: codeKeys.map((k) => codeLink(origin, id!, k, codeKeys)),
        publicLink: dropLink(origin, id),
        warnings,
      });
      setStep("done");
      onCreated?.(idStr);
    } catch (e) {
      setError(explainDropError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy("");
    }
  };

  const copy = async (text: string, tag: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(tag);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  // ───────────────────────────── screens ─────────────────────────────

  if (step === "done" && done) {
    const csv = ["code,link", ...done.codeLinks.map((l, i) => `${i + 1},${l}`)].join("\n");
    return (
      <Card>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="text-emerald-500" size={20} />
          <h3 className="text-lg font-black text-[var(--ink)]">Drop #{done.id} is live</h3>
        </div>
        {done.warnings.map((w) => (
          <Notice key={w} tone="warn">
            {w}
          </Notice>
        ))}
        {done.link && (
          <Field label="Share this link" hint="Anyone who opens it can claim, within your rules. Keep it private if the drop is private.">
            <div className="flex gap-2">
              <input readOnly className={inputCls} value={done.link} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className={btnSecondary} onClick={() => void copy(done.link!, "link")}>
                <Copy size={14} /> {copied === "link" ? "Copied" : "Copy"}
              </button>
            </div>
          </Field>
        )}
        {done.codeLinks.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-[var(--ink)]">{done.codeLinks.length} gift-card links (each works once)</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnSecondary} onClick={() => void copy(done.codeLinks.join("\n"), "codes")}>
                <Copy size={14} /> {copied === "codes" ? "Copied" : "Copy all"}
              </button>
              <a className={btnSecondary} href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download={`drop-${done.id}-codes.csv`}>
                <Download size={14} /> Download CSV
              </a>
            </div>
          </div>
        )}
        {!done.link && done.codeLinks.length === 0 && (
          <Field label="Share this page">
            <div className="flex gap-2">
              <input readOnly className={inputCls} value={done.publicLink} />
              <button type="button" className={btnSecondary} onClick={() => void copy(done.publicLink, "pub")}>
                <Copy size={14} /> {copied === "pub" ? "Copied" : "Copy"}
              </button>
            </div>
          </Field>
        )}
        <Notice>
          Links are saved in this browser{" "}
          {"and backed up to your private backup if it's on (My Cards → Recovery & backup)."} If you lose them, you can make a new link from My drops.
        </Notice>
        <button type="button" className={btnSecondary} onClick={() => { setDone(null); setStep("preset"); setForm(defaultForm("group")); setDrafts([]); }}>
          Create another
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-black text-[var(--ink)]">New drop</h3>
        {step !== "preset" && (
          <Pill tone="brand">
            Step {idx + 1} of {steps.length}
          </Pill>
        )}
      </div>

      {!DROPS_CONTRACT && <Notice tone="warn">Drops aren&apos;t live on this deployment yet. You can explore the options; creating is turned off.</Notice>}

      {step === "preset" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pickPreset(p.id)}
              className="text-left rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/60 p-4 hover:border-[var(--brand-text)] transition cursor-pointer min-h-[44px]"
            >
              <span className="block text-sm font-black text-[var(--ink)]">{p.title}</span>
              <span className="block text-xs text-[var(--ink-muted)] mt-1">{p.note}</span>
            </button>
          ))}
        </div>
      )}

      {step === "reward" && (
        <div className="space-y-3">
          <Field label="What are you giving?">
            <div className="flex flex-wrap gap-2">
              {(["ETH", "USDC", "TOKEN"] as const).map((a) => (
                <button key={a} type="button" onClick={() => setAsset(a)} className={asset === a ? btnPrimary : btnSecondary}>
                  {a === "TOKEN" ? "Other token" : a}
                </button>
              ))}
            </div>
          </Field>
          {asset === "TOKEN" && (
            <Field label="Token address" hint={form.token !== ZERO_ADDRESS && asset === "TOKEN" ? `${form.symbol} · ${form.decimals} decimals` : "Any ERC-20 on Base, incl. tokenized stocks"}>
              <input className={inputCls} value={customToken} onChange={(e) => setCustomToken(e.target.value)} placeholder="0x…" />
            </Field>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Each claim gets (${form.symbol})`}>
              <input className={inputCls} inputMode="decimal" value={form.amountPerClaim} onChange={(e) => set({ amountPerClaim: e.target.value })} placeholder="0.001" />
            </Field>
            {form.access.includes("codes") ? (
              <Field label="Number of gift cards">
                <input className={inputCls} inputMode="numeric" value={String(form.codeCount)} onChange={(e) => set({ codeCount: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
              </Field>
            ) : (
              <Field label="Total claims" hint="0 = until the budget runs out">
                <input className={inputCls} inputMode="numeric" value={String(form.totalClaims)} onChange={(e) => set({ totalClaims: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
              </Field>
            )}
          </div>
          {form.totalClaims === 0 && !form.access.includes("codes") && (
            <Field label={`Total budget (${form.symbol})`}>
              <input className={inputCls} inputMode="decimal" value={form.budget} onChange={(e) => set({ budget: e.target.value })} />
            </Field>
          )}
          <Field label="Message (optional)">
            <input className={inputCls} maxLength={280} value={form.message} onChange={(e) => set({ message: e.target.value })} placeholder="gm! thanks for being early" />
          </Field>
          <Field label="Your name (optional)" hint="Shown next to your wallet address.">
            <input className={inputCls} maxLength={40} value={form.senderLabel} onChange={(e) => set({ senderLabel: e.target.value })} />
          </Field>
        </div>
      )}

      {step === "rules" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-black text-[var(--ink)]">Who can claim</p>
            {(Object.keys(ACCESS_LABEL) as Access[]).map((a) => (
              <Toggle key={a} checked={form.access.includes(a)} onChange={() => toggleAccess(a)} label={ACCESS_LABEL[a].title} hint={ACCESS_LABEL[a].note} />
            ))}
            {(form.access.includes("holders") || form.access.includes("allowlist")) && (
              <div className="space-y-2 rounded-2xl border border-[var(--border-subtle)] p-3">
                {form.access.includes("holders") && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Must hold token (address)">
                      <input
                        className={inputCls}
                        value={form.holderToken}
                        onChange={(e) => {
                          const v = e.target.value;
                          set({ holderToken: v });
                          if (/^0x[0-9a-fA-F]{40}$/.test(v.trim())) void tokenMeta(v.trim()).then((m) => set({ holderDecimals: m.decimals }));
                        }}
                        placeholder="0x…"
                      />
                    </Field>
                    <Field label="At least">
                      <input className={inputCls} inputMode="decimal" value={form.holderMin} onChange={(e) => set({ holderMin: e.target.value })} />
                    </Field>
                  </div>
                )}
                <Field label={form.access.includes("holders") ? "…or wallets on this list (optional)" : "Wallets (paste addresses)"}>
                  <textarea className={`${inputCls} min-h-[80px] py-2`} value={form.allowlist} onChange={(e) => set({ allowlist: e.target.value })} placeholder="0x…, 0x…" />
                </Field>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-black text-[var(--ink)]">How often</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Claims per wallet" hint="0 = no limit">
                <input className={inputCls} inputMode="numeric" value={String(form.maxClaimsPerWallet)} onChange={(e) => set({ maxClaimsPerWallet: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
              </Field>
              <Field label="Hours between a wallet's claims" hint="24 = once a day">
                <input className={inputCls} inputMode="numeric" value={String(form.cooldownHours)} onChange={(e) => set({ cooldownHours: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
              </Field>
              <Field label="Max claims per day (all wallets)" hint="0 = no daily cap">
                <input className={inputCls} inputMode="numeric" value={String(form.perDayCap)} onChange={(e) => set({ perDayCap: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
              </Field>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-black text-[var(--ink)]">When</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Opens in (hours)" hint="0 = right away">
                <input className={inputCls} inputMode="numeric" value={String(form.unlockInHours)} onChange={(e) => set({ unlockInHours: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
              </Field>
              <Field label="Ends after (days)" hint="After this, what's left comes back to you">
                <input className={inputCls} inputMode="numeric" value={String(form.expiresInDays)} onChange={(e) => set({ expiresInDays: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
              </Field>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-black text-[var(--ink)]">Safety</p>
            <Toggle checked={form.committed} onChange={(v) => set({ committed: v })} label="Lock it until it ends" hint="You can't cancel, pause or change tasks before the end date. Claimers can trust the funds stay." />
            <Field label="Backup wallet (optional)" hint="If you lose this wallet, the backup can take over the drop 30 days after it ends and get back what's left.">
              <input className={inputCls} value={form.recovery} onChange={(e) => set({ recovery: e.target.value })} placeholder="0x…" />
            </Field>
          </div>
        </div>
      )}

      {step === "tasks" && (
        <div className="space-y-3">
          {!appSigner && <Notice tone="warn">Task checks aren&apos;t set up on this deployment yet.</Notice>}
          <TaskBuilder catalog={catalog} drafts={drafts} onChange={setDrafts} daily={daily} />
        </div>
      )}

      {step === "review" && (
        <div className="space-y-2 text-sm text-[var(--ink)]">
          {preview.ok ? (
            <>
              <p>
                <strong>
                  {fromUnits(preview.prepared.params.budget, form.decimals)} {form.symbol}
                </strong>{" "}
                in escrow · <strong>{form.amountPerClaim} {form.symbol}</strong> per claim
                {preview.prepared.params.maxClaimsTotal ? ` · ${preview.prepared.params.maxClaimsTotal} claims` : " · until the budget runs out"}
              </p>
              <p className="text-[var(--ink-muted)]">
                {form.access.map((a) => ACCESS_LABEL[a].title).join(" + ")}
                {form.maxClaimsPerWallet ? ` · ${form.maxClaimsPerWallet} per wallet` : ""}
                {form.cooldownHours ? ` · every ${form.cooldownHours}h` : ""}
                {form.perDayCap ? ` · ${form.perDayCap}/day max` : ""} · ends in {form.expiresInDays} days
                {form.committed ? " · locked" : ""}
              </p>
              {usesTasks && <p className="text-[var(--ink-muted)]">{drafts.length} task{drafts.length === 1 ? "" : "s"}</p>}
              {preview.prepared.codeKeys.length > 0 && (
                <p className="text-[var(--ink-muted)]">
                  {preview.prepared.codeKeys.length} codes (first: {privateKeyToAccount(preview.prepared.codeKeys[0]!).address.slice(0, 8)}…)
                </p>
              )}
              {form.token !== ZERO_ADDRESS && toUnits(form.amountPerClaim, form.decimals) !== null && (
                <Notice>Your wallet will approve exactly {fromUnits(preview.prepared.params.budget, form.decimals)} {form.symbol}, then fund the drop.</Notice>
              )}
            </>
          ) : (
            <Notice tone="error">{preview.error}</Notice>
          )}
        </div>
      )}

      {error && <Notice tone="error">{error}</Notice>}

      {step !== "preset" && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" className={btnSecondary} onClick={() => (idx <= 1 ? setStep("preset") : go(-1))} disabled={Boolean(busy)}>
            <ChevronLeft size={16} /> Back
          </button>
          {step === "review" ? (
            <button type="button" className={btnPrimary} onClick={() => void create()} disabled={Boolean(busy) || !preview.ok || !DROPS_CONTRACT}>
              {busy || "Create drop"}
            </button>
          ) : (
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                if (step === "reward" && !toUnits(form.amountPerClaim, form.decimals)) return setError("Enter how much each claim gets.");
                if (step === "rules" && form.access.length === 0) return setError("Choose who can claim.");
                go(1);
              }}
            >
              Next <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
