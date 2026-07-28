import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { SiweMessage } from "siwe";
import { getAddress } from "viem";
import { getAppUrl } from "@/lib/constants/app-url";
import { cacheGet, cacheSet } from "@/lib/redis-cache";

const BASE_CHAIN_ID = 8453;
const SESSION_COOKIE = "ba_siwe_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days
const NONCE_TTL_SEC = 300;

const memNonces = new Map<string, { createdAt: number }>();

function sessionSecret(): string {
  return (
    process.env.SIWE_SESSION_SECRET?.trim() ||
    process.env.KV_REDIS_URL?.trim() ||
    "dev-only-change-SIWE_SESSION_SECRET-in-production"
  );
}

function appDomain(): string {
  try {
    return new URL(getAppUrl()).host;
  } catch {
    return "localhost:3000";
  }
}

export { SESSION_COOKIE };

export async function issueSiweNonce(): Promise<string> {
  const nonce = randomBytes(16).toString("hex");
  memNonces.set(nonce, { createdAt: Date.now() });
  await cacheSet(`siwe:nonce:${nonce}`, { ok: true }, NONCE_TTL_SEC).catch(() => {});
  return nonce;
}

async function consumeNonce(nonce: string): Promise<boolean> {
  const cached = await cacheGet<{ ok: boolean }>(`siwe:nonce:${nonce}`);
  if (cached?.ok) {
    memNonces.delete(nonce);
    return true;
  }
  const local = memNonces.get(nonce);
  if (!local) return false;
  if (Date.now() - local.createdAt > NONCE_TTL_SEC * 1000) {
    memNonces.delete(nonce);
    return false;
  }
  memNonces.delete(nonce);
  return true;
}

export function buildSiweMessage(address: string, nonce: string): string {
  const siwe = new SiweMessage({
    domain: appDomain(),
    address: getAddress(address),
    statement: "Sign in to Base Analytics — manage your creator profile and launch revenue.",
    uri: getAppUrl(),
    version: "1",
    chainId: BASE_CHAIN_ID,
    nonce,
  });
  return siwe.prepareMessage();
}

export async function verifySiweCredentials(
  message: string,
  signature: string
): Promise<{ address: string } | { error: string }> {
  try {
    const siwe = new SiweMessage(message);
    if (siwe.domain !== appDomain()) {
      return { error: "Invalid domain" };
    }
    if (siwe.chainId !== BASE_CHAIN_ID) {
      return { error: "Wrong network — switch to Base" };
    }
    const nonceOk = await consumeNonce(siwe.nonce);
    if (!nonceOk) {
      return { error: "Nonce expired — request a new sign-in" };
    }

    const result = await siwe.verify({ signature, domain: appDomain() });
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
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  };
}
