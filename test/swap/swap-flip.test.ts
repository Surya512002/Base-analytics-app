import { describe, it, expect } from "vitest";
import {
  ETH_COUNTER,
  counterDecimalsOf,
  counterSymbol,
  sameCounter,
  type SwapCounter,
} from "@/components/launchpad/TokenPickerDialog";
import {
  launchedToCounter,
  resolveDexSwapRoute,
} from "@/lib/launchpad/dex-swap-params";
import { computeSwapUsd } from "@/lib/launchpad/swap-display";

describe("Swap Pair Flipping & Robustness", () => {
  const ofcToken = launchedToCounter({
    address: "0x752C5a95d202972E124390F30a50154409d3c858",
    symbol: "OFC",
    decimals: 18,
  }) as Extract<SwapCounter, { kind: "token" }>;

  const usdcToken = launchedToCounter({
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    symbol: "USDC",
    decimals: 6,
  }) as Extract<SwapCounter, { kind: "token" }>;

  it("safely handles sameCounter with null, undefined, and case differences", () => {
    expect(sameCounter(null, null)).toBe(false);
    expect(sameCounter(ETH_COUNTER, null)).toBe(false);
    expect(sameCounter(null, ofcToken)).toBe(false);
    expect(sameCounter(ETH_COUNTER, ETH_COUNTER)).toBe(true);

    const ofcLower: SwapCounter = {
      kind: "token",
      address: "0x752c5a95d202972e124390f30a50154409d3c858",
      symbol: "ofc",
      decimals: 18,
    };
    expect(sameCounter(ofcToken, ofcLower)).toBe(true);
    expect(sameCounter(ofcToken, usdcToken)).toBe(false);
    expect(sameCounter(ofcToken, ETH_COUNTER)).toBe(false);
  });

  it("counterSymbol & counterDecimalsOf never throw on missing or malformed inputs", () => {
    expect(counterSymbol(null)).toBe("");
    expect(counterSymbol(undefined)).toBe("");
    expect(counterSymbol(ETH_COUNTER)).toBe("ETH");
    expect(counterSymbol(ofcToken)).toBe("OFC");

    expect(counterDecimalsOf(null)).toBe(18);
    expect(counterDecimalsOf(undefined)).toBe(18);
    expect(counterDecimalsOf(ETH_COUNTER)).toBe(18);
    expect(counterDecimalsOf(ofcToken)).toBe(18);
    expect(counterDecimalsOf(usdcToken)).toBe(6);
  });

  it("simulates flipping ETH <-> OFC seamlessly in both directions", () => {
    // Initial state: You Pay ETH -> You Receive OFC
    let from: SwapCounter = ETH_COUNTER;
    let to: SwapCounter | null = ofcToken;

    const routeBuy = resolveDexSwapRoute(from, to);
    expect(routeBuy).not.toBeNull();
    expect(routeBuy?.direction).toBe("buy");
    expect(routeBuy?.pageToken.symbol).toBe("OFC");
    expect(routeBuy?.payAsset).toBe("eth");
    expect(routeBuy?.counterDecimals).toBe(18);

    // 1st Flip: arrow button clicked (from becomes OFC, to becomes ETH)
    const nextFrom1 = to!;
    const nextTo1 = from;
    from = nextFrom1;
    to = nextTo1;

    expect(from.kind).toBe("token");
    expect(counterSymbol(from)).toBe("OFC");
    expect(to.kind).toBe("eth");
    expect(counterSymbol(to)).toBe("ETH");

    const routeSell = resolveDexSwapRoute(from, to);
    expect(routeSell).not.toBeNull();
    expect(routeSell?.direction).toBe("sell");
    expect(routeSell?.pageToken.symbol).toBe("OFC");
    expect(routeSell?.payAsset).toBe("token");
    expect(routeSell?.receiveAsset).toBe("eth");
    expect(routeSell?.payToken?.toLowerCase()).toBe("0x752c5a95d202972e124390f30a50154409d3c858");

    // 2nd Flip: arrow button clicked again (reverts back cleanly)
    const nextFrom2 = to;
    const nextTo2 = from;
    from = nextFrom2;
    to = nextTo2;

    expect(from.kind).toBe("eth");
    expect(to.kind).toBe("token");
    expect(counterSymbol(to)).toBe("OFC");

    const routeBuyAgain = resolveDexSwapRoute(from, to);
    expect(routeBuyAgain?.direction).toBe("buy");
    expect(routeBuyAgain?.pageToken.symbol).toBe("OFC");
  });

  it("simulates flipping Token <-> Token (e.g. OFC <-> USDC)", () => {
    let from: SwapCounter = ofcToken;
    let to: SwapCounter | null = usdcToken;

    const route1 = resolveDexSwapRoute(from, to);
    expect(route1?.needsAggregator).toBe(true);
    expect(route1?.direction).toBe("buy");
    expect(route1?.pageToken.symbol).toBe("USDC");
    expect(route1?.payToken?.toLowerCase()).toBe(ofcToken.address.toLowerCase());

    // Flip
    const nextFrom = to;
    const nextTo = from;
    from = nextFrom;
    to = nextTo;

    const route2 = resolveDexSwapRoute(from, to);
    expect(route2?.needsAggregator).toBe(true);
    expect(route2?.direction).toBe("buy");
    expect(route2?.pageToken.symbol).toBe("OFC");
    expect(route2?.payToken?.toLowerCase()).toBe(usdcToken.address.toLowerCase());
  });

  it("computeSwapUsd produces valid USD figures without throwing for both buy and sell legs", () => {
    // Buy leg: spending 0.01 ETH at $2500 ETH price
    const buyResult = computeSwapUsd({
      direction: "buy",
      payAmount: 0.01,
      quoteOut: 4054.845,
      counterUsd: 2500,
    });
    expect(buyResult.payUsd).toBeCloseTo(25, 1);
    expect(buyResult.receiveUsd).toBeCloseTo(24.9, 1);

    // Sell leg: selling 4054.845 OFC, receiving 0.01 ETH ($25)
    const sellResult = computeSwapUsd({
      direction: "sell",
      payAmount: 4054.845,
      quoteOut: 0.01,
      counterUsd: 2500,
    });
    expect(sellResult.receiveUsd).toBeCloseTo(25, 0);
    expect(sellResult.payUsd).toBeCloseTo(25.12, 1);

    // Sell leg before quote is fetched: quoteOut is null
    const sellPendingResult = computeSwapUsd({
      direction: "sell",
      payAmount: 4054.845,
      quoteOut: null,
      counterUsd: 2500,
    });
    expect(sellPendingResult.payUsd).toBeNull();
    expect(sellPendingResult.receiveUsd).toBeNull();
  });
});
