"use client";

import React, { useCallback, useEffect, useState } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { Copy, ExternalLink, PackageOpen, RefreshCcw, Settings2 } from "lucide-react";
import TokenLogo from "@/components/ui/TokenLogo";
import { ERC20_ABI } from "@/lib/constants/contracts";
import { encodeContractCall, type ContractCall } from "@/lib/utils/tx";
import { sendAppTransactions } from "@/lib/utils/send-app-tx";
import { BASE_DROPS_ABI } from "@/lib/drops/abi";
import { DROPS_CHAIN_ID, DROPS_CONTRACT, codeLink, dropLink, explainDropError, fromUnits, toUnits } from "@/lib/drops/client";
import { syncVaultInBackground } from "@/lib/voucher/vault-client";
import {
  dropsApi,
  dropsClient,
  ensureSignedIn,
  isSet,
  loadSavedDrops,
  readDropView,
  tokenMeta,
  updateSavedDrop,
  type ConnType,
  type DropView,
  type SavedDrop,
} from "./drops-api";
import CreatorTools from "./CreatorTools";
import { Card, Field, Notice, Pill, btnDanger, btnPrimary, btnSecondary, inputCls, untilText, useNow } from "./ui";

/** First block to scan for DropCreated events (set at deploy). Without it only this browser's drops show. */
const DEPLOY_BLOCK = (() => {
  const n = Number(process.env.NEXT_PUBLIC_DROPS_DEPLOY_BLOCK || 0);
  return Number.isFinite(n) && n > 0 ? BigInt(Math.floor(n)) : null;
})();

interface Row {
  drop: DropView;
  meta: { symbol: string; decimals: number };
  saved?: SavedDrop;
}

