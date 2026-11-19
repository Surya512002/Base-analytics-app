"use client";

import React from "react";
import {
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  Coins,
  FileCode2,
  GraduationCap,
  Hourglass,
  KeyRound,
  ShoppingCart,
  UserPlus,
  Wallet,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import type { TaskDraft } from "./TaskBuilder";

/** Brand glyphs (simple marks, drawn in currentColor). */
export function XLogo({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="currentColor">
      <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z" />
    </svg>
  );
}
export function FarcasterLogo({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="currentColor">
      <path d="M5 3h14v18h-2.6v-8.2a4.4 4.4 0 0 0-8.8 0V21H5V3Zm-2 3.2h2v14.8H3V6.2Zm16 0h2v14.8h-2V6.2Z" />
    </svg>
  );
}
export function DiscordLogo({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="currentColor">
      <path d="M19.6 5.3A17 17 0 0 0 15.4 4l-.5 1a15.7 15.7 0 0 0-5.8 0l-.5-1a17 17 0 0 0-4.2 1.3C1.7 9.3 1 13.2 1.3 17.1a17 17 0 0 0 5.2 2.6l1.1-1.8a11 11 0 0 1-1.7-.8l.4-.3a12.2 12.2 0 0 0 11.4 0l.4.3c-.5.3-1.1.6-1.7.8l1.1 1.8a17 17 0 0 0 5.2-2.6c.4-4.6-.7-8.4-3.1-11.8ZM8.5 14.7c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Zm7 0c-1 0-1.9-1-1.9-2.1s.8-2.1 1.9-2.1 1.9 1 1.9 2.1-.8 2.1-1.9 2.1Z" />
    </svg>
  );
}
export function TelegramLogo({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="currentColor">
      <path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.6 13.2 1.9 11.7c-1-.3-1-1 .2-1.5L20.5 3c.9-.3 1.6.2 1.4 1.3Z" />
    </svg>
  );
}

export type TaskCategory = "social" | "onchain" | "learn" | "community";

export const TASK_CATEGORIES: Array<{ id: TaskCategory; label: string; note: string }> = [
  { id: "social", label: "Social", note: "X, Farcaster, Discord, Telegram" },
  { id: "onchain", label: "Onchain & trading", note: "Hold, buy, wallet history" },
  { id: "learn", label: "Learn & events", note: "Quizzes, codes, IRL" },
  { id: "community", label: "Growth & custom", note: "Referrals, reviews, your API" },
];

interface TaskMeta {
  category: TaskCategory;
  icon: LucideIcon | React.FC<{ size?: number }>;
  /** Tailwind classes for the icon badge. */
  tint: string;
  /** Short line for the library tile. */
  blurb: string;
  /** Fields that must be filled before the drop can be created. */
  required: Array<{ key: string; label: string; check?: (v: string) => boolean }>;
}

const isAddr = (v: string) => /^0x[0-9a-fA-F]{40}$/.test(v.trim());
const isNum = (v: string) => /^\d+(\.\d+)?$/.test(v.trim()) && Number(v) > 0;

export const TASK_META: Record<string, TaskMeta> = {
  x_post: { category: "social", icon: XLogo, tint: "bg-black text-white dark:bg-white dark:text-black", blurb: "Post with a wallet-unique code", required: [] },
  x_account: { category: "social", icon: XLogo, tint: "bg-black text-white dark:bg-white dark:text-black", blurb: "Blue check, followers, account age", required: [] },
  farcaster_account: { category: "social", icon: FarcasterLogo, tint: "bg-violet-600 text-white", blurb: "Has a Farcaster account / score", required: [] },
  farcaster_follow: { category: "social", icon: FarcasterLogo, tint: "bg-violet-600 text-white", blurb: "Follows your account", required: [{ key: "fid", label: "Account FID", check: (v) => /^\d+$/.test(v.trim()) }] },
  farcaster_reaction: { category: "social", icon: FarcasterLogo, tint: "bg-violet-600 text-white", blurb: "Likes or recasts your cast", required: [{ key: "cast", label: "Cast hash", check: (v) => /^0x[0-9a-fA-F]{8,64}$/.test(v.trim()) }] },
  farcaster_channel: { category: "social", icon: FarcasterLogo, tint: "bg-violet-600 text-white", blurb: "Follows your channel", required: [{ key: "channel", label: "Channel id" }] },
  discord_member: { category: "social", icon: DiscordLogo, tint: "bg-[#5865F2] text-white", blurb: "Is in your server (with a role)", required: [{ key: "guild", label: "Server id", check: (v) => /^\d{15,22}$/.test(v.trim()) }] },
  telegram_member: { category: "social", icon: TelegramLogo, tint: "bg-[#229ED9] text-white", blurb: "Is in your group or channel", required: [{ key: "chat", label: "Group or channel" }] },
  token_balance: { category: "onchain", icon: Wallet, tint: "bg-emerald-500 text-white", blurb: "Holds a token, NFT or stock", required: [{ key: "token", label: "Token address", check: isAddr }, { key: "min", label: "Minimum amount", check: isNum }] },
  token_bought: { category: "onchain", icon: ShoppingCart, tint: "bg-emerald-600 text-white", blurb: "Bought your token or memecoin", required: [{ key: "token", label: "Token address", check: isAddr }, { key: "min", label: "Minimum buy", check: isNum }] },
  held_since: { category: "onchain", icon: Hourglass, tint: "bg-teal-600 text-white", blurb: "Held without selling for N days", required: [{ key: "token", label: "Token address", check: isAddr }, { key: "min", label: "Minimum amount", check: isNum }] },
  contract_read: { category: "onchain", icon: FileCode2, tint: "bg-slate-600 text-white", blurb: "Any onchain condition (staked, minted…)", required: [{ key: "contract", label: "Contract", check: isAddr }, { key: "signature", label: "Function" }] },
  wallet_age: { category: "onchain", icon: CalendarClock, tint: "bg-sky-600 text-white", blurb: "Old enough wallet, real activity", required: [] },
  basename: { category: "onchain", icon: BadgeCheck, tint: "bg-[var(--brand)] text-white", blurb: "Owns a name.base.eth", required: [] },
  quiz: { category: "learn", icon: GraduationCap, tint: "bg-amber-500 text-white", blurb: "Answers your questions", required: [{ key: "lines", label: "Questions", check: (v) => v.split("\n").some((l) => l.split("|").filter((x) => x.trim()).length >= 2) }] },
  secret_word: { category: "learn", icon: KeyRound, tint: "bg-orange-500 text-white", blurb: "Knows the secret word", required: [{ key: "answers", label: "Accepted answers" }] },
  live_code: { category: "learn", icon: Coins, tint: "bg-rose-500 text-white", blurb: "Was there: rotating event code", required: [] },
  referrals: { category: "community", icon: UserPlus, tint: "bg-pink-500 text-white", blurb: "Invites friends who also claim", required: [] },
  review: { category: "community", icon: ClipboardCheck, tint: "bg-indigo-500 text-white", blurb: "Submits work you approve", required: [{ key: "instructions", label: "What to submit" }] },
  webhook: {
    category: "community",
    icon: Webhook,
    tint: "bg-zinc-700 text-white",
    blurb: "Your own server decides",
    required: [
      { key: "url", label: "URL", check: (v) => /^https:\/\//.test(v.trim()) },
      { key: "secret", label: "Shared secret (16+)", check: (v) => v.trim().length >= 16 },
    ],
  },
};

export function TaskIcon({ type, size = 18 }: { type: string; size?: number }) {
  const meta = TASK_META[type];
  const Icon = meta?.icon ?? ClipboardCheck;
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-xl ${meta?.tint ?? "bg-[var(--surface-2)] text-[var(--ink)]"}`} style={{ width: size + 18, height: size + 18 }}>
      <Icon size={size} />
    </span>
  );
}

/** The fields a draft still needs before the drop can be created (empty when ready). */
export function missingFields(d: TaskDraft): string[] {
  const meta = TASK_META[d.type];
  const out: string[] = [];
  if (!d.title.trim()) out.push("Title");
  for (const r of meta?.required ?? []) {
    const v = d.fields[r.key] ?? "";
    if (!v.trim() || (r.check && !r.check(v))) out.push(r.label);
  }
  return out;
}

/** One-tap starter sets. Each entry is [type, title]. */
export const TASK_TEMPLATES: Array<{ id: string; title: string; note: string; tasks: Array<[string, string]> }> = [
  { id: "social", title: "Social boost", note: "Post on X + follow on Farcaster", tasks: [["x_post", "Post about us on X"], ["farcaster_follow", "Follow us on Farcaster"]] },
  { id: "community", title: "Join the community", note: "Discord + Telegram", tasks: [["discord_member", "Join our Discord"], ["telegram_member", "Join our Telegram"]] },
  { id: "trader", title: "Memecoin trader", note: "Buy the token and hold it 3 days", tasks: [["token_bought", "Buy the token"], ["held_since", "Hold it for 3 days"]] },
  { id: "sybil", title: "Real humans only", note: "Wallet age + Basename + verified X", tasks: [["wallet_age", "Wallet is 30+ days old"], ["basename", "Own a Basename"], ["x_account", "Verified X account"]] },
  { id: "event", title: "IRL event", note: "Live code + secret word", tasks: [["live_code", "Check in at the event"], ["secret_word", "Say the secret word"]] },
  { id: "learn", title: "Learn & earn", note: "Quiz + submit a post for review", tasks: [["quiz", "Pass the quiz"], ["review", "Share what you learned"]] },
];
