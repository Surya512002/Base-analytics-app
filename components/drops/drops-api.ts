/**
 * Browser calls for Drops: the /api/drops endpoints, wallet sign-in when they need it, and
 * onchain reads of a drop. Kept out of components so the UI stays readable.
 */
import { parseAbi, type Hex } from "viem";
import { createDropsPublicClient } from "@/lib/drops/network";
import { fetchSiweSession, signInWithSiwe } from "@/lib/auth/siwe-client";
import type { ConnectionType } from "@/lib/types/wallet";
import { BASE_DROPS_ABI } from "@/lib/drops/abi";
import { DROPS_CONTRACT } from "@/lib/drops/client";

export type ConnType = ConnectionType | null;

/** Make sure this wallet has a sign-in session (one free signature). */
export async function ensureSignedIn(address: string, connType: ConnType): Promise<void> {
  const s = await fetchSiweSession();
  if (s.authenticated && s.address?.toLowerCase() === address.toLowerCase()) return;
  const res = await signInWithSiwe(address, connType);
  if (!res.ok) throw new Error(res.error || "Sign-in was cancelled");
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", credentials: "include", ...init });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; requiresAuth?: boolean };
  if (!res.ok) {
    const err = new Error(data.error || "Something went wrong. Try again.") as Error & { status?: number; requiresAuth?: boolean };
    err.status = res.status;
    err.requiresAuth = data.requiresAuth;
    throw err;
  }
  return data;
}

const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export interface CatalogEntry {
  type: string;
  label: string;
  trust: string;
  needsSubmission: boolean;
}

export const dropsApi = {
  catalog: () => call<{ tasks: CatalogEntry[]; ticketSigner: string | null }>("/api/drops/catalog"),
  definition: (id: string) => call<{ definition: PublicDefinition | null }>(`/api/drops/${id}`),
  saveDefinition: (id: string, creator: string, definition: unknown) =>
    call<{ definition: PublicDefinition }>(`/api/drops/${id}`, { ...json({ creator, definition }), method: "PUT" }),
  saveAllowlist: (id: string, creator: string, addresses: string[]) =>
    call<{ count: number }>(`/api/drops/${id}/allowlist`, { ...json({ creator, addresses }), method: "PUT" }),
  allowlistProof: (id: string, wallet: string) => call<{ proof: Hex[] | null }>(`/api/drops/${id}/allowlist?wallet=${wallet}`),
  progress: (id: string, wallet: string) => call<Progress>(`/api/drops/${id}/progress?wallet=${wallet}`),
  checkTask: (id: string, wallet: string, taskId: string, submission?: unknown) =>
    call<{ result: TaskResultView }>(`/api/drops/${id}/tasks`, json({ wallet, taskId, submission })),
  ticket: (id: string, wallet: string, proof?: { linkSig?: Hex; code?: string; codeProof?: Hex[]; codeSig?: Hex }) =>
    call<{ ticket: { amount: string; deadline: number; ticket: Hex; claimIndex: number } }>(`/api/drops/${id}/ticket`, json({ wallet, proof })),
  /** After a claim confirms: makes the wallet's random-split share permanent. */
  claimed: (id: string, wallet: string) => call<{ settled: boolean }>(`/api/drops/${id}/claimed`, json({ wallet })),
  /** Plan or change tasks day by day (unlocked drops). */
  updateTasks: (id: string, creator: string, change: { add?: unknown[]; remove?: string[] }) =>
    call<{ definition: PublicDefinition }>(`/api/drops/${id}`, { ...json({ creator, ...change }), method: "PATCH" }),
  listing: (id: string) => call<{ listing: ListingView | null }>(`/api/drops/${id}/listing`),
  saveListing: (id: string, creator: string, listing: { title: string; blurb: string; category: ListingCategory } | null) =>
    call<{ listing: ListingView | null }>(`/api/drops/${id}/listing`, { ...json({ creator, listing }), method: "PUT" }),
  feed: (before?: string) => call<{ items: FeedItemView[]; next: string | null }>(`/api/drops/feed${before ? `?before=${before}` : ""}`),
  raffle: (id: string, wallet?: string | null) => call<RaffleView>(`/api/drops/${id}/raffle${wallet ? `?wallet=${wallet}` : ""}`),
  enterRaffle: (id: string, wallet: string) => call<{ entrants: number }>(`/api/drops/${id}/raffle`, json({ action: "enter", wallet })),
  drawRaffle: (id: string) => call<{ result: RaffleView["result"] }>(`/api/drops/${id}/raffle`, json({ action: "draw" })),
  reviews: (id: string, creator: string) => call<{ items: ReviewItemView[] }>(`/api/drops/${id}/reviews?creator=${creator}`),
  decideReview: (id: string, creator: string, wallet: string, taskId: string, approve: boolean, note?: string) =>
    call<{ ok: true }>(`/api/drops/${id}/reviews`, json({ creator, wallet, taskId, approve, note })),
  liveCode: (id: string, creator: string, taskId: string) =>
    call<{ code: string; expiresIn: number }>(`/api/drops/${id}/live-code?creator=${creator}&taskId=${taskId}`),
};

