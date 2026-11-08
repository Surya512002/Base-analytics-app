import { describe, it, expect } from "vitest";
import { mapOrderError, ERROR_MESSAGES } from "@/src/lib/limitOrders/errorMapper";
import { groupOrders } from "@/src/lib/limitOrders/bracketGrouping";
import type { OnChainOrder } from "@/src/lib/limitOrders/types";
import {
  parseDecimalInput,
  parseTriggerPrice,
  expectedAmountOut,
  minAmountOut,
  validateOrder,
  validateTrailing,
  validateBracket,
  validateDca,
  trailingStopPrice,
  fillFloor,
  dcaTotal,
} from "@/src/lib/limitOrders/orderMath";

describe("errorMapper", () => {
  it("maps user rejection properly", () => {
    expect(mapOrderError(new Error("User rejected the request"))).toBe(
      "You cancelled the transaction in your wallet."
    );
    expect(mapOrderError(new Error("MetaMask: user denied transaction"))).toBe(
      "You cancelled the transaction in your wallet."
    );
  });

  it("maps all contract custom errors specified in prompt", () => {
    for (const [name, expectedMsg] of Object.entries(ERROR_MESSAGES)) {
      expect(mapOrderError(new Error(`Execution reverted with reason: ${name}(): custom error`))).toBe(
        expectedMsg
      );
    }
  });

  it("returns fallback message on unknown error", () => {
    expect(mapOrderError(new Error("some totally random network error"))).toBe(
      "Something went wrong. Nothing was charged except network fees."
    );
  });
});

describe("bracketGrouping", () => {
  const dummyOwner = "0x1111111111111111111111111111111111111111" as const;
  const dummyStock = "0x2222222222222222222222222222222222222222" as const;

  it("groups linked legs into a single bracket card", () => {
    const tpLeg: OnChainOrder = {
      id: 10n,
      owner: dummyOwner,
      expiry: 1800000000,
      orderType: 1, // LIMIT_SELL = Take-profit
      status: 1, // OPEN
      trailBps: 0,
      stockToken: dummyStock,
      triggerPrice: 12000000000n, // $120
      amountIn: 100000000n,
      minAmountOut: 118000000n,
      peakPrice: 0n,
      linkedId: 11n,
    };

    const slLeg: OnChainOrder = {
      id: 11n,
      owner: dummyOwner,
      expiry: 1800000000,
      orderType: 2, // STOP_LOSS
      status: 1, // OPEN
      trailBps: 0,
      stockToken: dummyStock,
      triggerPrice: 8000000000n, // $80
      amountIn: 100000000n,
      minAmountOut: 78000000n,
      peakPrice: 0n,
      linkedId: 10n,
    };

    const { open, history } = groupOrders([tpLeg, slLeg]);
    expect(open).toHaveLength(1);
    expect(history).toHaveLength(0);

    const bracket = open[0];
    expect(bracket.kind).toBe("bracket");
    if (bracket.kind === "bracket") {
      expect(bracket.takeProfitLeg.id).toBe(10n);
      expect(bracket.stopLossLeg.id).toBe(11n);
      expect(bracket.isOpen).toBe(true);
    }
  });

  it("reports correct filled leg in bracket history", () => {
    const tpExecuted: OnChainOrder = {
      id: 20n,
      owner: dummyOwner,
      expiry: 1800000000,
      orderType: 1,
      status: 2, // EXECUTED
      trailBps: 0,
      stockToken: dummyStock,
      triggerPrice: 12000000000n,
      amountIn: 100000000n,
      minAmountOut: 118000000n,
      peakPrice: 0n,
      linkedId: 21n,
    };

    const slCancelled: OnChainOrder = {
      id: 21n,
      owner: dummyOwner,
      expiry: 1800000000,
      orderType: 2,
      status: 3, // CANCELLED
      trailBps: 0,
      stockToken: dummyStock,
      triggerPrice: 8000000000n,
      amountIn: 100000000n,
      minAmountOut: 78000000n,
      peakPrice: 0n,
      linkedId: 20n,
    };

    const { open, history } = groupOrders([tpExecuted, slCancelled]);
    expect(open).toHaveLength(0);
    expect(history).toHaveLength(1);

    const bracket = history[0];
    expect(bracket.kind).toBe("bracket");
    if (bracket.kind === "bracket") {
      expect(bracket.historySummary).toBe("Filled: Take-profit");
    }
  });

  it("leaves single orders as standalone items", () => {
    const limitBuy: OnChainOrder = {
      id: 5n,
      owner: dummyOwner,
      expiry: 1800000000,
      orderType: 0, // LIMIT_BUY
      status: 1, // OPEN
      trailBps: 0,
      stockToken: dummyStock,
      triggerPrice: 9000000000n,
      amountIn: 100000000n,
      minAmountOut: 100000000n,
      peakPrice: 0n,
      linkedId: 0n,
    };

    const { open, history } = groupOrders([limitBuy]);
    expect(open).toHaveLength(1);
    expect(history).toHaveLength(0);
    expect(open[0].kind).toBe("single");
  });
});

