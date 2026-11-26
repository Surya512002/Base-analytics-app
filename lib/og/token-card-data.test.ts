import { afterEach, describe, expect, it, vi } from "vitest";
import { cardLabel, MIN_CARD_LIQUIDITY_USD, tokenCardData } from "./token-card-data";

const TOKEN = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";

const pair = (over: Record<string, unknown> = {}) => ({
  chainId: "base",
  baseToken: { address: TOKEN, symbol: "ABC", name: "Abc Coin" },
  quoteToken: { address: OTHER, symbol: "WETH" },
  priceUsd: "2.5",
  priceChange: { h24: -4.2 },
  marketCap: 5_000_000,
  liquidity: { usd: MIN_CARD_LIQUIDITY_USD },
  ...over,
});

const respond = (pairs: unknown[]) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(pairs))));

afterEach(() => vi.unstubAllGlobals());

describe("tokenCardData", () => {
  it("takes the price from the live pair and stamps the time", async () => {
    respond([pair()]);
    const card = await tokenCardData(TOKEN);
    expect(card).toMatchObject({ symbol: "ABC", change24h: -4.2, mcap: "$5.00M" });
    expect(card?.price).toContain("2.5");
    expect(card?.asOf).toBeInstanceOf(Date);
  });

  it("shows no numbers for a thin pool", async () => {
    respond([pair({ liquidity: { usd: MIN_CARD_LIQUIDITY_USD - 1 } })]);
    const card = await tokenCardData(TOKEN);
    expect(card?.symbol).toBe("ABC");
    expect([card?.price, card?.change24h, card?.mcap, card?.asOf]).toEqual([undefined, undefined, undefined, undefined]);
  });

  it("does not borrow a price from a pair where the token is only the quote side", async () => {
    respond([pair({ baseToken: { address: OTHER, symbol: "ZZZ" }, quoteToken: { address: TOKEN } })]);
    expect(await tokenCardData(TOKEN)).toBeNull();
  });

  it("returns nothing when the feed fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    expect(await tokenCardData(TOKEN)).toBeNull();
  });
});

describe("cardLabel", () => {
  it("drops links and cuts long names", () => {
    expect(cardLabel("Claim at evil.com", 32)).toBeUndefined();
    expect(cardLabel("https://x", 32)).toBeUndefined();
    expect(cardLabel("St. Joe", 32)).toBe("St. Joe");
    expect(cardLabel("A".repeat(40), 12)).toHaveLength(12);
  });
});
