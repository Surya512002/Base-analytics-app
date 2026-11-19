/**
 * Linked social accounts (X, Discord, Telegram) for drop tasks.
 *
 * Security model
 *  - We store only public profile facts (id, username, X verification type, follower count,
 *    account age) and when we read them. OAuth access tokens are used once to read the profile
 *    and then revoked/discarded: never stored, never able to post or act for the user.
 *  - One platform account ↔ one wallet, across the whole app. Ten wallets can't share one X
 *    account. After unlinking, the account stays reserved for that wallet for 7 days so it
 *    can't be rotated between wallets to farm drops.
 *  - Linking needs a wallet sign-in (SIWE) for that wallet; the OAuth `state` is single-use,
 *    expires in 10 minutes and carries the wallet, so a callback can't be replayed or redirected
 *    to another wallet.
 */
import type { TaskKv } from "@/lib/drops/types";

export type Provider = "x" | "discord" | "telegram";
export const PROVIDERS: readonly Provider[] = ["x", "discord", "telegram"];

export interface LinkedAccount {
  provider: Provider;
  id: string;
  username: string;
  /** X only: "blue" | "business" | "government" | "none". */
  verifiedType?: string;
  followers?: number;
  /** Platform account creation time (unix seconds), when the platform tells us. */
  accountCreatedAt?: number;
  linkedAt: number;
  /** When the profile facts above were read. Tasks can require a recent snapshot. */
  snapshotAt: number;
}

const UNLINK_HOLD_SEC = 7 * 86_400;
const linkKey = (p: Provider, wallet: string) => `acct:link:${p}:${wallet.toLowerCase()}`;
const ownerKey = (p: Provider, id: string) => `acct:owner:${p}:${id}`;

export async function getLinked(kv: TaskKv, p: Provider, wallet: string): Promise<LinkedAccount | null> {
  const raw = await kv.get(linkKey(p, wallet));
  return raw ? (JSON.parse(raw) as LinkedAccount) : null;
}

export async function listLinked(kv: TaskKv, wallet: string): Promise<LinkedAccount[]> {
  const out: LinkedAccount[] = [];
  for (const p of PROVIDERS) {
    const a = await getLinked(kv, p, wallet);
    if (a) out.push(a);
  }
  return out;
}

export class LinkError extends Error {}

/**
 * Bind `account` to `wallet`. Fails if the account already belongs to another wallet (or is
 * still in its 7-day hold). Re-linking the same account refreshes its profile snapshot.
 */
export async function saveLink(kv: TaskKv, wallet: string, account: Omit<LinkedAccount, "linkedAt" | "snapshotAt">, now: number): Promise<LinkedAccount> {
  const w = wallet.toLowerCase();
  const owner = ownerKey(account.provider, account.id);
  await kv.setIfAbsent(owner, w);
  const current = await kv.get(owner);
  if (current && current !== w) {
    throw new LinkError(`This ${label(account.provider)} account is already linked to another wallet.`);
  }
  await kv.set(owner, w); // clear any unlink hold TTL: it's actively linked again
  const prev = await getLinked(kv, account.provider, w);
  if (prev && prev.id !== account.id) {
    // Switching accounts on this wallet: put the old one on hold for this wallet.
    await kv.set(ownerKey(account.provider, prev.id), w, UNLINK_HOLD_SEC);
  }
  const linked: LinkedAccount = { ...account, linkedAt: prev?.id === account.id ? prev.linkedAt : now, snapshotAt: now };
  await kv.set(linkKey(account.provider, w), JSON.stringify(linked));
  return linked;
}

/** Unlink; the account stays reserved for this wallet for 7 days. */
export async function unlink(kv: TaskKv & { del?: (k: string) => Promise<void> }, wallet: string, p: Provider): Promise<void> {
  const w = wallet.toLowerCase();
  const prev = await getLinked(kv, p, w);
  if (!prev) return;
  await kv.set(ownerKey(p, prev.id), w, UNLINK_HOLD_SEC);
  if (kv.del) await kv.del(linkKey(p, w));
  else await kv.set(linkKey(p, w), "", 1);
}

export function label(p: Provider): string {
  return p === "x" ? "X" : p === "discord" ? "Discord" : "Telegram";
}

// ───────────────────────────── OAuth state ─────────────────────────────

export interface OAuthState {
  wallet: string;
  provider: Provider;
  /** PKCE code verifier (X). */
  verifier?: string;
  /** Same-site path to return to (no host, no fragment). */
  returnTo: string;
}

const stateKey = (s: string) => `acct:state:${s}`;

export async function createState(kv: TaskKv, data: OAuthState): Promise<string> {
  const b = new Uint8Array(32);
  globalThis.crypto.getRandomValues(b);
  const state = Buffer.from(b).toString("base64url");
  await kv.set(stateKey(state), JSON.stringify(data), 600);
  return state;
}

/** Read and burn a state (single use). */
export async function consumeState(kv: TaskKv, state: string): Promise<OAuthState | null> {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(state)) return null;
  const raw = await kv.get(stateKey(state));
  if (!raw) return null;
  await kv.set(stateKey(state), "", 1);
  return JSON.parse(raw) as OAuthState;
}

/** Only same-site relative paths like "/drops/2000000001" are allowed as return targets. */
export function safeReturnTo(raw: unknown): string {
  const s = typeof raw === "string" ? raw : "";
  return /^\/(?!\/)[A-Za-z0-9/_\-.]{0,200}$/.test(s) ? s : "/drops";
}
