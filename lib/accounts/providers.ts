/**
 * Platform adapters for linking accounts (server only).
 *
 * X        OAuth 2.0 + PKCE, scopes "users.read tweet.read" (read-only). We read the user's own
 *          profile once — id, username, verified_type (blue check), followers, created_at —
 *          then revoke the token.                    Env: X_CLIENT_ID, X_CLIENT_SECRET
 * Discord  OAuth 2.0, scope "identify" only (we learn the user id, nothing else). Server
 *          membership/roles are read with the app's bot, which the creator adds to their server
 *          — no user token is ever kept.             Env: DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN
 * Telegram Login via oauth.telegram.org; the payload is signed by Telegram with our bot token,
 *          which we verify (HMAC-SHA256). Membership is read with the bot (getChatMember); the
 *          creator adds the bot to their group/channel.           Env: TELEGRAM_BOT_TOKEN
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAppUrl } from "@/lib/constants/app-url";
import type { LinkedAccount, Provider } from "./store";

type Fetch = typeof fetch;
const env = (k: string) => (process.env[k] || "").trim();

export function redirectUri(p: "x" | "discord"): string {
  const override = env(p === "x" ? "X_OAUTH_REDIRECT_URL" : "DISCORD_OAUTH_REDIRECT_URL");
  return override || `${getAppUrl().replace(/\/$/, "")}/api/accounts/${p}/callback`;
}

export function providerConfigured(p: Provider): boolean {
  if (p === "x") return Boolean(env("X_CLIENT_ID") && env("X_CLIENT_SECRET"));
  if (p === "discord") return Boolean(env("DISCORD_CLIENT_ID") && env("DISCORD_CLIENT_SECRET"));
  return /^\d+:[A-Za-z0-9_-]{30,}$/.test(env("TELEGRAM_BOT_TOKEN"));
}

// ───────────────────────────── PKCE ─────────────────────────────

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

// ───────────────────────────── X ─────────────────────────────

export function xAuthorizeUrl(state: string, challenge: string): string {
  const u = new URL("https://x.com/i/oauth2/authorize");
  u.search = new URLSearchParams({
    response_type: "code",
    client_id: env("X_CLIENT_ID"),
    redirect_uri: redirectUri("x"),
    scope: "users.read tweet.read",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  return u.toString();
}

const basicAuth = (id: string, secret: string) => `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;

export async function xExchange(code: string, verifier: string, f: Fetch = fetch): Promise<Omit<LinkedAccount, "linkedAt" | "snapshotAt">> {
  const auth = basicAuth(env("X_CLIENT_ID"), env("X_CLIENT_SECRET"));
  const tokenRes = await f("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", authorization: auth },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri("x"), code_verifier: verifier }).toString(),
    signal: AbortSignal.timeout(8000),
  });
  if (!tokenRes.ok) throw new Error("X sign-in failed");
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) throw new Error("X sign-in failed");
  try {
    const me = await f("https://api.x.com/2/users/me?user.fields=verified,verified_type,created_at,public_metrics", {
      headers: { authorization: `Bearer ${access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!me.ok) throw new Error("Couldn't read your X profile");
    const { data } = (await me.json()) as {
      data?: { id: string; username: string; verified?: boolean; verified_type?: string; created_at?: string; public_metrics?: { followers_count?: number } };
    };
    if (!data?.id || !data.username) throw new Error("Couldn't read your X profile");
    return {
      provider: "x",
      id: data.id,
      username: data.username,
      verifiedType: data.verified_type ?? (data.verified ? "blue" : "none"),
      followers: data.public_metrics?.followers_count,
      accountCreatedAt: data.created_at ? Math.floor(Date.parse(data.created_at) / 1000) : undefined,
    };
  } finally {
    // We never keep the token: revoke it right away (best effort).
    void f("https://api.x.com/2/oauth2/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", authorization: auth },
      body: new URLSearchParams({ token: access_token, token_type_hint: "access_token" }).toString(),
    }).catch(() => undefined);
  }
}

// ───────────────────────────── Discord ─────────────────────────────

export function discordAuthorizeUrl(state: string): string {
  const u = new URL("https://discord.com/oauth2/authorize");
  u.search = new URLSearchParams({
    response_type: "code",
    client_id: env("DISCORD_CLIENT_ID"),
    redirect_uri: redirectUri("discord"),
    scope: "identify",
    state,
    prompt: "consent",
  }).toString();
  return u.toString();
}

/** Discord ids are snowflakes: the creation time is in the id. */
export function discordCreatedAt(id: string): number {
  return Math.floor(Number((BigInt(id) >> BigInt(22)) + BigInt(1420070400000)) / 1000);
}

