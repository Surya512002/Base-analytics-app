import { describe, expect, it } from "vitest";
import { auditServerEnv } from "@/lib/env-audit";

describe("auditServerEnv", () => {
  it("includes ZEROX_API_KEY in audit items", () => {
    const items = auditServerEnv();
    const zerox = items.find((i) => i.key === "ZEROX_API_KEY");
    expect(zerox).toBeDefined();
    expect(zerox?.detail).toMatch(/aggregator/i);
  });

  it("includes Redis and Alchemy keys", () => {
    const keys = auditServerEnv().map((i) => i.key);
    expect(keys).toContain("KV_REDIS_URL");
    expect(keys.some((k) => k.includes("ALCHEMY"))).toBe(true);
  });
});
