import { getAlchemyKey } from "@/lib/constants/env";
import { zeroXConfigured } from "@/lib/launchpad/zerox";

export interface EnvAuditItem {
  key: string;
  ok: boolean;
  detail: string;
  required?: boolean;
}

/** Server-side check that .env keys match what the code expects. */
export function auditServerEnv(): EnvAuditItem[] {
  const items: EnvAuditItem[] = [];
  const isProd = process.env.NODE_ENV === "production";

  const alchemyKey = getAlchemyKey();
  items.push({
    key: "ALCHEMY_API_KEY / NEXT_PUBLIC_ALCHEMY_KEY",
    ok: Boolean(alchemyKey),
    required: true,
    detail: alchemyKey ? "Set" : "Missing — add ALCHEMY_API_KEY and NEXT_PUBLIC_ALCHEMY_KEY",
  });

  const basescan =
    process.env.BASESCAN_API_KEY ||
    process.env.NEXT_PUBLIC_BASESCAN_API_KEY ||
    process.env.BASESCAN_API_KEYS;
  items.push({
    key: "BASESCAN_API_KEY",
    ok: Boolean(basescan?.trim()),
    detail: basescan ? "Set" : "Optional — holder list uses Blockscout fallback",
  });

  const redis = process.env.KV_REDIS_URL?.trim();
  items.push({
    key: "KV_REDIS_URL",
    ok: Boolean(redis),
    required: isProd,
    detail: redis
      ? redis.includes("redislabs.com") && redis.startsWith("redis://")
        ? "Set (auto-upgrades to rediss:// for Redis Cloud TLS)"
        : "Set"
      : "Missing — wallet history won't persist between sessions",
  });

  items.push({
    key: "ZEROX_API_KEY",
    ok: zeroXConfigured(),
    required: isProd,
    detail: zeroXConfigured()
      ? "Set — aggregator swap fallback enabled"
      : isProd
        ? "Missing in production — USDC/token swaps may fail without direct pools"
        : "Optional locally — enables 0x aggregator fallback",
  });

  items.push({
    key: "NEYNAR_API_KEY",
    ok: Boolean(process.env.NEYNAR_API_KEY?.trim()),
    detail: process.env.NEYNAR_API_KEY
      ? "Set"
      : "Optional — Farcaster analytics + webhook verification",
  });

  items.push({
    key: "BASE_DASHBOARD_API_KEY",
    ok: Boolean(
      process.env.BASE_DASHBOARD_API_KEY?.trim() ||
        process.env.BASE_NOTIFICATIONS_API_KEY?.trim()
    ),
    detail:
      process.env.BASE_DASHBOARD_API_KEY || process.env.BASE_NOTIFICATIONS_API_KEY
        ? "Set — Base App push notifications enabled"
        : "Optional — price alerts and launch broadcasts need this",
  });

  return items;
}

export function logEnvAuditOnce(): void {
  if (process.env.NODE_ENV !== "development") return;
  const g = globalThis as { __envAuditLogged?: boolean };
  if (g.__envAuditLogged) return;
  g.__envAuditLogged = true;

  const items = auditServerEnv();
  const missing = items.filter((i) => !i.ok && i.required);
  if (missing.length) {
    console.warn(
      "[env audit] Missing required keys:",
      missing.map((m) => m.key).join(", ")
    );
  } else {
    console.info(
      "[env audit]",
      items.map((i) => `${i.key}: ${i.detail}`).join(" · ")
    );
  }
}
