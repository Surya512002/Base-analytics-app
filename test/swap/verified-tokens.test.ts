import { describe, it, expect } from "vitest";
import {
  isVerifiedBaseToken,
  VERIFIED_BASE_CRYPTO_TOKENS,
  AERO_BASE_ADDRESS,
  ALL_VERIFIED_BASE_TOKENS,
  searchVerifiedTokens,
  findVerifiedToken,
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

  it("verifies all 250+ Base tokenized stocks from official registry have verified blue tick", () => {
    expect(TOKENIZED_STOCKS_REGISTRY.length).toBeGreaterThanOrEqual(250);
    for (const stock of TOKENIZED_STOCKS_REGISTRY) {
      expect(isVerifiedBaseToken(stock.address)).toBe(true);
      expect(isVerifiedBaseToken(stock.symbol)).toBe(true);
      expect(isVerifiedBaseToken({ kind: "token", address: stock.address, symbol: stock.symbol, decimals: stock.decimals })).toBe(true);
    }
  });

  it("does NOT give verified blue tick to newly launched coins or arbitrary B20 vanity tokens", () => {
    const newlyLaunchedB20 = "0xb201234567890abcdef1234567890abcdef1234";
    expect(isVerifiedBaseToken(newlyLaunchedB20)).toBe(false);
    expect(isVerifiedBaseToken({ kind: "token", address: newlyLaunchedB20, symbol: "NEWCOIN", decimals: 18 })).toBe(false);
  });

  it("does not verify unknown or random contracts even if they spoof a bluechip symbol", () => {
    expect(isVerifiedBaseToken("0x0000000000000000000000000000000000000001")).toBe(false);
    expect(isVerifiedBaseToken("0x1234567890123456789012345678901234567890")).toBe(false);
    expect(isVerifiedBaseToken("RANDOM_SHITCOIN")).toBe(false);
    expect(isVerifiedBaseToken({ kind: "token", address: "0x1234567890123456789012345678901234567890", symbol: "FAKE", decimals: 18, isUnverified: true })).toBe(false);

    // Spoofed symbol with fake address
    expect(isVerifiedBaseToken({ kind: "token", address: "0x1111111111111111111111111111111111111111", symbol: "USDC", decimals: 6 })).toBe(false);
    expect(isVerifiedBaseToken({ kind: "token", address: "0x2222222222222222222222222222222222222222", symbol: "NVDAc", decimals: 18 })).toBe(false);
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

  it("verifies comprehensive Base tokens registry has 3,000+ tokens matching Coinbase Wallet", () => {
    expect(ALL_VERIFIED_BASE_TOKENS.length).toBeGreaterThan(3000);

    // Verify widely traded Base ecosystem tokens have blue tick verification
    expect(isVerifiedBaseToken("CLANKER")).toBe(true);
    expect(isVerifiedBaseToken("PEPE")).toBe(true);
    expect(isVerifiedBaseToken("CBDOGE")).toBe(true);
    expect(isVerifiedBaseToken("SHIB")).toBe(true);
    expect(isVerifiedBaseToken("MFER")).toBe(true);
    expect(isVerifiedBaseToken("TYBG")).toBe(true);

    // Check search functionality
    const clankerMatches = searchVerifiedTokens("clanker", 5);
    expect(clankerMatches.length).toBeGreaterThan(0);
    expect(clankerMatches[0].symbol.toUpperCase()).toBe("CLANKER");

    const pepeMatches = searchVerifiedTokens("pepe", 5);
    expect(pepeMatches.length).toBeGreaterThan(0);

    // Check find by address
    const clankerAddr = "0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb";
    const found = findVerifiedToken(clankerAddr);
    expect(found).toBeDefined();
    expect(found?.symbol).toBe("CLANKER");
  });

  it("resolveSwapToken resolves CLANKER from 3,100+ verified registry without RPC errors", async () => {
    const clankerAddr = "0x1bc0c42215582d5A085795f4baDbaC3ff36d1Bcb";
    const res = await resolveSwapToken(clankerAddr);
    expect(res).not.toBeNull();
    if (!res?.counter) throw new Error("Expected res.counter to be defined");
    expect(res.isUnverified).toBe(false);
    expect(res.counter.isVerified).toBe(true);
    expect(res.counter.isUnverified).toBe(false);
    if (res.counter.kind === "token") {
      expect(res.counter.symbol).toBe("CLANKER");
    }
  });
});