export default function MyDrops({ address, connType }: { address: string; connType: ConnType }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const now = useNow();

  const load = useCallback(async () => {
    if (!DROPS_CONTRACT) return setRows([]);
    const saved = loadSavedDrops(address);
    const ids = new Set(saved.map((s) => s.id));
    if (DEPLOY_BLOCK) {
      try {
        const logs = await dropsClient().getContractEvents({
          address: DROPS_CONTRACT,
          abi: BASE_DROPS_ABI,
          eventName: "DropCreated",
          args: { creator: address as `0x${string}` },
          fromBlock: DEPLOY_BLOCK,
        });
        for (const l of logs) ids.add(String(l.args.dropId));
      } catch {
        /* RPC range limits: fall back to this browser's list */
      }
    }
    const out: Row[] = [];
    for (const id of [...ids].sort((a, b) => (BigInt(b) > BigInt(a) ? 1 : -1))) {
      const drop = await readDropView(BigInt(id)).catch(() => null);
      if (!drop || drop.creator.toLowerCase() !== address.toLowerCase()) continue;
      out.push({ drop, meta: await tokenMeta(drop.token), saved: saved.find((s) => s.id === id) });
    }
    setRows(out);
  }, [address]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async (label: string, calls: ContractCall[]) => {
    setError("");
    setNote("");
    try {
      setBusy(label);
      const hash = await sendAppTransactions(connType ?? "injected", address, calls, { targetChainId: DROPS_CHAIN_ID });
      try {
        await dropsClient().waitForTransactionReceipt({ hash: hash as `0x${string}`, timeout: 120_000 });
      } catch {
        /* bundle id */
      }
      await load();
      return true;
    } catch (e) {
      setError(explainDropError(e instanceof Error ? e.message : String(e)));
      return false;
    } finally {
      setBusy("");
    }
  };

  const c = (fn: string, args: unknown[], value?: bigint) => encodeContractCall(DROPS_CONTRACT as `0x${string}`, BASE_DROPS_ABI, fn, args, value);

  if (!DROPS_CONTRACT) return <Card><Notice tone="warn">Drops aren&apos;t live on this deployment yet.</Notice></Card>;
  if (rows === null) return <Card><div className="h-20 rounded-2xl bg-[var(--surface-2)] animate-pulse" aria-busy="true" /></Card>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-black text-[var(--ink)]">My drops</h3>
        <button type="button" className={btnSecondary} onClick={() => void load()}>
          <RefreshCcw size={14} /> Refresh
        </button>
      </div>
      {!DEPLOY_BLOCK && <Notice>Showing drops created in this browser.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {note && <Notice tone="ok">{note}</Notice>}
      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Drops", rows.length],
            ["Live", rows.filter(({ drop }) => !drop.closed && !drop.paused && now < drop.expiresAt).length],
            ["Claims", rows.reduce((n, { drop }) => n + drop.claimedCount, 0)],
          ].map(([label, n]) => (
            <div key={label} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-3 text-center">
              <p className="text-2xl font-black text-[var(--ink)]">{n}</p>
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--ink-muted)]">{label}</p>
            </div>
          ))}
        </div>
      )}
      {rows.length === 0 && (
        <Card className="text-center">
          <PackageOpen size={28} className="mx-auto text-[var(--ink-muted)]" />
          <p className="text-sm text-[var(--ink-muted)]">No drops yet. Create one and it shows up here with its links, codes and tools.</p>
        </Card>
      )}

      {rows.map(({ drop, meta, saved }) => {
        const id = drop.id.toString();
        const fmt = (v: bigint) => `${fromUnits(v, meta.decimals)} ${meta.symbol}`;
        const ended = now >= drop.expiresAt;
        const state = drop.closed ? "Closed" : ended ? "Ended" : drop.paused ? "Paused" : drop.unlockAt > now ? "Not open yet" : "Live";
        const link = saved?.linkKey ? dropLink(window.location.origin, drop.id, saved.linkKey) : dropLink(window.location.origin, drop.id);
        const isOpen = open === id;
        const v = (k: string) => inputs[`${id}:${k}`] ?? "";
        const setV = (k: string, val: string) => setInputs((s) => ({ ...s, [`${id}:${k}`]: val }));

        return (
          <Card key={id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <TokenLogo address={drop.token} symbol={meta.symbol} size={40} shape="rounded-xl" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-black text-[var(--ink)]">
                  Drop #{id} {saved?.title ? `· ${saved.title}` : ""}
                </p>
                <p className="text-xs font-semibold text-[var(--ink-muted)]">{fmt(drop.amountPerClaim)} per claim</p>
                <div className="flex flex-wrap gap-1">
                  <Pill tone={state === "Live" ? "ok" : state === "Closed" ? "muted" : "warn"}>{state}</Pill>
                  <Pill>{drop.claimedCount} claimed</Pill>
                  <Pill>{fmt(drop.budget)} left</Pill>
                  {!ended && <Pill>ends in {untilText(drop.expiresAt, now)}</Pill>}
                  {drop.committed && <Pill tone="brand">Locked</Pill>}
                  {isSet(drop.recovery) && <Pill tone="brand">Backup wallet set</Pill>}
                </div>
                {drop.maxClaimsTotal > 0 && (
                  <div className="h-1.5 max-w-xs overflow-hidden rounded-full bg-[var(--surface-2)]" aria-label={`${drop.claimedCount} of ${drop.maxClaimsTotal} claimed`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-[var(--brand)] to-emerald-400" style={{ width: `${Math.min(100, (drop.claimedCount / drop.maxClaimsTotal) * 100)}%` }} />
                  </div>
                )}
              </div>
              </div>
              <div className="flex gap-2">
                <a className={btnSecondary} href={`/drops/${id}`} aria-label={`Open drop ${id} page`}>
                  <ExternalLink size={14} />
                </a>
                <button type="button" className={isOpen ? btnPrimary : btnSecondary} onClick={() => setOpen(isOpen ? null : id)}>
                  <Settings2 size={14} /> {isOpen ? "Done" : "Manage"}
                </button>
              </div>
            </div>

            {(saved?.pendingDefinition || saved?.pendingAllowlist) && (
              <div className="space-y-2">
                <Notice tone="warn">This drop&apos;s {saved.pendingDefinition ? "tasks" : "list"} weren&apos;t saved yet, so claims can&apos;t pass.</Notice>
                <button
                  type="button"
                  className={btnPrimary}
                  disabled={Boolean(busy)}
                  onClick={async () => {
                    setError("");
                    try {
                      setBusy("Saving rules…");
                      await ensureSignedIn(address, connType);
                      if (saved.pendingDefinition) await dropsApi.saveDefinition(id, address, saved.pendingDefinition);
                      if (saved.pendingAllowlist) await dropsApi.saveAllowlist(id, address, saved.pendingAllowlist);
                      updateSavedDrop(address, id, { pendingDefinition: undefined, pendingAllowlist: undefined });
                      setNote("Rules saved.");
                      await load();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Couldn't save");
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  Save rules
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <input readOnly className={inputCls} value={link} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className={btnSecondary} onClick={() => void navigator.clipboard.writeText(link).then(() => setNote("Link copied."))}>
                <Copy size={14} />
              </button>
            </div>
            {isSet(drop.linkSigner) && !saved?.linkKey && (
              <Notice tone="warn">This browser doesn&apos;t have this drop&apos;s private link. Unlock your private backup in My Cards, or make a new link below.</Notice>
            )}
            {saved?.codeKeys && saved.codeKeys.length > 0 && (
              <button
                type="button"
                className={btnSecondary}
                onClick={() =>
                  void navigator.clipboard
                    .writeText(saved.codeKeys!.map((k) => codeLink(window.location.origin, drop.id, k, saved.codeKeys!)).join("\n"))
                    .then(() => setNote(`${saved.codeKeys!.length} gift-card links copied.`))
                }
              >
                <Copy size={14} /> Copy {saved.codeKeys.length} gift-card links
              </button>
            )}

            {isOpen && !drop.closed && (
              <div className="space-y-4 border-t border-[var(--border-subtle)] pt-4">
                <div className="flex flex-wrap gap-2">
                  {!drop.committed && (
                    <button type="button" className={btnSecondary} disabled={Boolean(busy)} onClick={() => void send(drop.paused ? "Resuming…" : "Pausing…", [c("setPaused", [drop.id, !drop.paused])])}>
                      {drop.paused ? "Resume claims" : "Pause claims"}
                    </button>
                  )}
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={Boolean(busy)}
                    onClick={() => void send("Extending…", [c("extendExpiry", [drop.id, BigInt(Math.max(drop.expiresAt, now) + 7 * 86_400)])])}
                  >
                    Add 7 days
                  </button>
                  {isSet(drop.linkSigner) && (
                    <button
                      type="button"
                      className={btnSecondary}
                      disabled={Boolean(busy)}
                      onClick={async () => {
                        const key = generatePrivateKey();
                        const ok = await send("Making a new link…", [c("rotateLinkSigner", [drop.id, privateKeyToAccount(key).address])]);
                        if (!ok) return;
                        updateSavedDrop(address, id, { linkKey: key });
                        try {
                          const slot = `base_campaign_links_v1_${address.toLowerCase()}`;
                          const prev = JSON.parse(localStorage.getItem(slot) ?? "[]") as Array<{ id: string }>;
                          const entry = { id: `drop:${id}`, secret: key.slice(2), createdAt: Date.now(), asset: meta.symbol, slots: drop.maxClaimsTotal };
                          localStorage.setItem(slot, JSON.stringify([entry, ...prev.filter((p) => p.id !== entry.id)]));
                          syncVaultInBackground(address);
                        } catch {
                          /* private mode */
                        }
                        setNote("New link ready. The old link no longer works.");
                        await load();
                      }}
                    >
                      Make a new link
                    </button>
                  )}
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-end">
                  <Field label={`Add funds (${meta.symbol})`}>
                    <input className={inputCls} inputMode="decimal" value={v("topup")} onChange={(e) => setV("topup", e.target.value)} />
                  </Field>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={Boolean(busy)}
                    onClick={async () => {
                      const amt = toUnits(v("topup"), meta.decimals);
                      if (!amt) return setError("Enter an amount.");
                      const calls: ContractCall[] = [];
                      if (isSet(drop.token)) {
                        calls.push(encodeContractCall(drop.token, ERC20_ABI, "approve", [DROPS_CONTRACT, amt]));
                        calls.push(c("topUp", [drop.id, amt]));
                      } else calls.push(c("topUp", [drop.id, amt], amt));
                      if (await send("Adding funds…", calls)) setV("topup", "");
                    }}
                  >
                    Add
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-end">
                  <Field label="Backup wallet" hint="Can take over this drop 30 days after it ends if you lose this wallet.">
                    <input className={inputCls} value={v("recovery")} onChange={(e) => setV("recovery", e.target.value)} placeholder={isSet(drop.recovery) ? drop.recovery : "0x…"} />
                  </Field>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={Boolean(busy)}
                    onClick={() => {
                      const a = v("recovery").trim();
                      if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return setError("Enter a valid address.");
                      void send("Saving backup wallet…", [c("setRecovery", [drop.id, a])]);
                    }}
                  >
                    Save
                  </button>
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_auto] items-end">
                  <Field label="Move this drop to another wallet" hint="The new wallet must accept it from its own My drops.">
                    <input className={inputCls} value={v("transfer")} onChange={(e) => setV("transfer", e.target.value)} placeholder="0x…" />
                  </Field>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={Boolean(busy)}
                    onClick={() => {
                      const a = v("transfer").trim();
                      if (!/^0x[0-9a-fA-F]{40}$/.test(a)) return setError("Enter a valid address.");
                      void send("Starting transfer…", [c("transferCreator", [drop.id, a])]);
                    }}
                  >
                    Start
                  </button>
                </div>
                {isSet(drop.pendingCreator) && <Notice>Waiting for {drop.pendingCreator.slice(0, 8)}… to accept.</Notice>}

                <div className="space-y-2">
                  <button
                    type="button"
                    className={btnDanger}
                    disabled={Boolean(busy) || (drop.committed && !ended)}
                    onClick={() => {
                      if (!window.confirm(`Close drop #${id} and get back ${fmt(drop.budget)}? Claims stop for good.`)) return;
                      void send("Closing…", [c("close", [drop.id])]);
                    }}
                  >
                    Close and get back {fmt(drop.budget)}
                  </button>
                  {drop.committed && !ended && <p className="text-xs text-[var(--ink-muted)]">Locked drops can be closed after they end.</p>}
                </div>
                {busy && <Notice>{busy}</Notice>}
                {isSet(drop.ticketSigner) && <CreatorTools dropId={id} address={address} connType={connType} />}
              </div>
            )}
          </Card>
        );
      })}

      <AcceptTransfer address={address} connType={connType} onDone={() => void load()} />
    </div>
  );
}

/** For the receiving wallet: accept a drop someone moved to you, or take over as backup wallet. */
function AcceptTransfer({ address, connType, onDone }: { address: string; connType: ConnType; onDone: () => void }) {
  const [id, setId] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: "acceptCreator" | "recoverCreator") => {
    if (!/^\d{10,20}$/.test(id.trim())) return setMsg("Enter the drop number.");
    setBusy(true);
    setMsg("");
    try {
      await sendAppTransactions(connType ?? "injected", address, [
        encodeContractCall(DROPS_CONTRACT as `0x${string}`, BASE_DROPS_ABI, fn, [BigInt(id.trim())]),
      ], { targetChainId: DROPS_CHAIN_ID });
      setMsg("Done. The drop is now yours.");
      onDone();
    } catch (e) {
      setMsg(explainDropError(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card>
      <p className="text-sm font-black text-[var(--ink)]">Receive a drop</p>
      <Field label="Drop number" hint="Accept a drop moved to this wallet, or take over one where this wallet is the backup (30 days after it ends).">
        <input className={inputCls} inputMode="numeric" value={id} onChange={(e) => setId(e.target.value)} placeholder="2000000001" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnSecondary} disabled={busy} onClick={() => void run("acceptCreator")}>
          Accept transfer
        </button>
        <button type="button" className={btnSecondary} disabled={busy} onClick={() => void run("recoverCreator")}>
          Take over as backup wallet
        </button>
      </div>
      {msg && <Notice>{msg}</Notice>}
    </Card>
  );
}
