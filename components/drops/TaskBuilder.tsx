"use client";

import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { btnSecondary, inputCls, Field, Toggle, Pill, TRUST_LABEL } from "./ui";
import { accountsApi, tokenMeta, type AccountsInfo, type CatalogEntry } from "./drops-api";
import { toUnits } from "@/lib/drops/client";

/**
 * Task list editor for quest drops. Each task type gets a small form; `draftsToDefinition`
 * turns the drafts into the definition the server stores (token amounts → base units).
 */

export interface TaskDraft {
  key: string;
  type: string;
  title: string;
  required: boolean;
  points: number;
  repeat: boolean;
  group: string;
  fields: Record<string, string>;
}

export const TYPE_HELP: Record<string, string> = {
  token_balance: "Wallet holds at least an amount of a token, NFT or stock.",
  token_bought: "Wallet bought a token on a DEX (net of sells) since the drop started.",
  held_since: "Wallet held a token for some days without selling or sending it.",
  contract_read: "Any onchain condition: a view function that takes the wallet address.",
  farcaster_account: "Wallet has a Farcaster account (optionally an activity score).",
  farcaster_follow: "Follows a Farcaster account.",
  farcaster_reaction: "Liked and/or recast a cast.",
  farcaster_channel: "Follows a Farcaster channel.",
  x_post: "Posts on X with a code unique to their wallet (free, no X login).",
  quiz: "Answers your questions (answers are stored hashed).",
  secret_word: "Enters a secret word, e.g. said at an event.",
  basename: "Owns a Basename (name.base.eth).",
  wallet_age: "Wallet is at least N days old (and optionally has N transactions).",
  referrals: "Invites N friends who also claim this drop (counted onchain).",
  live_code: "Enters the 6-digit code you show at your event; it changes every 30 seconds.",
  webhook: "Your own server says yes or no (signed request to your URL).",
  review: "Submits a link or text; you approve or reject it in My drops.",
  x_account: "Linked X account with a blue / business check, enough followers or account age.",
  discord_member: "Linked Discord account is in your server (optionally with a role). Add the app's bot to your server first.",
  telegram_member: "Linked Telegram account is in your group or channel. Add the app's bot (as admin for channels) first.",
};

let seq = 0;
export function newDraft(type: string, label: string): TaskDraft {
  seq += 1;
  return { key: `${type}-${Date.now()}-${seq}`, type, title: label, required: true, points: 0, repeat: false, group: "", fields: {} };
}

function F({ d, k, label, hint, placeholder, onChange }: { d: TaskDraft; k: string; label: string; hint?: string; placeholder?: string; onChange: (d: TaskDraft) => void }) {
  return (
    <Field label={label} hint={hint}>
      <input
        className={inputCls}
        value={d.fields[k] ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange({ ...d, fields: { ...d.fields, [k]: e.target.value } })}
      />
    </Field>
  );
}

