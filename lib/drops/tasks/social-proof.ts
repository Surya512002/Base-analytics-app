/**
 * X (Twitter) post task — free, no X API needed.
 *
 * The claimer posts publicly with a code unique to their wallet, then pastes the post link. We
 * read the public post through X's oEmbed endpoint and check the author, the required text and
 * the code. The first verified post binds that X account to the wallet for this drop.
 *
 * Follows / likes / reposts need the paid X API; they aren't offered here.
 */
import { keccak256, encodePacked } from "viem";
import { z } from "zod";
import type { TaskContext, TaskType } from "../types";

const handle = z.string().regex(/^@?[A-Za-z0-9_]{1,15}$/).transform((h) => h.replace(/^@/, "").toLowerCase());

const xPostConfig = z.object({
  /** Post must mention this account (e.g. "basebuilders"). */
  mention: handle.optional(),
  /** Post must contain this text (e.g. "#BaseDrops" or a link). */
  mustInclude: z.string().min(1).max(100).optional(),
});

/** Short code the claimer puts in their post; ties the post to their wallet for this drop. */
export function walletPostCode(dropId: bigint, claimer: string, taskId: string): string {
  const h = keccak256(encodePacked(["uint256", "address", "string"], [dropId, claimer as `0x${string}`, taskId]));
  return `drop-${h.slice(2, 8)}`;
}

const POST_URL = /^https:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{5,25})(?:[/?#].*)?$/;

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/\s+/g, " ")
    .trim();
}

export const xPostTask: TaskType<z.infer<typeof xPostConfig>> = {
  type: "x_post",
  label: "Post on X",
  trust: "proof",
  needsSubmission: true,
  recheckAtClaim: false,
  configSchema: xPostConfig,
  async verify(config, ctx) {
    const sub = ctx.submission as { url?: unknown } | undefined;
    const m = typeof sub?.url === "string" ? sub.url.trim().match(POST_URL) : null;
    if (!m) return { status: "failed", message: "Paste the link to your post (x.com/you/status/…)." };

    const code = walletPostCode(ctx.dropId, ctx.claimer, ctx.taskId);
    let author: string;
    let text: string;
    try {
      const url = new URL("https://publish.twitter.com/oembed");
      url.search = new URLSearchParams({ url: `https://x.com/${m[1]}/status/${m[2]}`, omit_script: "1", dnt: "1" }).toString();
      const res = await ctx.fetch(url, { signal: AbortSignal.timeout(6000) });
      if (res.status === 404) return { status: "failed", message: "Couldn't find that post. Is it public?" };
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { author_url?: string; html?: string };
      author = (data.author_url ?? "").split("/").pop()?.toLowerCase() ?? "";
      // Drop the trailing "— Name (@handle) date" attribution so it can't satisfy a mention.
      text = htmlToText((data.html ?? "").replace(/&mdash;[\s\S]*$/, ""));
    } catch {
      return { status: "unavailable", message: "Couldn't read X right now. Try again." };
    }
    if (!author) return { status: "unavailable", message: "Couldn't read X right now. Try again." };

    const lower = text.toLowerCase();
    if (!lower.includes(code)) return { status: "failed", message: `Your post must include your code ${code}.` };
    if (config.mention && !lower.includes(`@${config.mention}`)) {
      return { status: "failed", message: `Your post must mention @${config.mention}.` };
    }
    if (config.mustInclude && !lower.includes(config.mustInclude.toLowerCase())) {
      return { status: "failed", message: `Your post must include "${config.mustInclude}".` };
    }

    // One X account ↔ one wallet per drop.
    const key = `drops:bind:x:${ctx.dropsContract.toLowerCase()}:${ctx.dropId}:${author}`;
    await ctx.kv.setIfAbsent(key, ctx.claimer.toLowerCase());
    if ((await ctx.kv.get(key)) !== ctx.claimer.toLowerCase()) {
      return { status: "failed", message: "This X account was already used for this drop by another wallet." };
    }
    return { status: "passed", message: `Post by @${author} verified.`, evidence: { author, postId: m[2] } };
  },
  publicConfig: (c) => ({ ...c }),
};

/** For the claim page: the code this wallet must include. */
export function xPostInstructions(ctx: Pick<TaskContext, "dropId" | "claimer" | "taskId">): { code: string } {
  return { code: walletPostCode(ctx.dropId, ctx.claimer, ctx.taskId) };
}
