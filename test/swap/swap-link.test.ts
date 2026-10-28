import { describe, expect, it } from "vitest";
import {
  buildSwapLink,
  parseSwapUrlParams,
  normalizeTokenAddress,
} from "@/lib/swap/swap-link";
import {
  getStockTradability,
  getAllStocksTradability,
} from "@/lib/stocks/stock-tradability";
import { TOKENIZED_STOCKS_REGISTRY } from "@/lib/stocks/tokenized-stocks-registry";
import { resolveSwapToken } from "@/lib/swap/token-metadata";

describe("Swap URL Contract & Link Helpers (Part 1)", () => {
  const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  const MSFTC = "0xB200000000000000000000Ab99cFa739E253872B";
  const AAPLC = "0xb200000000000000000000C2e324d24d7eEcd1fb";

  it("builds link with buy token only", () => {
    const link = buildSwapLink({ buy: MSFTC });
    expect(link).toBe(`/swap?buy=${MSFTC.toLowerCase()}`);
  });

  it("builds link with sell token only", () => {
    const link = buildSwapLink({ sell: USDC });
    expect(link).toBe(`/swap?sell=${USDC.toLowerCase()}`);
  });

  it("builds link with both buy and sell tokens and optional amount", () => {
    const link = buildSwapLink({ buy: MSFTC, sell: USDC, amount: "10.5" });
    expect(link).toBe(
      `/swap?buy=${MSFTC.toLowerCase()}&sell=${USDC.toLowerCase()}&amount=10.5`
    );
  });

  it("handles native ETH sentinel properly", () => {
    const link = buildSwapLink({ buy: "eth", sell: USDC });
    expect(link).toBe(`/swap?buy=eth&sell=${USDC.toLowerCase()}`);
  });

  it("parses empty and root URLs without errors", () => {
    const parsed = parseSwapUrlParams("/swap");
    expect(parsed.buy).toBeNull();
    expect(parsed.sell).toBeNull();
    expect(parsed.amount).toBeNull();
  });

  it("parses buy, sell, and amount from query string", () => {
    const parsed = parseSwapUrlParams(
      `?buy=${AAPLC.toLowerCase()}&sell=${USDC.toLowerCase()}&amount=50`
    );
    expect(parsed.buy).toBe(AAPLC.toLowerCase());
    expect(parsed.sell).toBe(USDC.toLowerCase());
    expect(parsed.amount).toBe("50");
  });

  it("resolves duplicate token conflicts (buy === sell)", () => {
    // If user passes same address for both buy and sell
    const parsed = parseSwapUrlParams(
      `?buy=${MSFTC.toLowerCase()}&sell=${MSFTC.toLowerCase()}`
    );
    expect(parsed.buy).toBe(MSFTC.toLowerCase());
    // Sell should automatically fall back to ETH
    expect(parsed.sell).toBe("eth");

    // If both are ETH
    const parsedEth = parseSwapUrlParams("?buy=eth&sell=eth");
    expect(parsedEth.buy).toBe("eth");
    expect(parsedEth.sell).toBe("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"); // USDC
  });

  it("filters out invalid address formats", () => {
    const parsed = parseSwapUrlParams("?buy=not-an-address&sell=0x123&amount=abc");
    expect(parsed.buy).toBeNull();
    expect(parsed.sell).toBeNull();
    expect(parsed.amount).toBeNull();
  });

  it("normalizes addresses to lowercase", () => {
    expect(normalizeTokenAddress(MSFTC)).toBe(MSFTC.toLowerCase());
    expect(normalizeTokenAddress("ETH")).toBe("eth");
    expect(normalizeTokenAddress("invalid")).toBeNull();
  });
});

