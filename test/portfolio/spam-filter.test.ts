import { describe, it, expect } from "vitest";
import { evaluateTokenSpam, sanitizeTokenString } from "@/lib/portfolio/spam-filter";

describe("Portfolio Spam & Phishing Filter Rules", () => {
  it("flags tokens containing phishing web domains in symbol or name", () => {
    const scam1 = evaluateTokenSpam({
      name: "Claim Rewards",
      symbol: "CLAIM-NOW.COM",
    });
    expect(scam1.isSpam).toBe(true);
    expect(scam1.reason).toContain("domain");

    const scam2 = evaluateTokenSpam({
      name: "Visit BaseAirdrop.xyz to claim",
      symbol: "AIRDROP",
    });
    expect(scam2.isSpam).toBe(true);

    const scam3 = evaluateTokenSpam({
      name: "https://t.me/free_base_tokens",
      symbol: "FREE",
    });
    expect(scam3.isSpam).toBe(true);
    expect(scam3.reason).toContain("URL");
  });

  it("flags scam action keywords (claim, voucher, winner, presale)", () => {
    const token = evaluateTokenSpam({
      name: "Winner Voucher Promo",
      symbol: "VOUCHER",
    });
    expect(token.isSpam).toBe(true);
    expect(token.reason).toContain("keywords");
  });

  it("flags tokens explicitly marked as spam by indexer", () => {
    const token = evaluateTokenSpam({
      name: "Random Coin",
      symbol: "RND",
      isFlaggedSpam: true,
    });
    expect(token.isSpam).toBe(true);
    expect(token.reason).toContain("indexer");
  });

  it("does NOT flag legitimate tokens like USDC, NVDAc, AERO, or Ether", () => {
    const usdc = evaluateTokenSpam({
      name: "USD Coin",
      symbol: "USDC",
      hasPool: true,
      liquidityUsd: 50_000_000,
    });
    expect(usdc.isSpam).toBe(false);

    const nvdac = evaluateTokenSpam({
      name: "NVIDIA Corp (Tokenized)",
      symbol: "NVDAc",
      hasPool: true,
      liquidityUsd: 1_200_000,
    });
    expect(nvdac.isSpam).toBe(false);

    const aero = evaluateTokenSpam({
      name: "Aerodrome",
      symbol: "AERO",
      hasPool: true,
      liquidityUsd: 25_000_000,
    });
    expect(aero.isSpam).toBe(false);
  });

  it("sanitizes token names safely, stripping HTML tags and zero-width characters", () => {
    const malicious = "<script>alert('hack')</script><b>Base</b>\u200B Coin";
    const clean = sanitizeTokenString(malicious, 32);
    expect(clean).toBe("alert('hack')Base Coin");
    expect(clean).not.toContain("<script>");
    expect(clean).not.toContain("<b>");

    const longString = "A".repeat(100);
    const truncated = sanitizeTokenString(longString, 20);
    expect(truncated.length).toBe(20);
    expect(truncated.endsWith("…")).toBe(true);
  });
});
