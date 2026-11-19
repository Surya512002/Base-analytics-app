/**
 * Community tasks: referrals (counted from onchain claims), IRL event codes (rotating every
 * 30 seconds), creator webhooks, and submissions the creator reviews by hand.
 */
import { createHmac, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { keccak256, pad, stringToBytes, toHex } from "viem";
import { z } from "zod";
import type { TaskContext, TaskType } from "../types";

// ───────────────────────────── referrals ─────────────────────────────

/** keccak256 of the DropClaimed event signature (topic0). */
export const DROP_CLAIMED_TOPIC = keccak256(stringToBytes("DropClaimed(uint256,address,address,uint256,uint32,uint32)"));

const referralConfig = z.object({ minFriends: z.number().int().min(1).max(1000) });

/** Distinct wallets that claimed this drop with `referrer` as their referrer (Etherscan v2 logs). */
export async function countReferrals(ctx: TaskContext, referrer: string): Promise<number | null> {
  if (!ctx.env.explorerKey) return null;
  const url = new URL("https://api.etherscan.io/v2/api");
  url.search = new URLSearchParams({
    chainid: String(ctx.chainId),
    module: "logs",
    action: "getLogs",
    address: ctx.dropsContract,
    fromBlock: "0",
    toBlock: "latest",
    topic0: DROP_CLAIMED_TOPIC,
    topic1: pad(toHex(ctx.dropId), { size: 32 }),
    topic3: pad(referrer.toLowerCase() as `0x${string}`, { size: 32 }),
    topic0_1_opr: "and",
    topic1_3_opr: "and",
    topic0_3_opr: "and",
    page: "1",
    offset: "1000",
    apikey: ctx.env.explorerKey,
  }).toString();
  const res = await ctx.fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = (await res.json()) as { message?: string; result?: unknown };
  if (!Array.isArray(data.result)) {
    if (String(data.message ?? "").toLowerCase().includes("no records")) return 0;
    throw new Error("explorer");
  }
  const claimers = new Set<string>();
  for (const log of data.result as Array<{ topics?: string[] }>) {
    const t = log.topics?.[2];
    if (t) claimers.add(`0x${t.slice(-40)}`.toLowerCase());
  }
  claimers.delete(referrer.toLowerCase());
  return claimers.size;
}

export const referralsTask: TaskType<z.infer<typeof referralConfig>> = {
  type: "referrals",
  label: "Invite friends who claim",
  trust: "onchain",
  needsSubmission: false,
  recheckAtClaim: false,
  configSchema: referralConfig,
  async verify(config, ctx) {
    try {
      const n = await countReferrals(ctx, ctx.claimer);
      if (n === null) return { status: "unavailable", message: "Referral counts aren't set up on this server yet." };
      return n >= config.minFriends
        ? { status: "passed", message: `${n} friend${n === 1 ? "" : "s"} claimed with your invite.`, evidence: { friends: n } }
        : { status: "failed", message: `${n} of ${config.minFriends} friends have claimed with your invite link so far.`, evidence: { friends: n } };
    } catch {
      return { status: "unavailable", message: "Couldn't count referrals right now. Try again." };
    }
  },
};

// ───────────────────────────── IRL event code (TOTP) ─────────────────────────────

const STEP_SEC = 30;

/** 6-digit code for a 30-second window (RFC 6238 style, HMAC-SHA256). */
export function liveCode(secretHex: string, unixSec: number, offsetSteps = 0): string {
  const counter = Math.floor(unixSec / STEP_SEC) + offsetSteps;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha256", Buffer.from(secretHex, "hex")).update(buf).digest();
  const off = h[h.length - 1]! & 0x0f;
  const bin = ((h[off]! & 0x7f) << 24) | (h[off + 1]! << 16) | (h[off + 2]! << 8) | h[off + 3]!;
  return String(bin % 1_000_000).padStart(6, "0");
}

export function liveCodeExpiresIn(unixSec: number): number {
  return STEP_SEC - (unixSec % STEP_SEC);
}

const liveStored = z.object({ secret: z.string().regex(/^[0-9a-f]{40}$/), place: z.string().max(80).optional() });

export const liveCodeTask: TaskType<z.infer<typeof liveStored>> = {
  type: "live_code",
  label: "Be there (event code)",
  trust: "answer",
  needsSubmission: true,
  recheckAtClaim: false,
  configSchema: liveStored,
  prepare(input) {
    const ok = liveStored.safeParse(input);
    if (ok.success) return ok.data;
    const place = (input as { place?: unknown } | undefined)?.place;
    return { secret: randomBytes(20).toString("hex"), place: typeof place === "string" ? place.slice(0, 80) : undefined };
  },
  publicConfig: (c) => ({ place: c.place }),
  async verify(config, ctx) {
    const code = String((ctx.submission as { code?: unknown } | undefined)?.code ?? "").replace(/\D/g, "");
    if (code.length !== 6) return { status: "failed", message: "Enter the 6-digit code shown at the event." };
    const key = `drops:attempts:live:${ctx.dropsContract.toLowerCase()}:${ctx.dropId}:${ctx.taskId}:${ctx.claimer.toLowerCase()}`;
    if ((await ctx.kv.incr(key, 600)) > 5) return { status: "failed", message: "Too many tries. Wait 10 minutes." };
    // Accept the current and the previous window (codes change every 30 seconds).
    const ok = [0, -1].some((o) => liveCode(config.secret, ctx.now, o) === code);
    return ok ? { status: "passed", message: "You were there." } : { status: "failed", message: "That code isn't current. Enter the code on screen now." };
  },
};

// ───────────────────────────── creator webhook ─────────────────────────────

const webhookConfig = z.object({
  url: z
    .string()
    .url()
    .max(300)
    .refine((u) => u.startsWith("https://"), "Must be an https:// URL"),
  /** Shared secret: requests carry X-Drops-Signature = hex(HMAC-SHA256(secret, body)). */
  secret: z.string().min(16).max(128),
  description: z.string().max(120).optional(),
});

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
}

