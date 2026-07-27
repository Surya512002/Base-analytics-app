import { describe, expect, it } from "vitest";
import { ETH_COUNTER } from "@/components/launchpad/TokenPickerDialog";
import { launchedToCounter, resolveDexSwapRoute } from "@/lib/launchpad/dex-swap-params";

describe("resolveDexSwapRoute", () => {
  const usdc = launchedToCounter({
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    decimals: 6,
  });
  const brett = launchedToCounter({
    address: "0x532f27101965dd16442E59d40670FaF5eBB142E4",
    symbol: "BRETT",
    decimals: 18,
  });

  it("routes ETH → token as buy", () => {
    const route = resolveDexSwapRoute(ETH_COUNTER, brett);
    expect(route?.direction).toBe("buy");
    expect(route?.pageToken.symbol).toBe("BRETT");
    expect(route?.needsAggregator).toBe(false);
  });

  it("routes token → ETH as sell", () => {
    const route = resolveDexSwapRoute(brett, ETH_COUNTER);
    expect(route?.direction).toBe("sell");
    expect(route?.pageToken.symbol).toBe("BRETT");
    expect(route?.needsAggregator).toBe(false);
  });

  it("routes token → token via aggregator", () => {
    const route = resolveDexSwapRoute(brett, usdc);
    expect(route?.direction).toBe("buy");
    expect(route?.pageToken.symbol).toBe("USDC");
    expect(route?.payToken?.toLowerCase()).toBe(
      brett.kind === "token" ? brett.address.toLowerCase() : ""
    );
    expect(route?.needsAggregator).toBe(true);
  });
});