export function TypeFields({ d, onChange, bots }: { d: TaskDraft; onChange: (d: TaskDraft) => void; bots?: AccountsInfo["bots"] | null }) {
  const p = { d, onChange };
  switch (d.type) {
    case "token_balance":
      return (
        <>
          <F {...p} k="token" label="Token address" placeholder="0x…" />
          <F {...p} k="min" label="Minimum amount" placeholder="e.g. 100" />
        </>
      );
    case "token_bought":
      return (
        <>
          <F {...p} k="token" label="Token address" placeholder="0x…" />
          <F {...p} k="min" label="Minimum net buy" placeholder="e.g. 1000" />
          <Toggle
            checked={d.fields.hold !== "no"}
            onChange={(v) => onChange({ ...d, fields: { ...d.fields, hold: v ? "yes" : "no" } })}
            label="Must still hold it when claiming"
            hint="Stops buy → claim → sell."
          />
        </>
      );
    case "held_since":
      return (
        <>
          <F {...p} k="token" label="Token address" placeholder="0x…" />
          <F {...p} k="min" label="Minimum amount" />
          <F {...p} k="days" label="Days held" placeholder="7" />
        </>
      );
    case "contract_read":
      return (
        <>
          <F {...p} k="contract" label="Contract address" placeholder="0x…" />
          <F {...p} k="signature" label="Function" placeholder="function stakedOf(address) view returns (uint256)" />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Compare">
              <select className={inputCls} value={d.fields.compare ?? ">="} onChange={(e) => onChange({ ...d, fields: { ...d.fields, compare: e.target.value } })}>
                {[">=", ">", "==", "!="].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <F {...p} k="value" label="Value (raw units, true/false)" placeholder="1" />
          </div>
          <F {...p} k="description" label="What it means (shown to claimers)" placeholder="Stake at least 1 token" />
        </>
      );
    case "farcaster_account":
      return <F {...p} k="minScore" label="Minimum Neynar score (optional, 0–1)" placeholder="0.5" />;
    case "farcaster_follow":
      return (
        <>
          <F {...p} k="fid" label="Account FID" placeholder="e.g. 3" />
          <F {...p} k="name" label="Username (shown to claimers)" placeholder="dwr" />
        </>
      );
    case "farcaster_reaction":
      return (
        <>
          <F {...p} k="cast" label="Cast hash" placeholder="0x…" />
          <Field label="Needs">
            <select className={inputCls} value={d.fields.kind ?? "like"} onChange={(e) => onChange({ ...d, fields: { ...d.fields, kind: e.target.value } })}>
              <option value="like">Like</option>
              <option value="recast">Recast</option>
              <option value="both">Like and recast</option>
            </select>
          </Field>
        </>
      );
    case "farcaster_channel":
      return <F {...p} k="channel" label="Channel id" placeholder="base" />;
    case "x_post":
      return (
        <>
          <F {...p} k="mention" label="Must mention (optional)" placeholder="@yourproject" />
          <F {...p} k="include" label="Must include text (optional)" placeholder="#BaseDrops" />
        </>
      );
    case "quiz":
      return (
        <Field label="Questions" hint='One per line: "Question? | answer | other accepted answer"'>
          <textarea
            className={`${inputCls} min-h-[96px] py-2`}
            value={d.fields.lines ?? ""}
            onChange={(e) => onChange({ ...d, fields: { ...d.fields, lines: e.target.value } })}
            placeholder={"Which chain is this on? | Base\nIs Base an L2? | yes | y"}
          />
        </Field>
      );
    case "secret_word":
      return (
        <>
          <F {...p} k="answers" label="Accepted answers (comma-separated)" placeholder="onchain summer" />
          <F {...p} k="hint" label="Hint (optional)" />
        </>
      );
    case "basename":
      return null;
    case "x_account":
      return (
        <>
          <Field label="Verification needed">
            <select className={inputCls} value={d.fields.verified ?? "any"} onChange={(e) => onChange({ ...d, fields: { ...d.fields, verified: e.target.value } })}>
              <option value="any">Any check (blue, business or government)</option>
              <option value="blue">Blue check</option>
              <option value="business">Business (gold) check</option>
              <option value="none">No check needed</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <F {...p} k="followers" label="Min followers (optional)" placeholder="100" />
            <F {...p} k="age" label="Min account age, days (optional)" placeholder="90" />
          </div>
        </>
      );
    case "discord_member":
      return (
        <>
          <F {...p} k="guild" label="Server id" placeholder="123456789012345678" hint="Discord: Settings → Advanced → Developer Mode, then right-click your server → Copy Server ID." />
          <F {...p} k="name" label="Server name (shown to claimers)" />
          <F {...p} k="roles" label="Required role ids (optional, comma-separated)" />
          <F {...p} k="days" label="Member for at least N days (optional)" />
          {bots?.discordInviteUrl ? (
            <a className="text-xs underline text-[var(--brand-text)]" href={bots.discordInviteUrl} target="_blank" rel="noopener noreferrer">
              Add the app&apos;s bot to your server
            </a>
          ) : (
            <p className="text-xs text-[var(--ink-muted)]">The Discord bot isn&apos;t set up on this deployment yet.</p>
          )}
        </>
      );
    case "telegram_member":
      return (
        <>
          <F {...p} k="chat" label="Group or channel" placeholder="@yourchannel or -1001234567890" />
          <F {...p} k="title" label="Name (shown to claimers)" />
          <p className="text-xs text-[var(--ink-muted)]">
            {bots?.telegramBotUsername
              ? `Add @${bots.telegramBotUsername} to your group (make it an admin in channels) so membership can be checked.`
              : "Add the app's Telegram bot to your group (admin for channels) so membership can be checked."}
          </p>
        </>
      );
    case "wallet_age":
      return (
        <div className="grid grid-cols-2 gap-2">
          <F {...p} k="days" label="Minimum age (days)" placeholder="30" />
          <F {...p} k="txs" label="Minimum transactions (optional)" placeholder="10" />
        </div>
      );
    case "referrals":
      return <F {...p} k="friends" label="Friends who must claim" placeholder="3" hint="Each claimer gets an invite link on the claim page." />;
    case "live_code":
      return <F {...p} k="place" label="Where (shown to claimers, optional)" placeholder="Base meetup, Lisbon" hint="After creating, open My drops to show the live code on screen." />;
    case "webhook":
      return (
        <>
          <F {...p} k="url" label="Your https URL" placeholder="https://api.example.com/drops/check" />
          <F {...p} k="secret" label="Shared secret (16+ characters)" hint="We send X-Drops-Signature = HMAC-SHA256(secret, body). Reply JSON {ok: true}." />
          <F {...p} k="description" label="What it checks (shown to claimers)" placeholder="Finished level 3 in our game" />
        </>
      );
    case "review":
      return (
        <>
          <F {...p} k="instructions" label="What to submit" placeholder="Post a meme about Base and paste the link" />
          <Field label="Answer type">
            <select className={inputCls} value={d.fields.kind ?? "url"} onChange={(e) => onChange({ ...d, fields: { ...d.fields, kind: e.target.value } })}>
              <option value="url">Link</option>
              <option value="text">Text</option>
            </select>
          </Field>
        </>
      );
    default:
      return null;
  }
}

export default function TaskBuilder({
  catalog,
  drafts,
  onChange,
  daily,
}: {
  catalog: CatalogEntry[];
  drafts: TaskDraft[];
  onChange: (d: TaskDraft[]) => void;
  /** Daily drops: tasks default to "redo before every claim". */
  daily: boolean;
}) {
  const [adding, setAdding] = React.useState(catalog[0]?.type ?? "");
  const [bots, setBots] = React.useState<AccountsInfo["bots"] | null>(null);
  React.useEffect(() => {
    accountsApi
      .info(null)
      .then((r) => setBots(r.bots))
      .catch(() => setBots(null));
  }, []);
  const update = (i: number, d: TaskDraft) => onChange(drafts.map((x, j) => (j === i ? d : x)));

  return (
    <div className="space-y-3">
      {drafts.map((d, i) => {
        const entry = catalog.find((c) => c.type === d.type);
        return (
          <div key={d.key} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]/50 p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="text-sm font-black text-[var(--ink)]">{entry?.label ?? d.type}</p>
                <p className="text-xs text-[var(--ink-muted)]">{TYPE_HELP[d.type]}</p>
                {entry && <Pill>{TRUST_LABEL[entry.trust] ?? entry.trust}</Pill>}
              </div>
              <button type="button" aria-label="Remove task" className={btnSecondary} onClick={() => onChange(drafts.filter((_, j) => j !== i))}>
                <Trash2 size={14} />
              </button>
            </div>
            <Field label="Title shown to claimers">
              <input className={inputCls} value={d.title} maxLength={80} onChange={(e) => update(i, { ...d, title: e.target.value })} />
            </Field>
            <TypeFields d={d} onChange={(nd) => update(i, nd)} bots={bots} />
            <div className="grid gap-2 sm:grid-cols-3">
              <Toggle checked={d.required} onChange={(v) => update(i, { ...d, required: v })} label="Required" />
              <Toggle checked={d.repeat} onChange={(v) => update(i, { ...d, repeat: v })} label="Redo before every claim" />
              <Field label="Points (optional tasks)">
                <input
                  className={inputCls}
                  inputMode="numeric"
                  value={String(d.points)}
                  onChange={(e) => update(i, { ...d, points: Math.max(0, Math.min(1000, Number(e.target.value.replace(/\D/g, "")) || 0)) })}
                />
              </Field>
            </div>
            <Field label="Either/or group (optional)" hint="Required tasks with the same group name pass when any one of them does.">
              <input className={inputCls} value={d.group} maxLength={32} onChange={(e) => update(i, { ...d, group: e.target.value })} placeholder="social" />
            </Field>
          </div>
        );
      })}

      {drafts.length < 20 && catalog.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Add a task">
            <select className={inputCls} value={adding} onChange={(e) => setAdding(e.target.value)}>
              {catalog.map((c) => (
                <option key={c.type} value={c.type}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              const entry = catalog.find((c) => c.type === adding);
              if (!entry) return;
              onChange([...drafts, { ...newDraft(entry.type, entry.label), repeat: daily }]);
            }}
          >
            <Plus size={14} /> Add
          </button>
        </div>
      )}
    </div>
  );
}

