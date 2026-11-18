/**
 * Key-value storage for drops (definitions, progress, attempt counters, account bindings).
 * Redis when configured; an in-process map otherwise (local dev only — not shared between
 * serverless instances).
 */
import { ensureRedisReady, getRedisClient } from "@/lib/redis-cache";
import type { TaskKv } from "./types";

const memory = new Map<string, { value: string; expiresAt: number | null }>();

function memGet(key: string): string | null {
  const e = memory.get(key);
  if (!e) return null;
  if (e.expiresAt !== null && Date.now() > e.expiresAt) {
    memory.delete(key);
    return null;
  }
  return e.value;
}

function memSet(key: string, value: string, ttlSec?: number) {
  memory.set(key, { value, expiresAt: ttlSec ? Date.now() + ttlSec * 1000 : null });
}

async function redis() {
  const r = getRedisClient();
  if (!r) return null;
  await ensureRedisReady(r);
  return r;
}

export const dropsKv: TaskKv & { del(key: string): Promise<void> } = {
  async get(key) {
    const r = await redis();
    return r ? r.get(key) : memGet(key);
  },
  async set(key, value, ttlSec) {
    const r = await redis();
    if (!r) return memSet(key, value, ttlSec);
    if (ttlSec) await r.set(key, value, "EX", ttlSec);
    else await r.set(key, value);
  },
  async setIfAbsent(key, value, ttlSec) {
    const r = await redis();
    if (!r) {
      if (memGet(key) !== null) return false;
      memSet(key, value, ttlSec);
      return true;
    }
    const res = ttlSec ? await r.set(key, value, "EX", ttlSec, "NX") : await r.set(key, value, "NX");
    return res === "OK";
  },
  async incr(key, ttlSec) {
    const r = await redis();
    if (!r) {
      const n = Number(memGet(key) ?? "0") + 1;
      memSet(key, String(n), ttlSec);
      return n;
    }
    const n = await r.incr(key);
    if (ttlSec && n === 1) await r.expire(key, ttlSec);
    return n;
  },
  async del(key) {
    const r = await redis();
    if (!r) {
      memory.delete(key);
      return;
    }
    await r.del(key);
  },
};

/** Test helper: a fresh in-memory KV with the same behaviour. */
export function createMemoryKv(): TaskKv {
  const m = new Map<string, string>();
  return {
    async get(k) {
      return m.get(k) ?? null;
    },
    async set(k, v) {
      m.set(k, v);
    },
    async setIfAbsent(k, v) {
      if (m.has(k)) return false;
      m.set(k, v);
      return true;
    },
    async incr(k) {
      const n = Number(m.get(k) ?? "0") + 1;
      m.set(k, String(n));
      return n;
    },
  };
}
