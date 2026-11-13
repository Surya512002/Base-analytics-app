import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SwapPortfolio from "@/components/swap/SwapPortfolio";
import type { PortfolioToken } from "@/lib/portfolio/types";

const tok = (symbol: string, usdValue: number, extra: Partial<PortfolioToken> = {}): PortfolioToken => ({
  address: ("0x" + symbol.toLowerCase().padEnd(40, "0").slice(0, 40)) as `0x${string}`,
  symbol,
  name: symbol,
  decimals: 18,
  balanceRaw: "1",
  balanceFormatted: "1.0",
  balance: 1,
  balanceNumber: 1,
  priceUsd: usdValue,
  priceSource: "dexscreener" as PortfolioToken["priceSource"],
  usdValue,
  priceChange24h: 10,
  logo: null,
  isSpam: false,
  isVerified: true,
  isStock: false,
  isB20: false,
  hasTradeRoute: true,
  counter: { kind: "token", address: "0x" + symbol.toLowerCase().padEnd(40, "0").slice(0, 40), symbol, decimals: 18 },
  ...extra,
});

const noop = () => {};
const render = (tokens: PortfolioToken[], connected = true) =>
  renderToStaticMarkup(
    createElement(SwapPortfolio, {
      tokens,
      totalUsd: tokens.reduce((s, t) => s + t.usdValue, 0),
      loading: false,
      connected,
      onSell: noop,
      onBuy: noop,
      onOpenAll: noop,
    })
  );

describe("swap portfolio", () => {
  it("lists holdings by value with sell / buy actions and hides spam", () => {
    const html = render([tok("AERO", 50), tok("USDC", 150), tok("SCAM", 999, { isSpam: true })]);
    expect(html).toContain("Your portfolio");
    expect(html.indexOf("USDC")).toBeLessThan(html.indexOf("AERO"));
    expect(html).not.toContain("SCAM");
    expect(html).toContain("Sell AERO");
    expect(html).toContain("Buy more USDC");
    expect(html).toContain("2 tokens on Base");
    expect(html).toContain("+10.00% 24h");
  });

  it("asks guests to connect", () => {
    expect(render([], false)).toContain("Connect a wallet to swap straight from your holdings.");
  });
});