/** Only public HTTPS hosts: no IP literals, no localhost, no private ranges (stops SSRF). */
export async function assertPublicHttpsUrl(raw: string, resolve = lookup): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== "https:") throw new Error("https only");
  if (u.username || u.password) throw new Error("no credentials in URL");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || !host.includes(".")) {
    throw new Error("host not allowed");
  }
  const addrs = await resolve(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => isPrivateAddress(a.address))) throw new Error("host not allowed");
  return u;
}

export const webhookTask: TaskType<z.infer<typeof webhookConfig>> = {
  type: "webhook",
  label: "Your own check (webhook)",
  trust: "verified",
  needsSubmission: false,
  recheckAtClaim: false,
  configSchema: webhookConfig,
  publicConfig: (c) => ({ description: c.description }),
  async verify(config, ctx) {
    let url: URL;
    try {
      url = await assertPublicHttpsUrl(config.url);
    } catch {
      return { status: "unavailable", message: "The creator's check isn't reachable." };
    }
    const body = JSON.stringify({ chainId: ctx.chainId, contract: ctx.dropsContract, dropId: ctx.dropId.toString(), wallet: ctx.claimer, taskId: ctx.taskId, at: ctx.now });
    const sig = createHmac("sha256", config.secret).update(body).digest("hex");
    try {
      const res = await ctx.fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-drops-signature": sig },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return { status: "unavailable", message: "The creator's check didn't answer. Try again later." };
      const text = (await res.text()).slice(0, 2000);
      const data = JSON.parse(text) as { ok?: unknown; message?: unknown };
      const message = typeof data.message === "string" ? data.message.slice(0, 160) : undefined;
      return data.ok === true
        ? { status: "passed", message: message ?? "Confirmed by the creator." }
        : { status: "failed", message: message ?? (config.description ? `Not yet: ${config.description}` : "Not confirmed yet.") };
    } catch {
      return { status: "unavailable", message: "The creator's check didn't answer. Try again later." };
    }
  },
};

// ───────────────────────────── creator review ─────────────────────────────

const reviewConfig = z.object({
  instructions: z.string().min(1).max(300),
  kind: z.enum(["url", "text"]).default("url"),
});

export const reviewKey = (ctx: Pick<TaskContext, "dropsContract" | "dropId">) =>
  `drops:reviews:${ctx.dropsContract.toLowerCase()}:${ctx.dropId}`;
export const decisionKey = (ctx: Pick<TaskContext, "dropsContract" | "dropId">, taskId: string, wallet: string) =>
  `drops:review-decision:${ctx.dropsContract.toLowerCase()}:${ctx.dropId}:${taskId}:${wallet.toLowerCase()}`;

export interface ReviewItem {
  wallet: string;
  taskId: string;
  content: string;
  at: number;
}

export const reviewTask: TaskType<z.infer<typeof reviewConfig>> = {
  type: "review",
  label: "Submit for the creator to review",
  trust: "account",
  needsSubmission: true,
  recheckAtClaim: false,
  configSchema: reviewConfig,
  async verify(config, ctx) {
    const decided = await ctx.kv.get(decisionKey(ctx, ctx.taskId, ctx.claimer));
    if (decided) {
      const d = JSON.parse(decided) as { approve: boolean; note?: string };
      if (d.approve) return { status: "passed", message: d.note ? `Approved: ${d.note}` : "Approved by the creator." };
      // Rejected: a new submission goes back in the queue.
      if (!(ctx.submission as { content?: unknown } | undefined)?.content) {
        return { status: "failed", message: d.note ? `Not approved: ${d.note}` : "Not approved. You can submit again." };
      }
    }
    const content = String((ctx.submission as { content?: unknown } | undefined)?.content ?? "").trim();
    if (!content) return { status: "failed", message: config.kind === "url" ? "Paste the link to your work." : "Write your answer." };
    if (content.length > 1000) return { status: "failed", message: "Too long (1000 characters max)." };
    if (config.kind === "url" && !/^https:\/\/\S+$/.test(content)) return { status: "failed", message: "Paste an https:// link." };

    const raw = await ctx.kv.get(reviewKey(ctx));
    const queue = raw ? (JSON.parse(raw) as ReviewItem[]) : [];
    const next = [{ wallet: ctx.claimer.toLowerCase(), taskId: ctx.taskId, content, at: ctx.now }, ...queue.filter((q) => !(q.wallet === ctx.claimer.toLowerCase() && q.taskId === ctx.taskId))].slice(0, 2000);
    await ctx.kv.set(reviewKey(ctx), JSON.stringify(next));
    if (decided) await ctx.kv.set(decisionKey(ctx, ctx.taskId, ctx.claimer), "", 1);
    return { status: "pending", message: "Sent. The creator will review it." };
  },
};
