import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  issueSiweNonce,
  consumeNonce,
  buildSiweMessage,
  createSessionToken,
  parseSessionToken,
  resolveSiweDomain,
} from "@/lib/auth/siwe-server";

describe("SIWE Server Authentication", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("issues and consumes nonces without throwing in production without SIWE_SESSION_SECRET", async () => {
    delete process.env.SIWE_SESSION_SECRET;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    const nonce = issueSiweNonce();
    expect(nonce).toBeDefined();
    expect(nonce.length).toBe(40);

    const valid = await consumeNonce(nonce);
    expect(valid).toBe(true);

    // Cannot consume the same nonce twice
    const replay = await consumeNonce(nonce);
    expect(replay).toBe(false);
  });

  it("creates and parses session tokens seamlessly in production", () => {
    delete process.env.SIWE_SESSION_SECRET;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    const address = "0x379965158ff8a1762e5daefae48455aa21f7dfae";
    const token = createSessionToken(address);
    expect(token).toBeDefined();
    expect(token.includes(".")).toBe(true);

    const parsed = parseSessionToken(token);
    expect(parsed).toBe(address.toLowerCase());
  });

  it("rejects tampered session tokens", () => {
    const address = "0x379965158ff8a1762e5daefae48455aa21f7dfae";
    const token = createSessionToken(address);
    const tampered = token.slice(0, -4) + "abcd";

    const parsed = parseSessionToken(tampered);
    expect(parsed).toBeNull();
  });

  it("builds a valid EIP-4361 SIWE message", () => {
    const address = "0x379965158ff8a1762e5daefae48455aa21f7dfae";
    const nonce = issueSiweNonce();
    const msg = buildSiweMessage(address, nonce, "base-analytics-app.vercel.app", "https://base-analytics-app.vercel.app");

    expect(msg).toContain("base-analytics-app.vercel.app wants you to sign in with your Ethereum account:");
    expect(msg.toLowerCase()).toContain(address.toLowerCase());
    expect(msg).toContain(`Nonce: ${nonce}`);
    expect(msg).toContain("Chain ID: 8453");
  });

  it("resolves SIWE domain cleanly from request headers or app default", () => {
    expect(resolveSiweDomain("base-analytics-app.vercel.app:443")).toBe("base-analytics-app.vercel.app");
    expect(resolveSiweDomain("localhost:3000")).toBe("localhost:3000");
    expect(resolveSiweDomain(null)).toBeDefined();
  });
});
