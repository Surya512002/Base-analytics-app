import { describe, expect, it } from "vitest";
import { farcasterAuthDomains } from "@/lib/auth/farcaster-siwe-server";

describe("farcasterAuthDomains", () => {
  it("includes the request host (with and without www) and our production domains", () => {
    const domains = farcasterAuthDomains("www.example.com", "app.example.com");
    expect(domains).toContain("www.example.com");
    expect(domains).toContain("example.com");
    expect(domains).toContain("baseanalytics.app");
  });

  it("never trusts a domain the browser reports", () => {
    expect(farcasterAuthDomains("baseanalytics.app", "evil.example")).not.toContain("evil.example");
  });

  it("includes app hostname even without request host", () => {
    const domains = farcasterAuthDomains(null);
    expect(domains.length).toBeGreaterThan(0);
  });
});
