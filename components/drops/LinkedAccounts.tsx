"use client";

import React, { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Link2, Unlink } from "lucide-react";
import { accountsApi, ensureSignedIn, type AccountProvider, type AccountsInfo, type ConnType } from "./drops-api";
import { Card, Notice, Pill, btnPrimary, btnSecondary } from "./ui";

const LABEL: Record<AccountProvider, string> = { x: "X", discord: "Discord", telegram: "Telegram" };
const RETURN_HASH_KEY = "drops_return_hash";
export const TG_AUTH_KEY = "drops_tg_auth";

const ERRORS: Record<string, string> = {
  expired: "That sign-in link expired. Try linking again.",
  cancelled: "Linking was cancelled.",
  already_linked: "That account is already linked to another wallet. Each account can back only one wallet.",
  failed: "Linking failed. Try again.",
  unknown_platform: "Unknown platform.",
};

/**
 * Before leaving for X / Discord / Telegram, keep the drop link's #fragment (it can hold the
 * link key) in this tab only, so it never travels to our server or the platform.
 */
export function rememberReturnHash(): void {
  try {
    if (window.location.hash) sessionStorage.setItem(RETURN_HASH_KEY, window.location.hash);
  } catch {
    /* private mode */
  }
}

/**
 * On return: pick up Telegram's #tgAuthResult (if any) and put the saved drop fragment back.
 * Call before reading the drop link from the URL.
 */
export function restoreAfterLinking(): void {
  try {
    const hash = window.location.hash;
    const m = hash.match(/tgAuthResult=([A-Za-z0-9_\-+/=]+)/);
    if (m) sessionStorage.setItem(TG_AUTH_KEY, m[1]!);
    const saved = sessionStorage.getItem(RETURN_HASH_KEY);
    if (saved && (!hash || m)) {
      sessionStorage.removeItem(RETURN_HASH_KEY);
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${saved}`);
    } else if (m) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  } catch {
    /* private mode */
  }
}

function decodeTgAuth(raw: string): Record<string, unknown> | null {
  try {
    const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(atob(b64)) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export default function LinkedAccounts({
  address,
  connType,
  providers = ["x", "discord", "telegram"],
  title = "Linked accounts",
}: {
  address: string | null;
  connType: ConnType;
  providers?: AccountProvider[];
  title?: string;
}) {
  const [info, setInfo] = useState<AccountsInfo | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const load = useCallback(async () => {
    try {
      setInfo(await accountsApi.info(address));
      setNeedsSignIn(false);
    } catch (e) {
      if ((e as { requiresAuth?: boolean }).requiresAuth) {
        setNeedsSignIn(true);
        setInfo(await accountsApi.info(null).catch(() => null));
      }
    }
  }, [address]);

  // Results from the platform redirect (?linked=x / ?link_error=…) and a pending Telegram login.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const linked = sp.get("linked");
    const err = sp.get("link_error");
    if (linked || err) {
      setMsg(linked ? { tone: "ok", text: `${LABEL[linked as AccountProvider] ?? "Account"} linked.` } : { tone: "error", text: ERRORS[err!] ?? ERRORS.failed! });
      sp.delete("linked");
      sp.delete("link_error");
      const q = sp.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${q ? `?${q}` : ""}${window.location.hash}`);
    }
    let tg: string | null = null;
    try {
      tg = sessionStorage.getItem(TG_AUTH_KEY);
    } catch {
      /* ignore */
    }
    if (tg && address) {
      void (async () => {
        try {
          sessionStorage.removeItem(TG_AUTH_KEY);
          const auth = decodeTgAuth(tg!);
          if (!auth) throw new Error("Telegram login couldn't be read. Try again.");
          await ensureSignedIn(address, connType);
          await accountsApi.linkTelegram(address, auth);
          setMsg({ tone: "ok", text: "Telegram linked." });
          await load();
        } catch (e) {
          setMsg({ tone: "error", text: e instanceof Error ? e.message : "Couldn't link Telegram." });
        }
      })();
    }
  }, [address, connType, load]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!address) return null;

  const link = async (p: AccountProvider) => {
    setMsg(null);
    setBusy(p);
    try {
      await ensureSignedIn(address, connType);
      const { url } = await accountsApi.start(p, address, window.location.pathname);
      rememberReturnHash();
      window.location.assign(url);
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Couldn't start linking." });
      setBusy("");
    }
  };

  const remove = async (p: AccountProvider) => {
    if (!window.confirm(`Unlink ${LABEL[p]}? It stays reserved for this wallet for 7 days.`)) return;
    setBusy(p);
    try {
      await accountsApi.unlink(p, address);
      await load();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : "Couldn't unlink." });
    } finally {
      setBusy("");
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-black text-[var(--ink)]">{title}</h3>
        <Pill>read-only</Pill>
      </div>
      <p className="text-xs text-[var(--ink-muted)]">
        We only read your public profile (and X verification) to check tasks. We never get permission to post, and we
        don&apos;t keep sign-in tokens. Each account can be linked to one wallet.
      </p>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {needsSignIn && (
        <button type="button" className={btnPrimary} onClick={() => void ensureSignedIn(address, connType).then(load).catch(() => undefined)}>
          Sign in to see linked accounts
        </button>
      )}
      <ul className="space-y-2">
        {providers.map((p) => {
          const acct = info?.accounts.find((a) => a.provider === p);
          const available = info?.available[p];
          return (
            <li key={p} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] px-3 py-2 min-h-[52px]">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--ink)]">{LABEL[p]}</p>
                {acct ? (
                  <p className="text-xs text-[var(--ink-muted)] flex items-center gap-1">
                    @{acct.username}
                    {p === "x" && acct.verifiedType && acct.verifiedType !== "none" && (
                      <span className="inline-flex items-center gap-0.5 text-[var(--brand-text)]">
                        <BadgeCheck size={12} /> {acct.verifiedType}
                      </span>
                    )}
                    {p === "x" && acct.followers !== undefined ? ` · ${acct.followers} followers` : ""}
                  </p>
                ) : (
                  <p className="text-xs text-[var(--ink-muted)]">{available === false ? "Not available yet" : "Not linked"}</p>
                )}
              </div>
              {acct ? (
                <div className="flex gap-2">
                  {p !== "telegram" && (
                    <button type="button" className={btnSecondary} disabled={Boolean(busy) || !available} onClick={() => void link(p)} title="Refresh details">
                      Refresh
                    </button>
                  )}
                  <button type="button" className={btnSecondary} disabled={Boolean(busy)} onClick={() => void remove(p)} aria-label={`Unlink ${LABEL[p]}`}>
                    <Unlink size={14} />
                  </button>
                </div>
              ) : (
                <button type="button" className={btnPrimary} disabled={Boolean(busy) || !available} onClick={() => void link(p)}>
                  <Link2 size={14} /> {busy === p ? "Opening…" : `Link ${LABEL[p]}`}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
