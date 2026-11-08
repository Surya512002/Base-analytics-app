import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/limit-orders/region-check/route";

describe("G5: NEXT_PUBLIC_LIMIT_ORDERS_ENABLED Feature Flag Suite", () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origFlag = process.env.NEXT_PUBLIC_LIMIT_ORDERS_ENABLED;

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
    if (origFlag !== undefined) {
      process.env.NEXT_PUBLIC_LIMIT_ORDERS_ENABLED = origFlag;
    } else {
      delete process.env.NEXT_PUBLIC_LIMIT_ORDERS_ENABLED;
    }
  });

  it("blocks API route in production when flag is unset or not 'true'", async () => {
    process.env.NODE_ENV = "production";
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
    process.env.NODE_ENV = "production";
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
    process.env.NODE_ENV = "development";
    delete process.env.NEXT_PUBLIC_LIMIT_ORDERS_ENABLED;

    const req = new NextRequest("http://localhost:3000/api/limit-orders/region-check", {
      headers: { "x-user-country": "DE" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
