import { NextResponse } from "next/server";
import { dropsKv } from "@/lib/drops/kv";
import { limitIp, requireWallet } from "@/lib/drops/http";
import { PROVIDERS, createState, safeReturnTo, type Provider } from "@/lib/accounts/store";
import { discordAuthorizeUrl, pkcePair, providerConfigured, telegramLoginUrl, xAuthorizeUrl } from "@/lib/accounts/providers";
import { getAppUrl } from "@/lib/constants/app-url";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/accounts/:provider/start { wallet, returnTo } → { url } to send the browser to.
 * Needs a SIWE session for `wallet`. The single-use state (10 min) carries the wallet, so the
 * callback can only ever link to the wallet that started it.
 */
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const limited = await limitIp(req, "acct-start", 20, 60_000);
  if (limited) return limited;
  const provider = (await ctx.params).provider as Provider;
  if (!PROVIDERS.includes(provider)) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  if (!providerConfigured(provider)) return NextResponse.json({ error: "Linking this platform isn't set up yet." }, { status: 503 });

  let body: { wallet?: string; returnTo?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const auth = await requireWallet(body.wallet);
  if (!auth.ok) return auth.res;
  const returnTo = safeReturnTo(body.returnTo);

  if (provider === "telegram") {
    const url = telegramLoginUrl(getAppUrl().replace(/\/$/, ""), returnTo);
    return url ? NextResponse.json({ url }) : NextResponse.json({ error: "Telegram isn't set up yet." }, { status: 503 });
  }
  if (provider === "x") {
    const { verifier, challenge } = pkcePair();
    const state = await createState(dropsKv, { wallet: auth.wallet, provider, verifier, returnTo });
    return NextResponse.json({ url: xAuthorizeUrl(state, challenge) });
  }
  const state = await createState(dropsKv, { wallet: auth.wallet, provider, returnTo });
  return NextResponse.json({ url: discordAuthorizeUrl(state) });
}
