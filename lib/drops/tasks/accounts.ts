/**
 * Tasks that use linked accounts (see lib/accounts): X verification / reach, Discord server
 * membership and roles, Telegram group/channel membership.
 *
 * The claimer links each account once (OAuth / Telegram login). One platform account can back
 * only one wallet across the whole app, so these double as sybil resistance.
 */
import { z } from "zod";
import { getLinked, label, type Provider } from "@/lib/accounts/store";
import { discordMember, telegramMember } from "@/lib/accounts/providers";
import type { TaskContext, TaskResult, TaskType } from "../types";

const notLinked = (p: Provider): TaskResult => ({ status: "failed", message: `Link your ${label(p)} account to check this.` });

// ───────────────────────────── X account ─────────────────────────────

const xAccountConfig = z.object({
  /** Which verification counts: any paid/org check, or a specific one. "none" = no requirement. */
  verified: z.enum(["none", "any", "blue", "business"]).default("none"),
  minFollowers: z.number().int().min(0).max(100_000_000).optional(),
  minAccountAgeDays: z.number().int().min(0).max(7300).optional(),
  /** Profile facts older than this need a re-link (followers/verification can change). */
  maxSnapshotAgeDays: z.number().int().min(1).max(365).default(30),
});

export const xAccountTask: TaskType<z.infer<typeof xAccountConfig>> = {
  type: "x_account",
  label: "X account (blue check, followers, age)",
  trust: "account",
  needsSubmission: false,
  recheckAtClaim: true,
  configSchema: xAccountConfig,
  async verify(config, ctx) {
    const acct = await getLinked(ctx.kv, "x", ctx.claimer);
    if (!acct) return notLinked("x");
    if (ctx.now - acct.snapshotAt > config.maxSnapshotAgeDays * 86_400) {
      return { status: "failed", message: "Your X details are out of date. Link X again to refresh them." };
    }
    const vt = (acct.verifiedType ?? "none").toLowerCase();
    if (config.verified === "any" && !["blue", "business", "government"].includes(vt)) {
      return { status: "failed", message: "This drop needs a verified X account (blue, business or government check)." };
    }
    if (config.verified === "blue" && vt !== "blue") return { status: "failed", message: "This drop needs an X blue check." };
    if (config.verified === "business" && vt !== "business") return { status: "failed", message: "This drop needs an X business (gold) check." };
    if (config.minFollowers !== undefined && (acct.followers ?? 0) < config.minFollowers) {
      return { status: "failed", message: `This drop needs at least ${config.minFollowers} X followers.` };
    }
    if (config.minAccountAgeDays !== undefined) {
      if (!acct.accountCreatedAt) return { status: "unavailable", message: "Couldn't read your X account age. Link X again." };
      const days = Math.floor((ctx.now - acct.accountCreatedAt) / 86_400);
      if (days < config.minAccountAgeDays) return { status: "failed", message: `Your X account is ${days} days old; this drop needs ${config.minAccountAgeDays}.` };
    }
    return { status: "passed", message: `X @${acct.username} meets the requirements.` };
  },
};

// ───────────────────────────── Discord ─────────────────────────────

const snowflake = z.string().regex(/^\d{15,22}$/, "Must be a Discord id (numbers)");
const discordConfig = z.object({
  guildId: snowflake,
  serverName: z.string().max(60).optional(),
  /** Member must have at least one of these roles (optional). */
  roleIds: z.array(snowflake).max(10).optional(),
  minDaysInServer: z.number().int().min(0).max(3650).optional(),
});

export const discordMemberTask: TaskType<z.infer<typeof discordConfig>> = {
  type: "discord_member",
  label: "Join a Discord server",
  trust: "account",
  needsSubmission: false,
  recheckAtClaim: true,
  configSchema: discordConfig,
  async verify(config, ctx) {
    const acct = await getLinked(ctx.kv, "discord", ctx.claimer);
    if (!acct) return notLinked("discord");
    const m = await discordMember(config.guildId, acct.id, ctx.fetch);
    return memberResult(m, ctx, {
      join: `Join ${config.serverName ?? "the Discord server"}, then check again.`,
      roleIds: config.roleIds,
      minDays: config.minDaysInServer,
    });
  },
};

// ───────────────────────────── Telegram ─────────────────────────────

const telegramConfig = z.object({
  /** @publicchannel or a numeric chat id like -1001234567890. */
  chatId: z.string().regex(/^(@[A-Za-z0-9_]{5,32}|-?\d{5,20})$/, "Use @channel or a numeric chat id"),
  title: z.string().max(60).optional(),
});

export const telegramMemberTask: TaskType<z.infer<typeof telegramConfig>> = {
  type: "telegram_member",
  label: "Join a Telegram group or channel",
  trust: "account",
  needsSubmission: false,
  recheckAtClaim: true,
  configSchema: telegramConfig,
  async verify(config, ctx) {
    const acct = await getLinked(ctx.kv, "telegram", ctx.claimer);
    if (!acct) return notLinked("telegram");
    const m = await telegramMember(config.chatId, acct.id, ctx.fetch);
    return memberResult(m, ctx, { join: `Join ${config.title ?? config.chatId} on Telegram, then check again.` });
  },
};

function memberResult(
  m: Awaited<ReturnType<typeof discordMember>>,
  ctx: TaskContext,
  opts: { join: string; roleIds?: string[]; minDays?: number }
): TaskResult {
  if (m.status === "bot_missing") return { status: "unavailable", message: "The creator hasn't added the app's bot yet, so membership can't be checked." };
  if (m.status === "error") return { status: "unavailable", message: "Couldn't check membership right now. Try again." };
  if (m.status === "not_member") return { status: "failed", message: opts.join };
  if (opts.roleIds?.length && !opts.roleIds.some((r) => m.roles.includes(r))) {
    return { status: "failed", message: "You're in, but you don't have the required role yet." };
  }
  if (opts.minDays && m.joinedAt && ctx.now - m.joinedAt < opts.minDays * 86_400) {
    return { status: "failed", message: `You need to have been a member for ${opts.minDays} days.` };
  }
  return { status: "passed", message: "Member confirmed." };
}
