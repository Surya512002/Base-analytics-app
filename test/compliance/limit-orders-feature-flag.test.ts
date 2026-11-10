import { describe, expect, it, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/limit-orders/region-check/route";
import {
  isLimitOrdersFeatureEnabled,
  isVercelPreview,
  isExplicitLimitOrdersEnabled,
} from "@/src/lib/limitOrders/featureFlag";

describe("G5: NEXT_PUBLIC_LIMIT_ORDERS_ENABLED Feature Flag Suite", () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origFlag = process.env.NEXT_PUBLIC_LIMIT_ORDERS_ENABLED;
  const origVercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;

  afterEach(() => {
    (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
    if (origFlag !== undefined) {
      process.env.NEXT_PUBLIC_LIMIT_ORDERS_ENABLED = origFlag;
    } else {
      delete process.env.NEXT_PUBLIC_LIMIT_ORDERS_ENABLED;
    }
    if (origVercelEnv !== undefined) {
      process.env.NEXT_PUBLIC_VERCEL_ENV = origVercelEnv;
    } else {
      delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    }
  });

  it("blocks API route in production when flag is unset or not 'true'", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.NEXT_PUBLIC_LIMIT_ORDERS_ENABLED;

    const req = new NextRequest("http://localhost:3000/api/limit-orders/region-check");
    const res = await GET(req);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Limit orders feature is disabled.");

    // Also test explicitly set to "false"
    process.env.NEXT_PUBLIC_LIMIT_ORDERS_ENABLED = "false";
    const resFalse = await GET(req);
    expect(resFalse.status).toBe(404);
  });

  it("allows API route in production when flag is explicitly 'true'", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.NEXT_PUBLIC_LIMIT_ORDERS_ENABLED = "true";

    // Request with valid European country (e.g. DE)
    const req = new NextRequest("http://localhost:3000/api/limit-orders/region-check", {
      headers: { "x-user-country": "DE" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.restricted).toBe(false);
    expect(data.country).toBe("DE");
  });

  it("allows API route in development/test regardless of flag", async () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    delete process.env.NEXT_PUBLIC_LIMIT_ORDERS_ENABLED;

    const req = new NextRequest("http://localhost:3000/api/limit-orders/region-check", {
      headers: { "x-user-country": "DE" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("evaluates isVercelPreview and isExplicitLimitOrdersEnabled helpers correctly", () => {
    // isVercelPreview
    delete process.env.NEXT_PUBLIC_VERCEL_ENV;
    expect(isVercelPreview()).toBe(false);
    expect(isVercelPreview({ vercelEnv: "preview" })).toBe(true);
    expect(isVercelPreview({ vercelEnv: "production" })).toBe(false);

    // isExplicitLimitOrdersEnabled
    delete process.env.NEXT_PUBLIC_LIMIT_ORDERS_ENABLED;
    expect(isExplicitLimitOrdersEnabled()).toBe(false);
    expect(isExplicitLimitOrdersEnabled({ limitOrdersEnabled: "true" })).toBe(true);
    expect(isExplicitLimitOrdersEnabled({ limitOrdersEnabled: "false" })).toBe(false);

    // isLimitOrdersFeatureEnabled
    expect(isLimitOrdersFeatureEnabled({ nodeEnv: "production", limitOrdersEnabled: "false" })).toBe(false);
    expect(isLimitOrdersFeatureEnabled({ nodeEnv: "production", limitOrdersEnabled: "true" })).toBe(true);
    expect(isLimitOrdersFeatureEnabled({ nodeEnv: "production", vercelEnv: "preview" })).toBe(true);
    expect(isLimitOrdersFeatureEnabled({ nodeEnv: "development" })).toBe(true);
  });
});
