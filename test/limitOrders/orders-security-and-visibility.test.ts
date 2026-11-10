import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAddress, maxUint256, encodeFunctionData, parseAbi } from "viem";
import {
  buildApproveCall,
  buildCreateOrderCall,
  buildCreateTrailingStopCall,
  buildCreateBracketCall,
  buildUpdateOrderCall,
  buildCancelOrderCall,
  buildRefundExpiredCall,
  buildCreateDcaCall,
  buildCancelDcaCall,
  assertAllowedLimitOrderTx,
  ALLOWED_ORDERBOOK_SELECTORS,
} from "@/src/lib/limitOrders/calls";
import {
  getLimitOrdersConfig,
  buildSepoliaConfig,
  getOrdersConfigError,
  BASE_SEPOLIA_CONFIG,
  BASE_MAINNET_CONFIG,
} from "@/src/config/limitOrders";
import { isLimitOrdersFeatureEnabled } from "@/src/lib/limitOrders/featureFlag";
import { wagmiConfig } from "@/lib/wagmi/config";
import { base, baseSepolia } from "wagmi/chains";

describe("K3: Feature Flag Unified Truth & Wagmi Matrix", () => {
  it("enables feature when NEXT_PUBLIC_LIMIT_ORDERS_ENABLED is 'true' across any environment", () => {
    expect(isLimitOrdersFeatureEnabled({ limitOrdersEnabled: "true", nodeEnv: "production" })).toBe(true);
    expect(isLimitOrdersFeatureEnabled({ limitOrdersEnabled: "true", nodeEnv: "development" })).toBe(true);
    expect(isLimitOrdersFeatureEnabled({ limitOrdersEnabled: "true", vercelEnv: "preview", nodeEnv: "production" })).toBe(true);
  });

  it("strictly disables feature when NEXT_PUBLIC_LIMIT_ORDERS_ENABLED is 'false'", () => {
    expect(isLimitOrdersFeatureEnabled({ limitOrdersEnabled: "false", nodeEnv: "production" })).toBe(false);
    expect(isLimitOrdersFeatureEnabled({ limitOrdersEnabled: "false", vercelEnv: "preview", nodeEnv: "production" })).toBe(false);
    expect(isLimitOrdersFeatureEnabled({ limitOrdersEnabled: "false", nodeEnv: "development" })).toBe(false);
  });

  it("enables feature in Vercel preview when flag is unset", () => {
    expect(isLimitOrdersFeatureEnabled({ limitOrdersEnabled: undefined, vercelEnv: "preview", nodeEnv: "production" })).toBe(true);
  });

  it("enables feature in local development or test runners when flag is unset", () => {
    expect(isLimitOrdersFeatureEnabled({ limitOrdersEnabled: undefined, vercelEnv: undefined, nodeEnv: "development" })).toBe(true);
    expect(isLimitOrdersFeatureEnabled({ limitOrdersEnabled: undefined, vercelEnv: undefined, nodeEnv: "test" })).toBe(true);
  });

  it("disables feature in production when flag is unset and not preview", () => {
    expect(isLimitOrdersFeatureEnabled({ limitOrdersEnabled: undefined, vercelEnv: undefined, nodeEnv: "production" })).toBe(false);
  });

  it("verifies wagmi configuration chains based on feature flag status", () => {
    // In current test runtime (nodeEnv !== 'production'), wagmiConfig includes both Base and Base Sepolia
    const chainIds = wagmiConfig.chains.map((c) => c.id);
    expect(chainIds).toContain(base.id);
    if (isLimitOrdersFeatureEnabled()) {
      expect(chainIds).toContain(baseSepolia.id);
    }
  });
});

describe("Problem 1: Tab Visibility & Chain Configuration", () => {
  it("returns verified Sepolia config on chain 84532 with non-empty order book", () => {
    const config = getLimitOrdersConfig(84532);
    expect(config.orderBook).toBeDefined();
    expect(config.orderBook.toLowerCase()).not.toBe("0x0000000000000000000000000000000000000000");
    expect(config.markets.length).toBe(4);
    expect(config.markets.map((m) => m.symbol)).toEqual(["mNVDA", "mAAPL", "mMSFT", "mGOOGL"]);
    expect(config.quoteToken.symbol).toBe("mUSDC");
  });

  it("returns Mainnet config on chain 8453 with exactly 4 verified stock markets", () => {
    const config = getLimitOrdersConfig(8453);
    // Verified that on Base Mainnet, no order book is deployed yet
    expect(config.orderBook.toLowerCase()).toBe("0x0000000000000000000000000000000000000000");
    expect(config.markets.length).toBe(4);
    expect(config.markets.map((m) => m.symbol)).toEqual(["NVDAc", "AAPLc", "MSFTc", "GOOGLc"]);
    expect(config.quoteToken.symbol).toBe("USDC");
  });

  it("accurately detects when mainnet placeholder should be shown", () => {
    const mainnetConfig = getLimitOrdersConfig(8453);
    const isMainnetWithoutOrderBook =
      8453 === 8453 &&
      (!mainnetConfig.orderBook ||
        mainnetConfig.orderBook.toLowerCase() === "0x0000000000000000000000000000000000000000");
    expect(isMainnetWithoutOrderBook).toBe(true);

    const sepoliaConfig = getLimitOrdersConfig(84532);
    const testChainId: number = 84532;
    const isSepoliaWithoutOrderBook =
      testChainId === 8453 &&
      (!sepoliaConfig.orderBook ||
        sepoliaConfig.orderBook.toLowerCase() === "0x0000000000000000000000000000000000000000");
    expect(isSepoliaWithoutOrderBook).toBe(false);
  });
});