export async function discordExchange(code: string, f: Fetch = fetch): Promise<Omit<LinkedAccount, "linkedAt" | "snapshotAt">> {
  const tokenRes = await f("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("DISCORD_CLIENT_ID"),
      client_secret: env("DISCORD_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri("discord"),
    }).toString(),
    signal: AbortSignal.timeout(8000),
  });
  if (!tokenRes.ok) throw new Error("Discord sign-in failed");
  const { access_token } = (await tokenRes.json()) as { access_token?: string };
  if (!access_token) throw new Error("Discord sign-in failed");
  try {
    const me = await f("https://discord.com/api/users/@me", { headers: { authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(8000) });
    if (!me.ok) throw new Error("Couldn't read your Discord profile");
    const u = (await me.json()) as { id?: string; username?: string; global_name?: string | null };
    if (!u.id || !/^\d{15,22}$/.test(u.id)) throw new Error("Couldn't read your Discord profile");
    return { provider: "discord", id: u.id, username: u.global_name || u.username || u.id, accountCreatedAt: discordCreatedAt(u.id) };
  } finally {
    void f("https://discord.com/api/oauth2/token/revoke", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: access_token, client_id: env("DISCORD_CLIENT_ID"), client_secret: env("DISCORD_CLIENT_SECRET") }).toString(),
    }).catch(() => undefined);
  }
}

export type MemberCheck = { status: "member"; roles: string[]; joinedAt?: number } | { status: "not_member" } | { status: "bot_missing" } | { status: "error" };

/** Is `userId` in `guildId` (and with which roles)? Uses the app's bot; the bot must be in the server. */
export async function discordMember(guildId: string, userId: string, f: Fetch = fetch): Promise<MemberCheck> {
  const token = env("DISCORD_BOT_TOKEN");
  if (!token) return { status: "error" };
  try {
    const res = await f(`https://discord.com/api/v10/guilds/${guildId}/members/${userId}`, {
      headers: { authorization: `Bot ${token}` },
      signal: AbortSignal.timeout(6000),
    });
    if (res.status === 404) {
      const body = (await res.json().catch(() => ({}))) as { code?: number };
      // 10007 = Unknown Member; 10004 = Unknown Guild (bot not in that server)
      return body.code === 10004 ? { status: "bot_missing" } : { status: "not_member" };
    }
    if (res.status === 403) return { status: "bot_missing" };
    if (!res.ok) return { status: "error" };
    const m = (await res.json()) as { roles?: string[]; joined_at?: string };
    return { status: "member", roles: m.roles ?? [], joinedAt: m.joined_at ? Math.floor(Date.parse(m.joined_at) / 1000) : undefined };
  } catch {
    return { status: "error" };
  }
}

/** Invite link for the app's bot (no permissions needed to read one member). */
export function discordBotInviteUrl(): string | null {
  const id = env("DISCORD_CLIENT_ID");
  return id ? `https://discord.com/oauth2/authorize?client_id=${id}&scope=bot&permissions=0` : null;
}

// ───────────────────────────── Telegram ─────────────────────────────

export function telegramBotId(): string | null {
  const t = env("TELEGRAM_BOT_TOKEN");
  const m = t.match(/^(\d+):/);
  return m ? m[1]! : null;
}

export function telegramLoginUrl(origin: string, returnTo: string): string | null {
  const id = telegramBotId();
  if (!id) return null;
  const u = new URL("https://oauth.telegram.org/auth");
  u.search = new URLSearchParams({ bot_id: id, origin, return_to: `${origin}${returnTo}`, request_access: "read" }).toString();
  return u.toString();
}

/**
 * Verify a Telegram login payload (https://core.telegram.org/widgets/login#checking-authorization):
 * HMAC-SHA256 over the sorted "key=value" lines, keyed with SHA256(bot token). Max age 1 hour.
 */
export function verifyTelegramLogin(
  data: Record<string, unknown>,
  now: number,
  botToken = env("TELEGRAM_BOT_TOKEN")
): Omit<LinkedAccount, "linkedAt" | "snapshotAt"> | null {
  if (!botToken || typeof data.hash !== "string" || !/^[0-9a-f]{64}$/.test(data.hash)) return null;
  const fields = Object.entries(data)
    .filter(([k, v]) => k !== "hash" && v !== undefined && v !== null && ["string", "number"].includes(typeof v))
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHash("sha256").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(fields).digest();
  const given = Buffer.from(data.hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const authDate = Number(data.auth_date);
  if (!Number.isFinite(authDate) || now - authDate > 3600 || authDate - now > 300) return null;
  const id = String(data.id ?? "");
  if (!/^\d{3,20}$/.test(id)) return null;
  return { provider: "telegram", id, username: typeof data.username === "string" ? data.username : String(data.first_name ?? id) };
}

/** Is the Telegram user in the group/channel? The app's bot must be a member (admin for channels). */
export async function telegramMember(chatId: string, userId: string, f: Fetch = fetch): Promise<MemberCheck> {
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) return { status: "error" };
  try {
    const u = new URL(`https://api.telegram.org/bot${token}/getChatMember`);
    u.search = new URLSearchParams({ chat_id: chatId, user_id: userId }).toString();
    const res = await f(u, { signal: AbortSignal.timeout(6000) });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: { status?: string; is_member?: boolean }; description?: string };
    if (!body.ok) {
      const d = (body.description ?? "").toLowerCase();
      if (d.includes("user not found") || d.includes("participant_id_invalid")) return { status: "not_member" };
      if (d.includes("chat not found") || d.includes("not enough rights") || d.includes("bot is not a member")) return { status: "bot_missing" };
      return { status: "error" };
    }
    const s = body.result?.status;
    const member = s === "creator" || s === "administrator" || s === "member" || (s === "restricted" && body.result?.is_member === true);
    return member ? { status: "member", roles: [] } : { status: "not_member" };
  } catch {
    return { status: "error" };
  }
}
