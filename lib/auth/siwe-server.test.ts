import { describe, expect, it } from "vitest";
import { SiweMessage } from "siwe";
import { consumeNonce, issueSiweNonce, buildSiweMessage } from "@/lib/auth/siwe-server";

describe("siwe signed nonce", () => {
  it("issues alphanumeric hex nonce of length 40", () => {
    const nonce = issueSiweNonce();
    expect(nonce).toMatch(/^[0-9a-f]{40}$/);
  });

  it("accepts a freshly issued nonce once", async () => {
    const nonce = issueSiweNonce();
    expect(await consumeNonce(nonce)).toBe(true);
  });

  it("rejects a tampered nonce", async () => {
    const nonce = issueSiweNonce();
    const tampered = `${nonce.slice(0, 39)}${nonce[39] === "0" ? "1" : "0"}`;
    expect(await consumeNonce(tampered)).toBe(false);
  });

  it("builds SIWE message with request domain", () => {
    const nonce = issueSiweNonce();
    const msg = buildSiweMessage(
      "0xaBcDef1234567890123456789012345678901234",
      nonce,
      "base-analytics-app.vercel.app",
      "https://base-analytics-app.vercel.app"
    );
    expect(msg).toContain("base-analytics-app.vercel.app wants you to sign in");
    expect(msg).toContain("Chain ID: 8453");
    expect(msg).toContain(`Nonce: ${nonce}`);
    // Round-trip parse (rejects unicode em-dashes in statement)
    expect(() => new SiweMessage(msg)).not.toThrow();
  });
});