describe("K5: Hardened Allowlist Guard (assertAllowedLimitOrderTx)", () => {
  const dummyOrderBook = getAddress("0xC7fBA8EB5442760F83266C32F3Bc2E5c65079e46");
  const dummyQuote = getAddress("0x19468e9fe5dBfdbD786D9b09Da7caC07c1367187");
  const dummyStock = getAddress("0xCCc66590BA8a67fe51bC2eB552B24f30c30263F2");
  const rogueTarget = getAddress("0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef");

  const mockConfig = {
    orderBook: dummyOrderBook,
    quoteToken: { address: dummyQuote },
    markets: [{ stockToken: dummyStock }],
  };

  describe("Enforce tx.value === 0n", () => {
    it("permits transaction when value is undefined", () => {
      const tx = buildCancelOrderCall(dummyOrderBook, 1n);
      expect(() => assertAllowedLimitOrderTx(tx, mockConfig)).not.toThrow();
    });

    it("permits transaction when value is explicitly 0n", () => {
      const tx = { ...buildCancelOrderCall(dummyOrderBook, 1n), value: 0n };
      expect(() => assertAllowedLimitOrderTx(tx, mockConfig)).not.toThrow();
    });

    it("strictly rejects transaction with value > 0n (native ETH transfer)", () => {
      const tx = { ...buildCancelOrderCall(dummyOrderBook, 1n), value: 1000000000000000n };
      expect(() => assertAllowedLimitOrderTx(tx, mockConfig)).toThrow(
        /Security policy violation: Limit order transaction cannot send native ETH/
      );
    });
  });

  describe("Enforce tx.data is present and valid", () => {
    it("rejects transaction with missing or empty calldata", () => {
      const emptyTx = { to: dummyOrderBook, data: "" as any };
      expect(() => assertAllowedLimitOrderTx(emptyTx, mockConfig)).toThrow(
        /Security policy violation: Transaction calldata is missing or shorter than 4-byte selector/
      );
    });

    it("rejects transaction with calldata shorter than 4 bytes", () => {
      const shortTx = { to: dummyOrderBook, data: "0x1234" as any };
      expect(() => assertAllowedLimitOrderTx(shortTx, mockConfig)).toThrow(
        /Security policy violation: Transaction calldata is missing or shorter than 4-byte selector/
      );
    });
  });

  describe("Enforce exact 8 OrderBook selectors", () => {
    it("permits buildCreateOrderCall (0xcbc5d25b)", () => {
      const tx = buildCreateOrderCall({
        orderBook: dummyOrderBook,
        stockToken: dummyStock,
        orderType: 0,
        amountIn: 1000000n,
        triggerPrice: 10000000000n,
        minAmountOut: 990000n,
        expiry: 1800000000,
      });
      expect(() => assertAllowedLimitOrderTx(tx, mockConfig)).not.toThrow();
      expect(tx.data.slice(0, 10).toLowerCase()).toBe("0xcbc5d25b");
    });

    it("permits buildCreateTrailingStopCall (0xf00ff404)", () => {
      const tx = buildCreateTrailingStopCall({
        orderBook: dummyOrderBook,
        stockToken: dummyStock,
        amountIn: 1000000n,
        trailBps: 200,
        minAmountOut: 980000n,
        expiry: 1800000000,
      });
      expect(() => assertAllowedLimitOrderTx(tx, mockConfig)).not.toThrow();
      expect(tx.data.slice(0, 10).toLowerCase()).toBe("0xf00ff404");
    });

    it("permits buildCreateBracketCall (0xa661673e)", () => {
      const tx = buildCreateBracketCall({
        orderBook: dummyOrderBook,
        stockToken: dummyStock,
        amountIn: 1000000n,
        takeProfitPrice: 11000000000n,
        stopLossPrice: 9000000000n,
        minOutTakeProfit: 1090000n,
        minOutStopLoss: 890000n,
        expiry: 1800000000,
      });
      expect(() => assertAllowedLimitOrderTx(tx, mockConfig)).not.toThrow();
      expect(tx.data.slice(0, 10).toLowerCase()).toBe("0xa661673e");
    });

    it("permits buildUpdateOrderCall (0xa23d932b)", () => {
      const tx = buildUpdateOrderCall({
        orderBook: dummyOrderBook,
        orderId: 1n,
        newTrigger: 10500000000n,
        newMinAmountOut: 1000000n,
      });
      expect(() => assertAllowedLimitOrderTx(tx, mockConfig)).not.toThrow();
      expect(tx.data.slice(0, 10).toLowerCase()).toBe("0xa23d932b");
    });

    it("permits buildCancelOrderCall (0x514fcac7)", () => {
      const tx = buildCancelOrderCall(dummyOrderBook, 1n);
      expect(() => assertAllowedLimitOrderTx(tx, mockConfig)).not.toThrow();
      expect(tx.data.slice(0, 10).toLowerCase()).toBe("0x514fcac7");
    });

    it("permits buildRefundExpiredCall (0x1402b17a)", () => {
      const tx = buildRefundExpiredCall(dummyOrderBook, 1n);
      expect(() => assertAllowedLimitOrderTx(tx, mockConfig)).not.toThrow();
      expect(tx.data.slice(0, 10).toLowerCase()).toBe("0x1402b17a");
    });

    it("permits buildCreateDcaCall (0xb42f3f7d)", () => {
      const tx = buildCreateDcaCall({
        orderBook: dummyOrderBook,
        stockToken: dummyStock,
        amountPerBuy: 50000000n,
        buys: 5,
        interval: 86400,
        maxPrice: 20000000000n,
      });
      expect(() => assertAllowedLimitOrderTx(tx, mockConfig)).not.toThrow();
      expect(tx.data.slice(0, 10).toLowerCase()).toBe("0xb42f3f7d");
    });

    it("permits buildCancelDcaCall (0x55938f6f)", () => {
      const tx = buildCancelDcaCall(dummyOrderBook, 1n);
      expect(() => assertAllowedLimitOrderTx(tx, mockConfig)).not.toThrow();
      expect(tx.data.slice(0, 10).toLowerCase()).toBe("0x55938f6f");
    });

    it("strictly rejects OrderBook calls with unknown or administrative selectors", () => {
      const rogueSelectorTx = {
        to: dummyOrderBook,
        data: "0xdeadbeef00000000000000000000000000000000" as const,
      };
      expect(() => assertAllowedLimitOrderTx(rogueSelectorTx, mockConfig)).toThrow(
        /Security policy violation: Unknown or disallowed OrderBook function selector 0xdeadbeef/
      );
    });
  });

  describe("Enforce strict ERC-20 token approval rules", () => {
    it("permits exact-amount ERC-20 approve calls to the order book", () => {
      const approveTx = buildApproveCall(dummyQuote, dummyOrderBook, 100000000n);
      expect(() => assertAllowedLimitOrderTx(approveTx, mockConfig, 100000000n)).not.toThrow();
    });

    it("strictly rejects buildApproveCall with maxUint256 or zero/negative amount", () => {
      expect(() => buildApproveCall(dummyQuote, dummyOrderBook, maxUint256)).toThrow(
        /Security policy violation: Approvals must specify an exact positive amount/
      );
      expect(() => buildApproveCall(dummyQuote, dummyOrderBook, 0n)).toThrow(
        /Security policy violation: Approvals must specify an exact positive amount/
      );
    });

    it("strictly rejects token calls with non-approve function signatures", () => {
      const transferAbi = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]);
      const badTokenTx = {
        to: dummyQuote,
        data: encodeFunctionData({
          abi: transferAbi,
          functionName: "transfer",
          args: [rogueTarget, 1000000n],
        }),
      };
      expect(() => assertAllowedLimitOrderTx(badTokenTx, mockConfig)).toThrow(
        /Security policy violation: Token contract .* call must strictly be ERC20 approve\(\)/
      );
    });

    it("strictly rejects token approve calls where spender is not the order book", () => {
      const erc20Abi = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]);
      const badSpenderTx = {
        to: dummyQuote,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [rogueTarget, 1000000n],
        }),
      };
      expect(() => assertAllowedLimitOrderTx(badSpenderTx, mockConfig)).toThrow(
        /Security policy violation: Approval spender .* does not match OrderBook/
      );
    });

    it("strictly rejects token approval if amount exceeds maxAllowedAmount", () => {
      const approveTx = buildApproveCall(dummyQuote, dummyOrderBook, 500000000n);
      expect(() => assertAllowedLimitOrderTx(approveTx, mockConfig, 100000000n)).toThrow(
        /Security policy violation: Approval amount \(500000000\) exceeds maximum allowed order amount \(100000000\)/
      );
    });

    it("strictly rejects unlimited maxUint256 approval raw calldata", () => {
      const erc20Abi = parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]);
      const unlimitedTx = {
        to: dummyQuote,
        data: encodeFunctionData({
          abi: erc20Abi,
          functionName: "approve",
          args: [dummyOrderBook, maxUint256],
        }),
      };
      expect(() => assertAllowedLimitOrderTx(unlimitedTx, mockConfig)).toThrow(
        /Security policy violation: Unlimited token approval \(MaxUint256\) is strictly forbidden/
      );
    });
  });

  describe("Enforce non-allowlisted contract rejection", () => {
    it("strictly rejects calls to non-allowlisted contracts", () => {
      const badTx = {
        to: rogueTarget,
        data: "0x12345678" as const,
      };
      expect(() => assertAllowedLimitOrderTx(badTx, mockConfig)).toThrow(
        /Security policy violation: Target 0x.* is not an allowlisted Limit Orders contract/
      );
    });
  });

  describe("S2: Sepolia Deployment JSON & Configuration Error Diagnostics", () => {
    it("reads default public testnet deployment from sepoliaDeployment.json without env vars", () => {
      const origBook = process.env.NEXT_PUBLIC_LIMIT_ORDER_BOOK_SEPOLIA;
      delete process.env.NEXT_PUBLIC_LIMIT_ORDER_BOOK_SEPOLIA;

      const config = buildSepoliaConfig();
      expect(config.orderBook).toBe("0xC7fBA8EB5442760F83266C32F3Bc2E5c65079e46");
      expect(config.swapAdapter).toBe("0xbDa98551b18431bD95fdF21D06cBc37dA9dE943D");
      expect(config.quoteToken.address).toBe("0x19468e9fe5dBfdbD786D9b09Da7caC07c1367187");
      expect(config.quoteToken.symbol).toBe("mUSDC");
      expect(config.markets.length).toBeGreaterThanOrEqual(1);
      expect(config.markets[0].symbol).toBe("mNVDA");

      if (origBook) process.env.NEXT_PUBLIC_LIMIT_ORDER_BOOK_SEPOLIA = origBook;
    });

    it("allows environment variable override when provided", () => {
      const customBook = "0x1111111111111111111111111111111111111111";
      process.env.NEXT_PUBLIC_LIMIT_ORDER_BOOK_SEPOLIA = customBook;

      const config = buildSepoliaConfig();
      expect(config.orderBook).toBe(customBook);

      delete process.env.NEXT_PUBLIC_LIMIT_ORDER_BOOK_SEPOLIA;
    });

    it("returns null error for valid Sepolia config on chain 84532", () => {
      const config = getLimitOrdersConfig(84532);
      const err = getOrdersConfigError(config, 84532);
      expect(err).toBeNull();
    });

    it("detects unsupported network IDs", () => {
      const config = getLimitOrdersConfig(84532);
      const err = getOrdersConfigError(config, 1);
      expect(err).toContain("Unsupported network");
    });

    it("detects missing or zero Sepolia order book", () => {
      const badConfig = {
        ...getLimitOrdersConfig(84532),
        orderBook: "0x0000000000000000000000000000000000000000" as const,
      };
      const err = getOrdersConfigError(badConfig, 84532);
      expect(err).toBe("Sepolia order book address not configured");
    });

    it("detects missing or zero Sepolia swap adapter", () => {
      const badConfig = {
        ...getLimitOrdersConfig(84532),
        swapAdapter: "0x0000000000000000000000000000000000000000" as const,
      };
      const err = getOrdersConfigError(badConfig, 84532);
      expect(err).toBe("Sepolia swap adapter not configured");
    });

    it("detects missing or zero Sepolia quote token", () => {
      const badConfig = {
        ...getLimitOrdersConfig(84532),
        quoteToken: {
          address: "0x0000000000000000000000000000000000000000" as const,
          symbol: "mUSDC",
          decimals: 6,
        },
      };
      const err = getOrdersConfigError(badConfig, 84532);
      expect(err).toBe("Sepolia quote token address not configured");
    });

    it("detects empty trading markets on Sepolia", () => {
      const badConfig = {
        ...getLimitOrdersConfig(84532),
        markets: [],
      };
      const err = getOrdersConfigError(badConfig, 84532);
      expect(err).toBe("No trading markets configured for Base Sepolia");
    });
  });
});