describe("orderMath pure logic", () => {
  it("parses decimal inputs without floating point issues", () => {
    expect(parseDecimalInput("123.45", 6)).toBe(123450000n);
    expect(parseDecimalInput("0.000001", 6)).toBe(1n);
    expect(parseDecimalInput("0.0000001", 6)).toBeNull(); // exceeds decimals
    expect(parseTriggerPrice("123.45")).toBe(12345000000n); // 8 decimals
  });

  it("calculates expected output, minAmountOut and fillFloor", () => {
    // 100 USDC at $100/stock with 8 decimals stock, 6 decimals USDC
    const expected = expectedAmountOut("LIMIT_BUY", 100_000000n, 100_00000000n, 8, 6);
    expect(expected).toBe(1_00000000n); // 1 stock token

    // 1% slippage = 100 bps
    const minOut = minAmountOut(expected, 100);
    expect(minOut).toBe(99000000n); // 0.99 stock

    // 3% deviation bound = 300 bps
    const floor = fillFloor("LIMIT_BUY", 100_000000n, 100_00000000n, 8, 6, 300);
    expect(floor).toBe(97000000n); // 0.97 stock
  });

  it("validates immediate trigger protection", () => {
    // Limit buy with current price $100 and trigger $105 (already met -> triggers immediately)
    const err = validateOrder({
      kind: "LIMIT_BUY",
      amountIn: 100_000000n,
      trigger: 105_00000000n,
      currentPrice: 100_00000000n,
      slippageBps: 100,
      keeperFeeBps: 10,
      balance: 1000_000000n,
      maxAmountIn: 500_000000n,
      expiry: 1700000000 + 86400 * 7,
      nowSec: 1700000000,
    });
    expect(err).toBe("Trigger must be below the current price.");
  });

  it("validates bracket boundaries", () => {
    const err = validateBracket({
      amountIn: 1_00000000n,
      takeProfit: 95_00000000n,
      stopLoss: 105_00000000n,
      currentPrice: 100_00000000n,
      slippageBps: 200,
      keeperFeeBps: 10,
      balance: 10_00000000n,
      maxAmountIn: 10_00000000n,
      expiry: 1700000000 + 86400 * 7,
      nowSec: 1700000000,
    });
    expect(err).toBe("Stop-loss must be below take-profit.");
  });

  it("validates trailing stops and dca", () => {
    const trailingErr = validateTrailing({
      amountIn: 1_00000000n,
      trailBps: 20, // < 50 bps
      slippageBps: 200,
      keeperFeeBps: 10,
      balance: 10_00000000n,
      maxAmountIn: 10_00000000n,
      expiry: 1700000000 + 86400 * 7,
      nowSec: 1700000000,
    });
    expect(trailingErr).toBe("Trailing distance must be between 0.5% and 50%.");

    const stop = trailingStopPrice(100_00000000n, 500); // 5% trail
    expect(stop).toBe(95_00000000n);

    const total = dcaTotal(50_000000n, 10);
    expect(total).toBe(500_000000n);

    const dcaErr = validateDca({
      amountPerBuy: 50_000000n,
      buys: 400, // > 365
      intervalSec: 86400,
      maxPrice: null,
      balance: 1000_000000n,
      maxQuoteIn: 500_000000n,
    });
    expect(dcaErr).toBe("Number of buys must be between 1 and 365.");
  });
});
