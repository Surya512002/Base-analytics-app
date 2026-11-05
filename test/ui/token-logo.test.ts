import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  getDeterministicTokenColor,
  getDeterministicTokenInitials,
  generateTokenPlaceholderSvg,
} from "@/lib/utils/token-color";
import { TOKENIZED_STOCKS_REGISTRY, getTokenizedStockBySymbol } from "@/lib/stocks/tokenized-stocks-registry";
import { SELF_HOSTED_LOGOS, tokenLogoUrl } from "@/lib/launchpad/token-logo";
import { getVerifiedTokenLogo, findVerifiedToken } from "@/lib/swap/verified-tokens";

describe("TokenLogo Fallback Chain & Deterministic Color Suite", () => {
  const ADDRESS_A = "0x833589fCD6eDb6E08f4c7C32D4f71bdA02913";
  const ADDRESS_B = "0x4200000000000000000000000000000000000006";

  describe("Deterministic Color & Palette Generation", () => {
    it("generates 100% deterministic colors for identical address seeds", () => {
      const p1 = getDeterministicTokenColor(ADDRESS_A);
      const p2 = getDeterministicTokenColor(ADDRESS_A);
      expect(p1.hue).toBe(p2.hue);
      expect(p1.bg).toBe(p2.bg);
      expect(p1.gradient).toBe(p2.gradient);
      expect(p1.text).toBe(p2.text);
    });

    it("is strictly case-insensitive for Ethereum/Base addresses", () => {
      const upper = getDeterministicTokenColor(ADDRESS_A);
      const lower = getDeterministicTokenColor(ADDRESS_A.toLowerCase());
      expect(upper.hue).toBe(lower.hue);
      expect(upper.bg).toBe(lower.bg);
      expect(upper.border).toBe(lower.border);
    });

    it("generates distinct hues for different addresses", () => {
      const pA = getDeterministicTokenColor(ADDRESS_A);
      const pB = getDeterministicTokenColor(ADDRESS_B);
      expect(pA.hue).not.toBe(pB.hue);
    });

    it("guarantees high-contrast readability with white text and balanced lightness", () => {
      const palette = getDeterministicTokenColor("0xb20000000000000000000078ee7ce2fe4908108c");
      expect(palette.text).toBe("#FFFFFF");
      expect(palette.bg).toMatch(/hsl\(\d+,\s*68%,\s*38%\)/);
      expect(palette.gradient).toContain("linear-gradient");
    });
  });

  describe("Deterministic Token Initials", () => {
    it("extracts 1-2 uppercase characters from clean symbols", () => {
      expect(getDeterministicTokenInitials("USDC")).toBe("US");
      expect(getDeterministicTokenInitials("WETH")).toBe("WE");
      expect(getDeterministicTokenInitials("cbBTC")).toBe("CB");
      expect(getDeterministicTokenInitials("A")).toBe("A");
    });

    it("strips special characters and symbols", () => {
      expect(getDeterministicTokenInitials("$NVDA")).toBe("NV");
      expect(getDeterministicTokenInitials("#ETH")).toBe("ET");
      expect(getDeterministicTokenInitials("")).toBe("TK");
      expect(getDeterministicTokenInitials(null)).toBe("TK");
    });
  });

  describe("Deterministic Placeholder SVG Generator", () => {
    it("generates well-formed, valid SVG markup with dimensions and styles", () => {
      const svg = generateTokenPlaceholderSvg(ADDRESS_A, "USDC", 64);
      expect(svg).toContain("<svg");
      expect(svg).toContain('width="64"');
      expect(svg).toContain('height="64"');
      expect(svg).toContain("<circle");
      expect(svg).toContain("<text");
      expect(svg).toContain("US");
      expect(svg).toContain("</svg>");
    });

    it("properly neutralizes special characters to prevent XSS", () => {
      const svg = generateTokenPlaceholderSvg("0x123", "<script>alert(1)</script>", 32);
      expect(svg).not.toContain("<script>");
      expect(svg).not.toContain("alert");
      expect(svg).toContain(">SC<");
    });
  });

  describe("Self-Hosted Asset Presence (Sources a & b)", () => {
    it("verifies all canonical Base assets exist in /public/tokens/", () => {
      const canonical = [
        "0x0000000000000000000000000000000000000000", // ETH
        "0x4200000000000000000000000000000000000006", // WETH
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
        "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf", // cbBTC
        "0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22", // cbETH
        "0x940181a94a35a4569e4529a3cdfb74e38fd98631", // AERO
        "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", // DAI
      ];

      for (const addr of canonical) {
        const filePath = resolve(process.cwd(), `public/tokens/${addr}.png`);
        expect(existsSync(filePath), `Missing self-hosted token asset for ${addr}`).toBe(true);
      }
    });

    it("verifies all tokenized stock registry tokens have valid logo URLs or ticker badges", () => {
      expect(TOKENIZED_STOCKS_REGISTRY.length).toBeGreaterThanOrEqual(250);

      for (const stock of TOKENIZED_STOCKS_REGISTRY) {
        expect(stock.logo).toBeTruthy();
        expect(stock.logo!.startsWith("/") || stock.logo!.startsWith("https://")).toBe(true);
      }
    });

    it("verifies all 265 tokenized stocks are registered in SELF_HOSTED_LOGOS", () => {
      for (const stock of TOKENIZED_STOCKS_REGISTRY) {
        const lower = stock.address.toLowerCase();
        expect(SELF_HOSTED_LOGOS.has(lower), `Stock ${stock.symbol} (${lower}) should be in SELF_HOSTED_LOGOS`).toBe(true);
        const localPath = resolve(process.cwd(), `public/tokens/${lower}.png`);
        expect(existsSync(localPath), `Stock PNG for ${stock.symbol} must exist on disk`).toBe(true);
      }
    });
  });

  describe("Verified Token & Stock Resolution Suite", () => {
    it("resolves verified crypto tokens by symbol and address", () => {
      const usdc = findVerifiedToken("USDC");
      expect(usdc).not.toBeNull();
      expect(usdc?.symbol).toBe("USDC");
      expect(getVerifiedTokenLogo("USDC")).toBeTruthy();

      const aero = findVerifiedToken("0x940181a94a35a4569e4529a3cdfb74e38fd98631");
      expect(aero).not.toBeNull();
      expect(aero?.symbol).toBe("AERO");
      expect(getVerifiedTokenLogo("0x940181a94a35a4569e4529a3cdfb74e38fd98631")).toBeTruthy();
    });

    it("resolves tokenLogoUrl correctly for stocks and native assets", () => {
      expect(tokenLogoUrl("ETH")).toBe("/tokens/0x0000000000000000000000000000000000000000.png");
      expect(tokenLogoUrl("0x0000000000000000000000000000000000000000")).toBe(
        "/tokens/0x0000000000000000000000000000000000000000.png"
      );

      // Stock address resolves directly to local PNG
      const nvdaStock = getTokenizedStockBySymbol("NVDAc");
      expect(nvdaStock).toBeDefined();
      expect(tokenLogoUrl(nvdaStock!.address)).toBe(`/tokens/${nvdaStock!.address.toLowerCase()}.png`);
    });

    it("resolves compound stock tickers properly", () => {
      const nvdaFromClean = getTokenizedStockBySymbol("NVDAc");
      const nvdaFromPlain = getTokenizedStockBySymbol("NVDA");
      expect(nvdaFromClean).toBeDefined();
      expect(nvdaFromPlain).toBeDefined();
      expect(nvdaFromClean?.address).toBe(nvdaFromPlain?.address);
    });
  });
});
