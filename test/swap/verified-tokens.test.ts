import { describe, it, expect } from "vitest";
import {
  isVerifiedBaseToken,
  VERIFIED_BASE_CRYPTO_TOKENS,
  AERO_BASE_ADDRESS,
} from "@/lib/swap/verified-tokens";
import { resolveSwapToken } from "@/lib/swap/token-metadata";
import { TOKENIZED_STOCKS_REGISTRY } from "@/lib/stocks/tokenized-stocks-registry";

describe("Verified Base Tokens & Blue Tick Engine", () => {
  it("verifies native ETH is always verified", () => {
    expect(isVerifiedBaseToken("eth")).toBe(true);
    expect(isVerifiedBaseToken("ETH")).toBe(true);
    expect(isVerifiedBaseToken({ kind: "eth" })).toBe(true);
    expect(isVerifiedBaseToken({ kind: "eth", isVerified: true })).toBe(true);
  });

  it("verifies AERO (Aerodrome) is verified by address and symbol", () => {
    expect(isVerifiedBaseToken(AERO_BASE_ADDRESS)).toBe(true);
    expect(isVerifiedBaseToken(AERO_BASE_ADDRESS.toLowerCase())).toBe(true);
    expect(isVerifiedBaseToken("AERO")).toBe(true);
    expect(isVerifiedBaseToken("aero")).toBe(true);
    expect(
      isVerifiedBaseToken({
        kind: "token",
        address: AERO_BASE_ADDRESS,
        symbol: "AERO",
        decimals: 18,
      })
    ).toBe(true);
  });

  it("verifies major Base crypto ecosystem tokens", () => {
    const symbols = ["USDC", "WETH", "cbBTC", "cbETH", "wstETH", "USDT", "DAI", "MORPHO", "DEGEN", "BRETT", "TOSHI", "VIRTUAL", "ZORA", "HIGHER", "AIXBT", "WELL", "AAVE"];
    for (const sym of symbols) {
      expect(isVerifiedBaseToken(sym)).toBe(true);
    }

    for (const token of VERIFIED_BASE_CRYPTO_TOKENS) {
      expect(isVerifiedBaseToken(token.address)).toBe(true);
      expect(isVerifiedBaseToken(token.symbol)).toBe(true);
    }
  });

  it("verifies all 32 Coinbase tokenized equities (RWAs)", () => {
    expect(TOKENIZED_STOCKS_REGISTRY.length).toBe(32);
    for (const stock of TOKENIZED_STOCKS_REGISTRY) {
      expect(isVerifiedBaseToken(stock.address)).toBe(true);
      expect(isVerifiedBaseToken(stock.symbol)).toBe(true);
      expect(isVerifiedBaseToken({ kind: "token", address: stock.address, symbol: stock.symbol, decimals: stock.decimals })).toBe(true);
    }
  });

  it("verifies any official B20 vanity token address prefix", () => {
    const sampleB20 = "0xb201234567890abcdef1234567890abcdef1234";
    expect(isVerifiedBaseToken(sampleB20)).toBe(true);
  });

  it("does not verify unknown or random contracts", () => {
    expect(isVerifiedBaseToken("0x0000000000000000000000000000000000000001")).toBe(false);
    expect(isVerifiedBaseToken("0x1234567890123456789012345678901234567890")).toBe(false);
    expect(isVerifiedBaseToken("RANDOM_SHITCOIN")).toBe(false);
    expect(isVerifiedBaseToken({ kind: "token", address: "0x1234567890123456789012345678901234567890", symbol: "FAKE", decimals: 18, isUnverified: true })).toBe(false);
  });

  it("resolveSwapToken resolves AERO as verified and NOT unverified", async () => {
    // Resolve by address
    const byAddr = await resolveSwapToken(AERO_BASE_ADDRESS);
    expect(byAddr).not.toBeNull();
    if (!byAddr?.counter) throw new Error("Expected byAddr.counter to be defined");
    expect(byAddr.isUnverified).toBe(false);
    expect(byAddr.counter.isVerified).toBe(true);
    expect(byAddr.counter.isUnverified).toBe(false);
    expect(byAddr.counter.kind).toBe("token");
    if (byAddr.counter.kind === "token") {
      expect(byAddr.counter.symbol).toBe("AERO");
    }

    // Resolve by symbol
    const bySym = await resolveSwapToken("AERO");
    expect(bySym).not.toBeNull();
    if (!bySym?.counter) throw new Error("Expected bySym.counter to be defined");
    expect(bySym.isUnverified).toBe(false);
    expect(bySym.counter.isVerified).toBe(true);
    expect(bySym.counter.isUnverified).toBe(false);
  });

  it("resolveSwapToken resolves Tokenized Stock NVDAc as verified and NOT unverified", async () => {
    const nvdac = TOKENIZED_STOCKS_REGISTRY.find((s) => s.symbol === "NVDAc")!;
    const res = await resolveSwapToken(nvdac.address);
    expect(res).not.toBeNull();
    if (!res?.counter) throw new Error("Expected res.counter to be defined");
    expect(res.isUnverified).toBe(false);
    expect(res.counter.isVerified).toBe(true);
    expect(res.counter.isUnverified).toBe(false);
  });
});
