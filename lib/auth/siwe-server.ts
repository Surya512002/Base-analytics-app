import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { SiweMessage } from "siwe";
import { getAddress } from "viem";
import { getAppUrl } from "@/lib/constants/app-url";
import { cacheGet, cacheSet, getRedisClient } from "@/lib/redis-cache";

const BASE_CHAIN_ID = 8453;
const SESSION_COOKIE = "ba_siwe_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days
const NONCE_TTL_SEC = 300;

function sessionSecret(): string {
  return (
    process.env.SIWE_SESSION_SECRET?.trim() ||
    process.env.KV_REDIS_URL?.trim() ||
    "dev-only-change-SIWE_SESSION_SECRET-in-production"
  );
}

/** Host used in SIWE messages — prefer the live request host so MetaMask matches the page. */
export function resolveSiweDomain(requestHost?: string | null): string {
  const fromReq = normalizeHost(requestHost);
  if (fromReq) return fromReq;
  try {
    return new URL(getAppUrl()).host;
  } catch {
    return "localhost:3000";
  }
}

function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const cleaned = host.split(",")[0]?.trim().toLowerCase();
  if (!cleaned) return null;
  // Strip default ports
  return cleaned.replace(/:80$/, "").replace(/:443$/, "");
}

function appDomain(): string {
  return resolveSiweDomain(null);
}

function allowedSiweDomains(requestHost?: string | null): Set<string> {
  const set = new Set<string>();
  const primary = appDomain();
  set.add(primary);
  set.add(primary.replace(/^www\./, ""));
  if (!primary.startsWith("www.")) set.add(`www.${primary}`);
  const live = normalizeHost(requestHost);
  if (live) {
    set.add(live);
    set.add(live.replace(/^www\./, ""));
  }
  // Local / preview hosts always allowed for their own requests
  if (live?.includes("localhost") || live?.endsWith(".vercel.app")) {
    set.add(live);
  }
  return set;
}

export { SESSION_COOKIE };

/**
 * Self-validating nonce (works across Vercel serverless instances without Redis).
 * Format: 16 hex id + 8 hex expiry (unix sec) + 16 hex HMAC = 40 hex chars.
 */
export function issueSiweNonce(): string {
  const id = randomBytes(8).toString("hex");
  const exp = Math.floor(Date.now() / 1000) + NONCE_TTL_SEC;
  const expHex = exp.toString(16).padStart(8, "0");
  const payload = `${id}${expHex}`;
  const mac = createHmac("sha256", sessionSecret())
    .update(`siwe-nonce:${payload}`)
    .digest("hex")
    .slice(0, 16);
  const nonce = `${payload}${mac}`;
  // Best-effort one-time mark in Redis (optional)
  void cacheSet(`siwe:nonce:${nonce}`, { ok: true }, NONCE_TTL_SEC).catch(() => {});
  return nonce;
}

function safeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length || ba.length === 0) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

async function markNonceUsed(nonce: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return true; // no redis — signed nonce TTL is enough
  try {
    if (redis.status !== "ready") await redis.connect();
    const key = `siwe:used:${nonce}`;
    const set = await redis.set(key, "1", "EX", NONCE_TTL_SEC, "NX");
    return set === "OK";
  } catch {
    return true;
  }
}

export async function consumeNonce(nonce: string): Promise<boolean> {
  if (!/^[0-9a-f]{40}$/i.test(nonce)) {
    // Legacy random nonces stored in Redis / memory (pre-signed format)
    const cached = await cacheGet<{ ok: boolean }>(`siwe:nonce:${nonce}`);
    if (!cached?.ok) return false;
    return markNonceUsed(nonce);
  }

  const payload = nonce.slice(0, 24).toLowerCase();
  const mac = nonce.slice(24).toLowerCase();
  const expected = createHmac("sha256", sessionSecret())
    .update(`siwe-nonce:${payload}`)
    .digest("hex")
    .slice(0, 16);
  if (!safeEqualHex(mac, expected)) return false;

  const expSec = parseInt(payload.slice(16, 24), 16);
  if (!Number.isFinite(expSec) || Math.floor(Date.now() / 1000) > expSec) {
    return false;
  }

  return markNonceUsed(nonce);
}

export function buildSiweMessage(
  address: string,
  nonce: string,
  domain?: string,
  uri?: string
): string {
  const d = domain || appDomain();
  const u = uri || getAppUrl();
  const siwe = new SiweMessage({
    domain: d,
    address: getAddress(address),
    statement: "Sign in to Base Analytics - manage your creator profile and launch revenue.",
    uri: u,
    version: "1",
    chainId: BASE_CHAIN_ID,
    nonce,
  });
  return siwe.prepareMessage();
}

export async function verifySiweCredentials(
  message: string,
  signature: string,
  requestHost?: string | null
): Promise<{ address: string } | { error: string }> {
  try {
    const siwe = new SiweMessage(message);
    const allowed = allowedSiweDomains(requestHost);
    if (!siwe.domain || !allowed.has(siwe.domain.toLowerCase())) {
      return { error: "Invalid domain — refresh and try again" };
    }
    if (siwe.chainId !== BASE_CHAIN_ID) {
      return { error: "Wrong network — switch to Base" };
    }
    const nonceOk = await consumeNonce(siwe.nonce);
    if (!nonceOk) {
      return { error: "Nonce expired — request a new sign-in" };
    }

    const result = await siwe.verify({
      signature,
      domain: siwe.domain,
    });
    const address = getAddress(result.data.address).toLowerCase();
    return { address };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verification failed";
    return { error: msg };
  }
}

function signPayload(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

export function createSessionToken(address: string): string {
  const exp = Date.now() + SESSION_TTL_SEC * 1000;
  const payload = Buffer.from(
    JSON.stringify({ address: address.toLowerCase(), exp }),
    "utf8"
  ).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

export function parseSessionToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = signPayload(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      address?: string;
      exp?: number;
    };
    if (!data.address?.startsWith("0x") || !data.exp || Date.now() > data.exp) return null;
    return data.address.toLowerCase();
  } catch {
    return null;
  }
}

export function sessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "none";
  path: string;
  maxAge: number;
} {
  const secure = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    // none + secure required for Farcaster / Base App iframe; also fine for MetaMask top-level
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  };
}
