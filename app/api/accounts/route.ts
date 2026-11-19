import { NextResponse } from "next/server";
import { dropsKv } from "@/lib/drops/kv";
import { limitIp, requireWallet } from "@/lib/drops/http";
import { PROVIDERS, listLinked } from "@/lib/accounts/store";
import { discordBotInviteUrl, providerConfigured, telegramBotId } from "@/lib/accounts/providers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/accounts?wallet=0x… → this wallet's linked accounts (SIWE as that wallet), plus which
 * platforms can be linked on this deployment and how creators add the app's bots.
 * GET /api/accounts → just the platform info (no wallet needed).
 */
export async function GET(req: Request) {
  const limited = await limitIp(req, "accounts", 60, 60_000);
  if (limited) return limited;
  const available = Object.fromEntries(PROVIDERS.map((p) => [p, providerConfigured(p)]));
  const bots = {
    discordInviteUrl: providerConfigured("discord") && process.env.DISCORD_BOT_TOKEN ? discordBotInviteUrl() : null,
    telegramBotUsername: (process.env.TELEGRAM_BOT_USERNAME || "").trim() || null,
    telegramReady: Boolean(telegramBotId()),
  };
  const raw = new URL(req.url).searchParams.get("wallet");
  if (!raw) return NextResponse.json({ available, bots, accounts: [] });
  const auth = await requireWallet(raw);
  if (!auth.ok) return auth.res;
  const accounts = (await listLinked(dropsKv, auth.wallet)).map((a) => ({
    provider: a.provider,
    username: a.username,
    verifiedType: a.verifiedType,
    followers: a.followers,
    linkedAt: a.linkedAt,
    snapshotAt: a.snapshotAt,
  }));
  return NextResponse.json({ available, bots, accounts }, { headers: { "Cache-Control": "no-store" } });
}