export type AccountProvider = "x" | "discord" | "telegram";

export interface LinkedAccountView {
  provider: AccountProvider;
  username: string;
  verifiedType?: string;
  followers?: number;
  linkedAt: number;
  snapshotAt: number;
}

export interface AccountsInfo {
  available: Record<AccountProvider, boolean>;
  bots: { discordInviteUrl: string | null; telegramBotUsername: string | null; telegramReady: boolean };
  accounts: LinkedAccountView[];
}

export const accountsApi = {
  info: (wallet?: string | null) => call<AccountsInfo>(`/api/accounts${wallet ? `?wallet=${wallet}` : ""}`),
  start: (provider: AccountProvider, wallet: string, returnTo: string) =>
    call<{ url: string }>(`/api/accounts/${provider}/start`, json({ wallet, returnTo })),
  linkTelegram: (wallet: string, auth: Record<string, unknown>) => call<{ username: string }>(`/api/accounts/telegram`, json({ wallet, auth })),
  unlink: (provider: AccountProvider, wallet: string) => call<{ ok: true }>(`/api/accounts/${provider}?wallet=${wallet}`, { method: "DELETE" }),
};

export interface RaffleView {
  winners: number;
  drawAt: number;
  commit?: string;
  entrants: number;
  entered: boolean;
  result: null | { winners: string[]; entrants: number; seed: string; blockNumber: string; blockHash: string; drawnAt: number; won: boolean };
}

export interface ReviewItemView {
  wallet: string;
  taskId: string;
  content: string;
  at: number;
  decided: boolean;
}

export type ListingCategory = "quest" | "daily" | "holders" | "gift" | "airdrop";
export interface ListingView {
  title: string;
  blurb: string;
  category: ListingCategory;
  listedAt: number;
}
export interface FeedItemView {
  id: string;
  listing: ListingView;
  creator: string;
  token: string;
  amountPerClaim: string;
  maxAmountPerClaim: string;
  budget: string;
  maxClaimsTotal: number;
  claimedCount: number;
  unlockAt: number;
  expiresAt: number;
  daily: boolean;
  split: boolean;
  gated: "tasks" | "holders" | "list";
  taskCount: number;
  taskTypes: string[];
  state: "live" | "soon" | "ended" | "closed" | "paused" | "empty";
}

export interface PublicTask {
  id: string;
  type: string;
  title: string;
  required: boolean;
  points: number;
  group?: string;
  repeat: boolean;
  /** Day window (1 = first 24h after the drop opens); absent = every day. */
  days?: { from: number; to: number };
  /** Whether the task counts today. */
  activeNow?: boolean;
  trust?: string;
  needsSubmission: boolean;
  config: Record<string, unknown>;
}

export interface PublicDefinition {
  version: 1;
  /** 1-based day of the drop right now. */
  day?: number;
  start?: number;
  minPoints?: number;
  tiers?: Array<{ minPoints: number; amount: string }>;
  rewards?: { mode: "fixed" | "random" | "split"; min?: string; max?: string; streak?: { bonusBps: number; maxDays: number; windowHours: number } };
  raffle?: { winners: number; drawAt: number; commit?: string };
  tasks: PublicTask[];
}

export interface TaskResultView {
  status: "passed" | "failed" | "unavailable" | "pending";
  message: string;
  at: number;
}

export interface Progress {
  claimIndex: number;
  blocker: string;
  evaluation: { eligible: boolean; points: number; missing: string[]; amount: string };
  results: Record<string, TaskResultView>;
  extras: Record<string, Record<string, string>>;
  streak?: { next: number; multiplierBps: number };
  day?: number;
  noTaskToday?: boolean;
}

// ───────────────────────────── onchain ─────────────────────────────

export interface DropView {
  id: bigint;
  creator: `0x${string}`;
  token: `0x${string}`;
  amountPerClaim: bigint;
  maxAmountPerClaim: bigint;
  budget: bigint;
  maxClaimsTotal: number;
  claimedCount: number;
  maxClaimsPerWallet: number;
  cooldown: number;
  periodSecs: number;
  maxClaimsPerPeriod: number;
  createdAt: number;
  unlockAt: number;
  expiresAt: number;
  linkSigner: `0x${string}`;
  ticketSigner: `0x${string}`;
  gate: `0x${string}`;
  recovery: `0x${string}`;
  pendingCreator: `0x${string}`;
  allowlistRoot: Hex;
  codesRoot: Hex;
  committed: boolean;
  paused: boolean;
  closed: boolean;
  message: string;
  senderLabel: string;
}

