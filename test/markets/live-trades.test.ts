import { describe, expect, it } from "vitest";
import { isPoolId, isTokenAddress, mergeTrades, parseGeckoTrades } from "@/lib/markets/live-trades";

const HASH = "0x" + "ab".repeat(32);
const POOL = "0x6cdcb1c4a4d1c3c6d054b27ac5b77e89eafb971d";

describe("live trades", () => {
  it("reads buy and sell sides from the right token amounts", () => {
    const rows = [
      {
        id: "s",
        attributes: {
          block_timestamp: "2026-11-13T15:31:03Z",
          tx_hash: HASH,
          tx_from_address: "0x7C40c792f376d2921854faa4c52985b906aae2F3",
          kind: "sell",
          from_token_amount: "585.6",
          to_token_amount: "277.3",
          price_from_in_usd: "0.4746",
          price_to_in_usd: "1.0024",
          volume_in_usd: "277.99",
        },
      },
      {
        id: "b",
        attributes: {
          block_timestamp: "2026-11-13T15:32:03Z",
          tx_hash: HASH,
          kind: "buy",
          from_token_amount: "10",
          to_token_amount: "21",
          price_from_in_usd: "1",
          price_to_in_usd: "0.47",
          volume_in_usd: "10",
        },
      },
    ];
    const [sell, buy] = parseGeckoTrades(POOL, rows);
    expect(sell).toMatchObject({ kind: "sell", tokenAmount: 585.6, priceUsd: 0.4746, usd: 277.99 });
    expect(sell.wallet).toBe("0x7c40c792f376d2921854faa4c52985b906aae2f3");
    expect(buy).toMatchObject({ kind: "buy", tokenAmount: 21, priceUsd: 0.47 });
  });

  it("drops anomalous or malformed rows", () => {
    const base = { block_timestamp: "2026-11-13T15:31:03Z", tx_hash: HASH, kind: "buy" };
    expect(parseGeckoTrades(POOL, [{ attributes: { ...base, is_anomalous: true } }])).toHaveLength(0);
    expect(parseGeckoTrades(POOL, [{ attributes: { ...base, tx_hash: "0x12" } }])).toHaveLength(0);
    expect(parseGeckoTrades(POOL, [{ attributes: { ...base, kind: "swap" } }])).toHaveLength(0);
    expect(parseGeckoTrades(POOL, "nope")).toEqual([]);
  });

  it("merges pools newest first without duplicates", () => {
    const t = (id: string, ts: number) =>
      ({ id, pool: POOL, txHash: HASH, wallet: "", kind: "buy", usd: 1, tokenAmount: 1, priceUsd: 1, timestamp: ts }) as const;
    const merged = mergeTrades([[t("a", 1), t("b", 3)], [t("b", 3), t("c", 2)]], 10);
    expect(merged.map((x) => x.id)).toEqual(["b", "c", "a"]);
  });

  it("validates pool ids (v2/v3 and v4) and token addresses", () => {
    expect(isPoolId(POOL)).toBe(true);
    expect(isPoolId("0x" + "c".repeat(64))).toBe(true);
    expect(isPoolId("0x123")).toBe(false);
    expect(isTokenAddress(POOL)).toBe(true);
    expect(isTokenAddress("0x" + "c".repeat(64))).toBe(false);
  });
});