const addr = (v: string | undefined, what: string) => {
  const s = (v ?? "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(s)) throw new Error(`${what}: enter a valid 0x address.`);
  return s;
};

/** Drafts → the definition the server validates. Reads token decimals for amount fields. */
export async function draftsToDefinition(drafts: TaskDraft[]): Promise<unknown> {
  if (drafts.length === 0) throw new Error("Add at least one task.");
  const tasks = [];
  for (const [i, d] of drafts.entries()) {
    const f = d.fields;
    const id = `t${i + 1}`;
    let config: Record<string, unknown>;
    const amount = async (tokenField: string, minField: string) => {
      const token = addr(f[tokenField], d.title);
      const { decimals, symbol } = await tokenMeta(token);
      const min = toUnits(f[minField] ?? "", decimals);
      if (!min || min <= BigInt(0)) throw new Error(`${d.title}: enter an amount.`);
      return { token, minAmount: min.toString(), symbol };
    };
    switch (d.type) {
      case "token_balance":
        config = await amount("token", "min");
        break;
      case "token_bought":
        config = { ...(await amount("token", "min")), holdUntilClaim: f.hold !== "no" };
        break;
      case "held_since":
        config = { ...(await amount("token", "min")), days: Number(f.days || 7) };
        break;
      case "contract_read":
        config = {
          contract: addr(f.contract, d.title),
          signature: (f.signature ?? "").trim(),
          compare: f.compare ?? ">=",
          value: (f.value ?? "1").trim(),
          description: f.description?.trim() || undefined,
        };
        break;
      case "farcaster_account":
        config = { minScore: f.minScore ? Number(f.minScore) : undefined };
        break;
      case "farcaster_follow":
        config = { targetFid: Number(f.fid), targetName: f.name?.replace(/^@/, "") || undefined };
        break;
      case "farcaster_reaction":
        config = { castHash: (f.cast ?? "").trim(), kind: f.kind ?? "like" };
        break;
      case "farcaster_channel":
        config = { channelId: (f.channel ?? "").trim().replace(/^\//, "").toLowerCase() };
        break;
      case "x_post":
        config = { mention: f.mention?.trim() || undefined, mustInclude: f.include?.trim() || undefined };
        break;
      case "quiz": {
        const questions = (f.lines ?? "")
          .split("\n")
          .map((l) => l.split("|").map((x) => x.trim()))
          .filter((parts) => parts.length >= 2 && parts[0])
          .map(([question, ...answers]) => ({ question, answers: answers.filter(Boolean) }));
        if (questions.length === 0) throw new Error(`${d.title}: add at least one "Question | answer" line.`);
        config = { questions };
        break;
      }
      case "secret_word":
        config = { answers: (f.answers ?? "").split(",").map((x) => x.trim()).filter(Boolean), hint: f.hint?.trim() || undefined };
        break;
      case "basename":
        config = {};
        break;
      case "x_account":
        config = {
          verified: f.verified ?? "any",
          minFollowers: f.followers ? Number(f.followers) : undefined,
          minAccountAgeDays: f.age ? Number(f.age) : undefined,
        };
        break;
      case "discord_member":
        config = {
          guildId: (f.guild ?? "").trim(),
          serverName: f.name?.trim() || undefined,
          roleIds: f.roles ? f.roles.split(",").map((x) => x.trim()).filter(Boolean) : undefined,
          minDaysInServer: f.days ? Number(f.days) : undefined,
        };
        break;
      case "telegram_member":
        config = { chatId: (f.chat ?? "").trim(), title: f.title?.trim() || undefined };
        break;
      case "wallet_age":
        config = { minDays: Number(f.days || 30), minTxs: f.txs ? Number(f.txs) : undefined };
        break;
      case "referrals":
        config = { minFriends: Number(f.friends || 1) };
        break;
      case "live_code":
        config = { place: f.place?.trim() || undefined };
        break;
      case "webhook":
        config = { url: (f.url ?? "").trim(), secret: (f.secret ?? "").trim(), description: f.description?.trim() || undefined };
        break;
      case "review":
        config = { instructions: (f.instructions ?? "").trim(), kind: f.kind ?? "url" };
        break;
      default:
        throw new Error(`Unknown task type ${d.type}`);
    }
    tasks.push({
      id,
      type: d.type,
      title: d.title.trim() || undefined,
      required: d.required,
      points: d.points,
      repeat: d.repeat,
      group: d.group.trim() || undefined,
      config,
    });
  }
  return { version: 1, tasks };
}