const ZERO = /^0x0+$/;
export const isSet = (v: string) => !ZERO.test(v);

export function dropsClient() {
  return createDropsPublicClient();
}

export async function readDropView(id: bigint): Promise<DropView | null> {
  if (!DROPS_CONTRACT) return null;
  const [d, message, senderLabel] = (await dropsClient().readContract({
    address: DROPS_CONTRACT,
    abi: BASE_DROPS_ABI,
    functionName: "getDrop",
    args: [id],
  })) as unknown as [Omit<DropView, "id" | "message" | "senderLabel">, string, string];
  if (!isSet(d.creator)) return null;
  return {
    ...d,
    id,
    amountPerClaim: BigInt(d.amountPerClaim),
    maxAmountPerClaim: BigInt(d.maxAmountPerClaim),
    budget: BigInt(d.budget),
    maxClaimsTotal: Number(d.maxClaimsTotal),
    claimedCount: Number(d.claimedCount),
    maxClaimsPerWallet: Number(d.maxClaimsPerWallet),
    cooldown: Number(d.cooldown),
    periodSecs: Number(d.periodSecs),
    maxClaimsPerPeriod: Number(d.maxClaimsPerPeriod),
    createdAt: Number(d.createdAt),
    unlockAt: Number(d.unlockAt),
    expiresAt: Number(d.expiresAt),
    message,
    senderLabel,
  };
}

export async function readWalletStatus(id: bigint, wallet: `0x${string}`): Promise<{ blocker: string; nextClaimAt: number; claims: number }> {
  if (!DROPS_CONTRACT) return { blocker: "Drops aren't live yet", nextClaimAt: 0, claims: 0 };
  const c = dropsClient();
  const [blocker, next, state] = await Promise.all([
    c.readContract({ address: DROPS_CONTRACT, abi: BASE_DROPS_ABI, functionName: "claimBlocker", args: [id, wallet] }),
    c.readContract({ address: DROPS_CONTRACT, abi: BASE_DROPS_ABI, functionName: "nextClaimAt", args: [id, wallet] }),
    c.readContract({ address: DROPS_CONTRACT, abi: BASE_DROPS_ABI, functionName: "walletState", args: [id, wallet] }),
  ]);
  return { blocker: String(blocker), nextClaimAt: Number(next), claims: Number((state as readonly [number, bigint])[0]) };
}

const ERC20_META = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)"]);

/** Symbol + decimals for a token (ETH for the zero address). */
export async function tokenMeta(token: string): Promise<{ symbol: string; decimals: number }> {
  if (!isSet(token)) return { symbol: "ETH", decimals: 18 };
  const c = dropsClient();
  const [symbol, decimals] = await Promise.all([
    c.readContract({ address: token as `0x${string}`, abi: ERC20_META, functionName: "symbol" }).catch(() => "TOKEN"),
    c.readContract({ address: token as `0x${string}`, abi: ERC20_META, functionName: "decimals" }).catch(() => 18),
  ]);
  return { symbol: String(symbol).slice(0, 16), decimals: Number(decimals) };
}

// ───────────────────────────── my drops (this browser) ─────────────────────────────

export interface SavedDrop {
  id: string;
  createdAt: number;
  /** Link key for link drops (also backed up to the private vault when it's on). */
  linkKey?: Hex;
  /** Gift-card code keys. */
  codeKeys?: Hex[];
  title?: string;
  /** Tasks / allowlist that failed to upload at creation; My drops retries them. */
  pendingDefinition?: unknown;
  pendingAllowlist?: string[];
}

const savedKey = (addr: string) => `base_drops_mine_v1_${addr.toLowerCase()}`;

export function loadSavedDrops(addr: string): SavedDrop[] {
  try {
    const raw = localStorage.getItem(savedKey(addr));
    const parsed = raw ? (JSON.parse(raw) as SavedDrop[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDrop(addr: string, entry: SavedDrop): void {
  try {
    const rest = loadSavedDrops(addr).filter((d) => d.id !== entry.id);
    localStorage.setItem(savedKey(addr), JSON.stringify([entry, ...rest].slice(0, 200)));
  } catch {
    /* private mode: links are still shown on screen */
  }
}

export function updateSavedDrop(addr: string, id: string, patch: Partial<SavedDrop>): void {
  const cur = loadSavedDrops(addr).find((d) => d.id === id);
  saveDrop(addr, { id, createdAt: Date.now(), ...cur, ...patch });
}
