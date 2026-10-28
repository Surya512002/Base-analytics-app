import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

describe("Edge Middleware Geolocation & Header Injection Suite", () => {
  it("detects country from x-vercel-ip-country and allows permitted region", () => {
    const req = new NextRequest("http://localhost:3000/api/stocks", {
      headers: {
        "x-vercel-ip-country": "DE",
      },
    });

    const res = middleware(req);
    expect(res.headers.get("x-compliance-restricted")).toBe("false");
    expect(res.headers.get("x-compliance-mode")).toBe("full");
  });

  it("detects restricted country (US) and enforces exit-only mode", () => {
    const req = new NextRequest("http://localhost:3000/api/stocks", {
      headers: {
        "x-vercel-ip-country": "US",
      },
    });

    const res = middleware(req);
    expect(res.headers.get("x-compliance-restricted")).toBe("true");
    expect(res.headers.get("x-compliance-mode")).toBe("exit-only");
  });

  it("supports cf-ipcountry fallback header", () => {
    const req = new NextRequest("http://localhost:3000/api/stocks", {
      headers: {
        "cf-ipcountry": "GB",
      },
    });

    const res = middleware(req);
    expect(res.headers.get("x-compliance-restricted")).toBe("false");
    expect(res.headers.get("x-compliance-mode")).toBe("full");
  });

  it("supports x-mock-country for testing and simulation", () => {
    const req = new NextRequest("http://localhost:3000/api/stocks", {
      headers: {
        "x-mock-country": "IR", // Iran
      },
    });

    const res = middleware(req);
    expect(res.headers.get("x-compliance-restricted")).toBe("true");
    expect(res.headers.get("x-compliance-mode")).toBe("exit-only");
  });

  it("fails safe when no geolocation header is present", () => {
    const req = new NextRequest("http://localhost:3000/api/stocks");
    const res = middleware(req);
    // Safe fallback restricts entry while allowing exit
    expect(res.headers.get("x-compliance-restricted")).toBe("true");
    expect(res.headers.get("x-compliance-mode")).toBe("exit-only");
  });
});
