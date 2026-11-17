import { afterEach, describe, expect, it, vi } from "vitest";
import { trustedCountryFromHeaders } from "@/lib/compliance/request-country";
import { x402PolicyViolation, X402_USDC } from "@/lib/x402-policy";
import { sniffImageMime } from "@/lib/launchpad/image-sniff";
import { APP_TREASURY } from "@/lib/constants/treasury";

const h = (o: Record<string, string>) => new Headers(o);

describe("trustedCountryFromHeaders", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the platform header", () => {
    expect(trustedCountryFromHeaders(h({ "x-vercel-ip-country": "us" }))).toBe("US");
  });

  it("ignores client-sendable headers on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    expect(trustedCountryFromHeaders(h({ "x-mock-country": "DE", "cf-ipcountry": "DE", "x-user-country": "DE" }))).toBeNull();
    // ...and a spoofed header can't override the real one.
    expect(trustedCountryFromHeaders(h({ "x-vercel-ip-country": "US", "x-mock-country": "DE" }))).toBe("US");
  });

  it("still allows mock countries in local dev / tests", () => {
    vi.stubEnv("VERCEL", "");
    expect(trustedCountryFromHeaders(h({ "x-mock-country": "de" }))).toBe("DE");
  });
});

describe("x402PolicyViolation", () => {
  const ok = { scheme: "exact", network: "eip155:8453", asset: X402_USDC, payTo: APP_TREASURY, amount: "50000" };

  it("accepts USDC payments to the app treasury", () => {
    expect(x402PolicyViolation(ok)).toBeNull();
    expect(x402PolicyViolation({ ...ok, amount: undefined, maxAmountRequired: "50000" })).toBeNull();
  });

  it("refuses anything that would make our hot wallet pay gas for someone else", () => {
    expect(x402PolicyViolation({ ...ok, payTo: "0x000000000000000000000000000000000000dEaD" })).toMatch(/payee/);
    expect(x402PolicyViolation({ ...ok, asset: "0x4200000000000000000000000000000000000006" })).toMatch(/asset/);
    expect(x402PolicyViolation({ ...ok, network: "eip155:1" })).toMatch(/network/);
    expect(x402PolicyViolation({ ...ok, scheme: "upto" })).toMatch(/scheme/);
    expect(x402PolicyViolation({ ...ok, amount: "1" })).toMatch(/bounds/);
    expect(x402PolicyViolation({ ...ok, amount: "999999999999" })).toMatch(/bounds/);
    expect(x402PolicyViolation({ ...ok, amount: "lots" })).toMatch(/invalid/);
    expect(x402PolicyViolation(null)).toMatch(/missing/);
  });
});

describe("sniffImageMime", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
  it("recognises raster images by their bytes", () => {
    expect(sniffImageMime(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImageMime(bytes(0xff, 0xd8, 0xff))).toBe("image/jpeg");
    expect(sniffImageMime(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe("image/gif");
    expect(sniffImageMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
  });
  it("rejects SVG / HTML posing as an image", () => {
    const enc = new TextEncoder();
    expect(sniffImageMime(enc.encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffImageMime(enc.encode("<html><script>alert(1)</script></html>"))).toBeNull();
  });
});
