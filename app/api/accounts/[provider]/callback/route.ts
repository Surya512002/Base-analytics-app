import { NextResponse } from "next/server";
import { dropsKv } from "@/lib/drops/kv";
import { limitIp } from "@/lib/drops/http";
import { LinkError, consumeState, saveLink } from "@/lib/accounts/store";
import { discordExchange, xExchange } from "@/lib/accounts/providers";
import { getAppUrl } from "@/lib/constants/app-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/accounts/:provider/callback?code&state — where X / Discord send the user back.
 * The state is burned on first use and must match the platform. Only fixed error codes go back
 * in the URL (never platform error text), and the return target is a same-site path.
 */
export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const base = getAppUrl().replace(/\/$/, "");
  const back = (path: string, q: Record<string, string>) =>
    NextResponse.redirect(`${base}${path}?${new URLSearchParams(q).toString()}`, { status: 303 });

  const limited = await limitIp(req, "acct-cb", 30, 60_000);
  if (limited) return limited;
  const provider = (await ctx.params).provider;
  if (provider !== "x" && provider !== "discord") return back("/drops", { link_error: "unknown_platform" });

  const sp = new URL(req.url).searchParams;
  const state = await consumeState(dropsKv, sp.get("state") ?? "");
  if (!state || state.provider !== provider) return back("/drops", { link_error: "expired" });
  if (sp.get("error")) return back(state.returnTo, { link_error: "cancelled" });
  const code = sp.get("code") ?? "";
  if (!code || code.length > 512) return back(state.returnTo, { link_error: "cancelled" });

  try {
    const account = provider === "x" ? await xExchange(code, state.verifier ?? "") : await discordExchange(code);
    await saveLink(dropsKv, state.wallet, account, Math.floor(Date.now() / 1000));
    return back(state.returnTo, { linked: provider });
  } catch (e) {
    return back(state.returnTo, { link_error: e instanceof LinkError ? "already_linked" : "failed" });
  }
}
