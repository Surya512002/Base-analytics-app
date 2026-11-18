/**
 * Server-side encryption at rest for saved claim secrets (Node only).
 *
 * Card secrets are bearer instruments: whoever reads them can claim the cards. They used to sit
 * in Redis / disk as plain JSON, so a leaked Redis URL meant every unclaimed card could be
 * taken. With `VOUCHER_SECRETS_KEY` set, records are sealed with AES-256-GCM under a key
 * derived per creator (HKDF), so the database alone reveals nothing.
 *
 * Keys: `VOUCHER_SECRETS_KEY` = 32 random bytes, base64 (`openssl rand -base64 32`).
 * Rotation: move the old value to `VOUCHER_SECRETS_KEY_PREVIOUS` (comma-separated list) and
 * set a new one; records are re-sealed with the new key the next time they're written.
 *
 * Without a key, records stay readable plaintext (local dev) and the env audit flags it.
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const PREFIX = "vsb1";
const INFO = "base-voucher-credentials-v1";

function parseKey(raw: string | undefined): Buffer | null {
  const s = raw?.trim();
  if (!s) return null;
  try {
    const buf = Buffer.from(s, "base64");
    return buf.length === 32 ? buf : null;
  } catch {
    return null;
  }
}

/** The current key, or null when encryption at rest isn't configured. */
export function currentSecretsKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  return parseKey(env.VOUCHER_SECRETS_KEY);
}

function allKeys(env: NodeJS.ProcessEnv): Buffer[] {
  const keys: Buffer[] = [];
  const cur = currentSecretsKey(env);
  if (cur) keys.push(cur);
  for (const part of (env.VOUCHER_SECRETS_KEY_PREVIOUS ?? "").split(",")) {
    const k = parseKey(part);
    if (k) keys.push(k);
  }
  return keys;
}

export function isSecretsEncryptionConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return currentSecretsKey(env) !== null;
}

/** True when the configured value is present but unusable (wrong length / not base64). */
export function isSecretsKeyMisconfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.VOUCHER_SECRETS_KEY?.trim()) && currentSecretsKey(env) === null;
}

function subKey(master: Buffer, scope: string): Buffer {
  return Buffer.from(hkdfSync("sha256", master, Buffer.from(scope.toLowerCase(), "utf8"), INFO, 32));
}

export function isSealed(value: unknown): value is string {
  return typeof value === "string" && value.startsWith(`${PREFIX}.`);
}

/**
 * Seal a JSON value for `scope` (the creator address). The scope is bound as AAD, so a record
 * copied to another creator's slot fails to open. Returns null when no key is configured.
 */
export function sealJson(value: unknown, scope: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const master = currentSecretsKey(env);
  if (!master) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", subKey(master, scope), iv);
  cipher.setAAD(Buffer.from(scope.toLowerCase(), "utf8"));
  const ct = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

/** Open a sealed value with the current or a previous key. Throws if none can open it. */
export function openJson<T>(sealed: string, scope: string, env: NodeJS.ProcessEnv = process.env): T {
  const [prefix, ivB, tagB, ctB] = sealed.split(".");
  if (prefix !== PREFIX || !ivB || !tagB || ctB === undefined) throw new Error("Not a sealed record");
  const iv = Buffer.from(ivB, "base64url");
  const tag = Buffer.from(tagB, "base64url");
  const ct = Buffer.from(ctB, "base64url");
  for (const master of allKeys(env)) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", subKey(master, scope), iv);
      decipher.setAAD(Buffer.from(scope.toLowerCase(), "utf8"));
      decipher.setAuthTag(tag);
      const pt = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
      return JSON.parse(pt) as T;
    } catch {
      /* try the next key */
    }
  }
  throw new Error("Can't open sealed record with any configured key");
}
