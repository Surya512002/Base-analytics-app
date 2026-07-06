import { getAlchemyKeys } from "@/lib/constants/env";

export interface EnvAuditItem {
  key: string;
  ok: boolean;
  detail: string;
}

/** Server-side check that .env keys match what the code expects. */
export function auditServerEnv(): EnvAuditItem[] {
  const items: EnvAuditItem[] = [];

  const alchemyKeys = getAlchemyKeys();
  items.push({
    key: "ALCHEMY_API_KEYS / ALCHEMY_API_KEY / NEXT_PUBLIC_ALCHEMY_KEY",
    ok: alchemyKeys.length > 0,
    detail:
      alchemyKeys.length > 0
        ? `${alchemyKeys.length} key(s) loaded for parallel fetch`
        : "Missing — add ALCHEMY_API_KEYS=comma,separated,keys",
  });

  const basescan =
    process.env.BASESCAN_API_KEY ||
    process.env.NEXT_PUBLIC_BASESCAN_API_KEY ||
    process.env.BASESCAN_API_KEYS;
  items.push({
    key: "BASESCAN_API_KEY",
    ok: Boolean(basescan?.trim()),
    detail: basescan ? "Set" : "Optional but improves tx indexing speed",
  });

  const redis = process.env.KV_REDIS_URL?.trim();
  items.push({
    key: "KV_REDIS_URL",
    ok: Boolean(redis),
    detail: redis
      ? redis.includes("redislabs.com") && redis.startsWith("redis://")
        ? "Set (auto-upgrades to rediss:// for Redis Cloud TLS)"
        : "Set"
      : "Missing — wallet history won't persist between sessions",
  });

  items.push({
    key: "NEYNAR_API_KEY",
    ok: Boolean(process.env.NEYNAR_API_KEY?.trim()),
    detail: process.env.NEYNAR_API_KEY ? "Set" : "Optional — Farcaster analytics",
  });

  return items;
}

export function logEnvAuditOnce(): void {
  if (process.env.NODE_ENV !== "development") return;
  const g = globalThis as { __envAuditLogged?: boolean };
  if (g.__envAuditLogged) return;
  g.__envAuditLogged = true;

  const items = auditServerEnv();
  const missing = items.filter((i) => !i.ok && i.key.includes("ALCHEMY"));
  if (missing.length) {
    console.warn("[env audit] Missing required keys:", missing.map((m) => m.key).join(", "));
  } else {
    console.info(
      "[env audit]",
      items.map((i) => `${i.key}: ${i.detail}`).join(" · ")
    );
  }
}
