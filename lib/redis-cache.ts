import { Redis } from "ioredis";

let client: Redis | null = null;

function getRedis(): Redis | null {
  const url = process.env.KV_REDIS_URL;
  if (!url) return null;
  if (!client) {
    client = new Redis(url, {
      tls: url.startsWith("rediss://") ? { rejectUnauthorized: false } : undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      commandTimeout: 4000,
      enableReadyCheck: false,
    });
    client.on("error", (e) => console.error("[Redis cache]", e.message));
  }
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    if (redis.status !== "ready") await redis.connect();
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
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
  } catch {
    // cache write failure is non-fatal
  }
}
