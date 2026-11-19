import { NextResponse } from "next/server";
import { dropsKv } from "@/lib/drops/kv";
import { limitIp, requireWallet } from "@/lib/drops/http";
import { LinkError, PROVIDERS, saveLink, unlink, type Provider } from "@/lib/accounts/store";
import { verifyTelegramLogin } from "@/lib/accounts/providers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/accounts/telegram { wallet, auth } → link Telegram with the signed payload Telegram
 * returns after login (checked with our bot token; max 1 hour old). SIWE as `wallet`.
 */
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const limited = await limitIp(req, "acct-tg", 20, 60_000);
  if (limited) return limited;
  if ((await ctx.params).provider !== "telegram") return NextResponse.json({ error: "Not found" }, { status: 404 });
  let body: { wallet?: string; auth?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const auth = await requireWallet(body.wallet);
  if (!auth.ok) return auth.res;
  const data = body.auth && typeof body.auth === "object" ? (body.auth as Record<string, unknown>) : {};
  const now = Math.floor(Date.now() / 1000);
  const account = verifyTelegramLogin(data, now);
  if (!account) return NextResponse.json({ error: "Telegram login couldn't be verified. Try again." }, { status: 400 });
  try {
    const linked = await saveLink(dropsKv, auth.wallet, account, now);
    return NextResponse.json({ provider: "telegram", username: linked.username });
  } catch (e) {
    return NextResponse.json({ error: e instanceof LinkError ? e.message : "Couldn't link Telegram." }, { status: e instanceof LinkError ? 409 : 500 });
  }
}

/** DELETE /api/accounts/:provider?wallet=0x… → unlink (SIWE). The account stays reserved for this wallet for 7 days. */
export async function DELETE(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const limited = await limitIp(req, "acct-del", 20, 60_000);
  if (limited) return limited;
  const provider = (await ctx.params).provider as Provider;
  if (!PROVIDERS.includes(provider)) return NextResponse.json({ error: "Unknown platform" }, { status: 404 });
  const auth = await requireWallet(new URL(req.url).searchParams.get("wallet"));
  if (!auth.ok) return auth.res;
  await unlink(dropsKv, auth.wallet, provider);
  return NextResponse.json({ ok: true });
}
