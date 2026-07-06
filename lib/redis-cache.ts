import { Redis } from "ioredis";

let client: Redis | null = null;
let redisUnavailable = false;
let warnedUnavailable = false;

const AUTH_ERROR =
  /WRONGPASS|NOAUTH|invalid username-password|ERR invalid password/i;

/** Redis Cloud / Redis Labs require TLS — upgrade redis:// → rediss:// */
export function normalizeRedisUrl(url: string): string {
  const trimmed = url.trim();
  if (
    trimmed.startsWith("redis://") &&
    /\.(redislabs\.com|redis\.cloud)/i.test(trimmed)
  ) {
    return trimmed.replace(/^redis:\/\//, "rediss://");
  }
  return trimmed;
}

function warnUnavailable(reason: string) {
  if (warnedUnavailable) return;
  warnedUnavailable = true;
  console.warn(`[Redis cache] Disabled — ${reason}`);
}

function disableRedis(reason: string) {
  if (redisUnavailable) return;
  redisUnavailable = true;
  warnUnavailable(reason);
  try {
    client?.disconnect();
  } catch {
    /* ignore */
  }
  client = null;
}

function getRedis(): Redis | null {
  if (redisUnavailable) return null;
  const raw = process.env.KV_REDIS_URL?.trim();
  if (!raw) return null;

  if (!client) {
    const url = normalizeRedisUrl(raw);
    client = new Redis(url, {
      tls: url.startsWith("rediss://")
        ? { rejectUnauthorized: false }
        : undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 0,
      connectTimeout: 3000,
      commandTimeout: 2000,
      enableReadyCheck: false,
      retryStrategy: () => null,
    });
    client.on("error", (e) => {
      if (AUTH_ERROR.test(e.message)) {
        disableRedis("check KV_REDIS_URL username/password in Redis Cloud");
      }
    });
  }
  return client;
}

function handleCacheError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (AUTH_ERROR.test(msg)) {
    disableRedis("check KV_REDIS_URL username/password in Redis Cloud");
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    if (redis.status !== "ready") await redis.connect();
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    handleCacheError(err);
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    if (redis.status !== "ready") await redis.connect();
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    handleCacheError(err);
  }
}
