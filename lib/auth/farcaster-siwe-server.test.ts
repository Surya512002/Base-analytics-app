import { describe, expect, it } from "vitest";
import { farcasterAuthDomains } from "@/lib/auth/farcaster-siwe-server";

describe("farcasterAuthDomains", () => {
  it("includes request host and strips www", () => {
    const domains = farcasterAuthDomains("www.example.com");
    expect(domains).toContain("www.example.com");
    expect(domains).toContain("example.com");
  });

  it("includes app hostname even without request host", () => {
    const domains = farcasterAuthDomains(null);
    expect(domains.length).toBeGreaterThan(0);
  });
});