describe("Tokenized Stocks Tradability Classifier (Part 2)", () => {
  it("verifies registry contains all 32 stocks", () => {
    expect(TOKENIZED_STOCKS_REGISTRY.length).toBe(32);
    const all = getAllStocksTradability();
    expect(all.length).toBe(32);
  });

  it("identifies stocks with verified DEX pools as tradable", () => {
    const msft = getStockTradability("MSFTc");
    expect(msft.status).toBe("tradable");
    expect(msft.hasPool).toBe(true);
    expect(msft.dexVenues).toContain("Uniswap V3");

    const aapl = getStockTradability("AAPLc");
    expect(aapl.status).toBe("tradable");
    expect(aapl.hasPool).toBe(true);

    const nvda = getStockTradability("NVDAc");
    expect(nvda.status).toBe("tradable");
  });

  it("identifies stocks with low liquidity pools as low_liquidity with warn & BaseScan link", () => {
    const tsla = getStockTradability("TSLAc");
    expect(tsla.status).toBe("low_liquidity");
    expect(tsla.hasPool).toBe(true);
    expect(tsla.suggestedAction?.url).toContain("basescan.org/token/");

    const mstr = getStockTradability("MSTRc");
    expect(mstr.status).toBe("low_liquidity");
    expect(mstr.hasPool).toBe(true);

    const pltr = getStockTradability("PLTRc");
    expect(pltr.status).toBe("low_liquidity");
    expect(pltr.hasPool).toBe(true);
  });

  it("identifies stocks without DEX pools as no_pool with Lend & Stake action", () => {
    const coin = getStockTradability("COINc");
    expect(coin.status).toBe("no_pool");
    expect(coin.hasPool).toBe(false);
    expect(coin.suggestedAction?.tab).toBe("lend");
    expect(coin.suggestedAction?.url).toContain("basescan.org/token/");

    const intc = getStockTradability("INTCc");
    expect(intc.status).toBe("no_pool");
    expect(intc.hasPool).toBe(false);
  });

  it("handles unknown or unsupported assets gracefully", () => {
    const unknown = getStockTradability("0x000000000000000000000000000000000000dead");
    expect(unknown.status).toBe("unsupported");
    expect(unknown.hasPool).toBe(false);
  });
});

describe("Token Metadata Fetcher (Part 1)", () => {
  it("resolves native ETH instantly without network calls", async () => {
    const res = await resolveSwapToken("eth");
    expect(res.counter?.kind).toBe("eth");
    expect(res.isUnverified).toBe(false);
  });

  it("resolves curated tokens (USDC, WETH) from local registry without network calls", async () => {
    const res = await resolveSwapToken("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(res.counter?.kind).toBe("token");
    if (res.counter?.kind === "token") {
      expect(res.counter.symbol).toBe("USDC");
      expect(res.counter.decimals).toBe(6);
    }
    expect(res.isUnverified).toBe(false);
  });

  it("resolves tokenized stocks (MSFTc) with 8 decimals from registry", async () => {
    const res = await resolveSwapToken("0xB200000000000000000000Ab99cFa739E253872B");
    expect(res.counter?.kind).toBe("token");
    if (res.counter?.kind === "token") {
      expect(res.counter.symbol).toBe("MSFTc");
      expect(res.counter.decimals).toBe(8);
    }
    expect(res.isUnverified).toBe(false);
  });

  it("returns error for invalid address format", async () => {
    const res = await resolveSwapToken("0xinvalid");
    expect(res.counter).toBeNull();
    expect(res.error).toBeDefined();
  });
});

describe("Stock Compliance & Jurisdiction Policy (Part 4)", () => {
  it("provides neutral compliance notice with official issuer terms link", async () => {
    const { DEFAULT_STOCK_COMPLIANCE, checkJurisdictionEligibility } = await import(
      "@/lib/stocks/compliance"
    );

    expect(DEFAULT_STOCK_COMPLIANCE.issuerTermsUrl).toContain("coinbase.com/legal");
    expect(DEFAULT_STOCK_COMPLIANCE.neutralNotice).toContain("location");
    expect(DEFAULT_STOCK_COMPLIANCE.marketHoursNotice).toContain("24/7 on Base AMMs");

    // Eligible region (non-restricted)
    const deResult = checkJurisdictionEligibility("DE");
    expect(deResult.isRestricted).toBe(false);
    expect(deResult.shouldBlock).toBe(false);

    // Restricted region (e.g. US)
    const usResult = checkJurisdictionEligibility("US");
    expect(usResult.isRestricted).toBe(true);
    // Non-blocking by default unless geoBlockEnabled is set
    expect(usResult.shouldBlock).toBe(false);
  });
});
