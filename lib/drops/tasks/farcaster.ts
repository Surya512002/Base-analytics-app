/**
 * Farcaster tasks via Neynar (server side, NEYNAR_API_KEY).
 *
 * The claimer's Farcaster account is found from their wallet (custody or verified address).
 * One Farcaster account can back only one wallet per drop, so ten wallets can't share one account.
 */
import { z } from "zod";
import type { TaskContext, TaskResult, TaskType } from "../types";

const NEYNAR = "https://api.neynar.com/v2/farcaster";

interface FarcasterUser {
  fid: number;
  username?: string;
  score?: number;
  power_badge?: boolean;
}

type Lookup = { ok: true; user: FarcasterUser } | { ok: false; result: TaskResult };

async function neynar(ctx: TaskContext, path: string, params: Record<string, string>): Promise<Record<string, unknown> | null> {
  if (!ctx.env.neynarKey) return null;
  const url = new URL(`${NEYNAR}/${path}`);
  url.search = new URLSearchParams(params).toString();
  const res = await ctx.fetch(url, {
    headers: { accept: "application/json", "x-api-key": ctx.env.neynarKey },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Neynar ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

const unavailable: TaskResult = { status: "unavailable", message: "Couldn't reach Farcaster right now. Try again." };

/** The claimer's Farcaster account, bound to this wallet for this drop. */
export async function farcasterUserFor(ctx: TaskContext): Promise<Lookup> {
  if (!ctx.env.neynarKey) {
    return { ok: false, result: { status: "unavailable", message: "Farcaster checks aren't set up on this server yet." } };
  }
  let data: Record<string, unknown> | null;
  try {
    data = await neynar(ctx, "user/bulk-by-address", { addresses: ctx.claimer });
  } catch {
    return { ok: false, result: unavailable };
  }
  const users = (data?.[ctx.claimer.toLowerCase()] ?? []) as Array<Record<string, unknown>>;
  const u = users[0];
  if (!u || typeof u.fid !== "number") {
    return {
      ok: false,
      result: { status: "failed", message: "No Farcaster account is connected to this wallet. Verify this wallet in your Farcaster app." },
    };
  }
  const exp = u.experimental as { neynar_user_score?: number } | undefined;
  const user: FarcasterUser = {
    fid: u.fid,
    username: typeof u.username === "string" ? u.username : undefined,
    score: typeof u.score === "number" ? u.score : exp?.neynar_user_score,
    power_badge: u.power_badge === true,
  };

  // One account ↔ one wallet per drop.
  const key = `drops:bind:fc:${ctx.dropsContract.toLowerCase()}:${ctx.dropId}:${user.fid}`;
  await ctx.kv.setIfAbsent(key, ctx.claimer.toLowerCase());
  const bound = await ctx.kv.get(key);
  if (bound && bound !== ctx.claimer.toLowerCase()) {
    return {
      ok: false,
      result: { status: "failed", message: "This Farcaster account was already used for this drop by another wallet." },
    };
  }
  return { ok: true, user };
}

// ───────────────────────────── account ─────────────────────────────

const accountConfig = z.object({
  minScore: z.number().min(0).max(1).optional(),
  requirePowerBadge: z.boolean().default(false),
});

export const farcasterAccountTask: TaskType<z.infer<typeof accountConfig>> = {
  type: "farcaster_account",
  label: "Have a Farcaster account",
  trust: "verified",
  needsSubmission: false,
  recheckAtClaim: false,
  configSchema: accountConfig,
  async verify(config, ctx) {
    const found = await farcasterUserFor(ctx);
    if (!found.ok) return found.result;
    const { user } = found;
    if (config.minScore !== undefined && (user.score ?? 0) < config.minScore) {
      return { status: "failed", message: "Your Farcaster account needs more activity for this drop." };
    }
    if (config.requirePowerBadge && !user.power_badge) {
      return { status: "failed", message: "This drop needs a Farcaster power badge." };
    }
    return { status: "passed", message: `Farcaster account @${user.username ?? user.fid} found.`, evidence: { fid: user.fid } };
  },
};

// ───────────────────────────── follow ─────────────────────────────

const followConfig = z.object({ targetFid: z.number().int().positive(), targetName: z.string().max(40).optional() });

export const farcasterFollowTask: TaskType<z.infer<typeof followConfig>> = {
  type: "farcaster_follow",
  label: "Follow on Farcaster",
  trust: "verified",
  needsSubmission: false,
  recheckAtClaim: true,
  configSchema: followConfig,
  async verify(config, ctx) {
    const found = await farcasterUserFor(ctx);
    if (!found.ok) return found.result;
    try {
      const data = await neynar(ctx, "user/bulk", { fids: String(config.targetFid), viewer_fid: String(found.user.fid) });
      const target = (data?.users as Array<{ viewer_context?: { following?: boolean } }> | undefined)?.[0];
      const ok = target?.viewer_context?.following === true;
      return ok
        ? { status: "passed", message: "Following." }
        : { status: "failed", message: `Follow ${config.targetName ? `@${config.targetName}` : "the account"} on Farcaster, then check again.` };
    } catch {
      return unavailable;
    }
  },
};

// ───────────────────────────── like / recast ─────────────────────────────

const reactionConfig = z.object({
  castHash: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  kind: z.enum(["like", "recast", "both"]),
});

export const farcasterReactionTask: TaskType<z.infer<typeof reactionConfig>> = {
  type: "farcaster_reaction",
  label: "Like or recast a cast",
  trust: "verified",
  needsSubmission: false,
  recheckAtClaim: false,
  configSchema: reactionConfig,
  async verify(config, ctx) {
    const found = await farcasterUserFor(ctx);
    if (!found.ok) return found.result;
    try {
      const data = await neynar(ctx, "cast", { identifier: config.castHash, type: "hash", viewer_fid: String(found.user.fid) });
      const vc = (data?.cast as { viewer_context?: { liked?: boolean; recasted?: boolean } } | undefined)?.viewer_context;
      const liked = vc?.liked === true;
      const recasted = vc?.recasted === true;
      const ok = config.kind === "like" ? liked : config.kind === "recast" ? recasted : liked && recasted;
      return ok
        ? { status: "passed", message: "Done." }
        : { status: "failed", message: config.kind === "both" ? "Like and recast the cast, then check again." : `${config.kind === "like" ? "Like" : "Recast"} the cast, then check again.` };
    } catch {
      return unavailable;
    }
  },
};

// ───────────────────────────── channel ─────────────────────────────

const channelConfig = z.object({ channelId: z.string().regex(/^[a-z0-9-]{1,32}$/) });

export const farcasterChannelTask: TaskType<z.infer<typeof channelConfig>> = {
  type: "farcaster_channel",
  label: "Follow a Farcaster channel",
  trust: "verified",
  needsSubmission: false,
  recheckAtClaim: true,
  configSchema: channelConfig,
  async verify(config, ctx) {
    const found = await farcasterUserFor(ctx);
    if (!found.ok) return found.result;
    try {
      const data = await neynar(ctx, "channel", { id: config.channelId, viewer_fid: String(found.user.fid) });
      const following = (data?.channel as { viewer_context?: { following?: boolean } } | undefined)?.viewer_context?.following;
      return following === true
        ? { status: "passed", message: `Following /${config.channelId}.` }
        : { status: "failed", message: `Follow the /${config.channelId} channel, then check again.` };
    } catch {
      return unavailable;
    }
  },
};
