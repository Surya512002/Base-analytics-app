import { afterEach, describe, expect, it, vi } from "vitest";

const readContract = vi.fn();
vi.mock("@/lib/utils/base-rpc", () => ({ createBasePublicClient: () => ({ readContract }) }));

import { fetchEthUsd } from "./eth-usd";

const round = (price: number, ageSec: number) => {
  const at = BigInt(Math.floor(Date.now() / 1000) - ageSec);
  return [BigInt(1), BigInt(price * 1e8), at, at, BigInt(1)];
};

describe("fetchEthUsd", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns the Chainlink price", async () => {
    readContract.mockResolvedValue(round(1900, 60));
    expect(await fetchEthUsd()).toBe(1900);
  });

  it("uses the second source when the feed is stale", async () => {
    readContract.mockResolvedValue(round(1900, 7200));
    vi.stubGlobal("fetch", async () => Response.json({ coins: { "coingecko:ethereum": { price: 2000 } } }));
    expect(await fetchEthUsd()).toBe(2000);
  });

  it("returns 0, not an assumed price, when both sources fail", async () => {
    readContract.mockRejectedValue(new Error("rpc down"));
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
    expect(await fetchEthUsd()).toBe(0);
  });
});
