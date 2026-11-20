import { afterEach, describe, expect, it, vi } from "vitest";
import { dropsKv } from "./kv";
import { dropsStatus } from "./status";
import { createSessionToken } from "@/lib/auth/siwe-server";

const ADDR = "0x00000000000000000000000000000000000a11ce";

afterEach(() => vi.unstubAllEnvs());

function production(extra: Record<string, string> = {}) {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("VERCEL", "1");
  vi.stubEnv("NODE_ENV", "production");
  for (const k of ["KV_REDIS_URL", "REDIS_URL", "SIWE_SESSION_SECRET", "X402_FACILITATOR_PRIVATE_KEY", "VOUCHER_SECRETS_KEY", "DROPS_TICKET_SIGNER_KEY", "NEXT_PUBLIC_DROPS_CONTRACT"]) vi.stubEnv(k, "");
  for (const [k, v] of Object.entries(extra)) vi.stubEnv(k, v);
}

describe("production guards", () => {
  it("Drops storage refuses to fall back to per-process memory in production", async () => {
    production();
    await expect(dropsKv.get("k")).rejects.toThrow(/Redis/);
    await expect(dropsKv.set("k", "v")).rejects.toThrow(/Redis/);
    await expect(dropsKv.setIfAbsent("k", "v")).rejects.toThrow(/Redis/);
    await expect(dropsKv.incr("k")).rejects.toThrow(/Redis/);
  });

  it("Drops storage still works in memory for previews and local dev", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    for (const k of ["KV_REDIS_URL", "REDIS_URL"]) vi.stubEnv(k, "");
    await dropsKv.set("guard-test", "1", 5);
    expect(await dropsKv.get("guard-test")).toBe("1");
  });

  it("sign-in needs its own secret in production, never a wallet key or the Redis URL", () => {
    production({ X402_FACILITATOR_PRIVATE_KEY: `0x${"11".repeat(32)}`, KV_REDIS_URL: "rediss://user:pw@host:1" });
    expect(() => createSessionToken(ADDR)).toThrow(/SIWE_SESSION_SECRET/);
    production({ SIWE_SESSION_SECRET: "s".repeat(32) });
    expect(createSessionToken(ADDR)).toMatch(/\./);
  });

  it("the readiness check reports every missing piece, never throws, and never prints secret values", async () => {
    production({ KV_REDIS_URL: "rediss://user:supersecretpw@host:1" });
    const s = await dropsStatus();
    expect(s.ready).toBe(false);
    const failing = s.checks.filter((c) => !c.ok).map((c) => c.id);
    expect(failing).toEqual(expect.arrayContaining(["contract", "ticket_signer", "login_secret", "secrets_key", "storage"]));
    expect(JSON.stringify(s)).not.toContain("supersecretpw");
  });
});
