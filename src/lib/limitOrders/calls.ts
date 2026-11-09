import {
  type Address,
  type Hex,
  encodeFunctionData,
  maxUint256,
} from "viem";
import { orderBookAbi, erc20Abi } from "./abi";
import {
  parseDecimalInput,
  parseTriggerPrice,
  expectedAmountOut,
  minAmountOut,
  trailingStopPrice,
  type OrderKind,
} from "./orderMath";

export interface PreparedTx {
  to: Address;
  data: Hex;
  value?: bigint;
}

// =========================================================================
// 1. Raw Call Encoders (Pure ABI Encoders)
// =========================================================================

export function buildApproveCall(token: Address, spender: Address, amount: bigint): PreparedTx {
  if (amount === maxUint256 || amount <= 0n) {
    throw new Error("Security policy violation: Approvals must specify an exact positive amount, never MaxUint256");
  }
  return {
    to: token,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, amount],
    }),
  };
}

/**
 * Exact 4-byte selectors for OrderBook write functions:
 * 1. createOrder(address,uint8,uint128,uint96,uint128,uint40) -> 0xcbc5d25b
 * 2. createTrailingStop(address,uint128,uint16,uint128,uint40) -> 0xf00ff404
 * 3. createBracket(address,uint128,uint96,uint96,uint128,uint128,uint40) -> 0xa661673e
 * 4. updateOrder(uint256,uint96,uint128) -> 0xa23d932b
 * 5. cancelOrder(uint256) -> 0x514fcac7
 * 6. refundExpired(uint256) -> 0x1402b17a
 * 7. createDca(address,uint128,uint16,uint32,uint96) -> 0xb42f3f7d
 * 8. cancelDca(uint256) -> 0x55938f6f
 */
export const ALLOWED_ORDERBOOK_SELECTORS = new Set([
  "0xcbc5d25b",
  "0xf00ff404",
  "0xa661673e",
  "0xa23d932b",
  "0x514fcac7",
  "0x1402b17a",
  "0xb42f3f7d",
  "0x55938f6f",
]);

export const ERC20_APPROVE_SELECTOR = "0x095ea7b3";
const MAX_UINT256 = (1n << 256n) - 1n;

/**
 * Security Allowlist Guard for Limit Orders Transactions.
 *
 * Enforces:
 * 1. tx.value === 0n (or undefined). Native ETH transfers are strictly forbidden.
 * 2. tx.data is present and has at least a 4-byte selector (>= 10 chars).
 * 3. Target contract `to` must strictly equal either the configured order book or an allowlisted token (quote token or stock tokens).
 * 4. For OrderBook targets: function selector must match one of the exact 8 allowed write methods.
 * 5. For Token targets: function selector must be ERC20 approve(orderBook, amount) where:
 *    - `spender` equals the configured order book
 *    - `amount` > 0
 *    - `amount` !== MaxUint256 (no unlimited approvals)
 *    - `amount` <= maxAllowedAmount (if specified)
 * 6. Any violation immediately throws a descriptive Error and aborts execution to protect user wallet funds.
 */
export function assertAllowedLimitOrderTx(
  tx: PreparedTx,
  config: { orderBook: Address; quoteToken: { address: Address }; markets: Array<{ stockToken: Address }> },
  maxAllowedAmount?: bigint
): void {
  // 1. Native ETH transfers are forbidden
  if (tx.value !== undefined && tx.value > 0n) {
    throw new Error(
      `Security policy violation: Limit order transaction cannot send native ETH (value was ${tx.value} wei)`
    );
  }

  // 2. Calldata must be present and at least 4 bytes (selector)
  if (!tx.data || typeof tx.data !== "string" || !tx.data.startsWith("0x") || tx.data.length < 10) {
    throw new Error(
      "Security policy violation: Transaction calldata is missing or shorter than 4-byte selector"
    );
  }

  const target = tx.to.toLowerCase();
  const allowedOrderBook = config.orderBook.toLowerCase();
  const allowedTokens = [
    config.quoteToken.address.toLowerCase(),
    ...config.markets.map((m) => m.stockToken.toLowerCase()),
  ];

  // 3. Case A: Target is configured LimitOrderBook
  if (target === allowedOrderBook) {
    const selector = tx.data.slice(0, 10).toLowerCase();
    if (!ALLOWED_ORDERBOOK_SELECTORS.has(selector)) {
      throw new Error(
        `Security policy violation: Unknown or disallowed OrderBook function selector ${selector}`
      );
    }
    return;
  }

  // 4. Case B: Target is an allowlisted token (Quote or Stock)
  if (allowedTokens.includes(target)) {
    const selector = tx.data.slice(0, 10).toLowerCase();
    if (selector !== ERC20_APPROVE_SELECTOR) {
      throw new Error(
        `Security policy violation: Token contract ${tx.to} call must strictly be ERC20 approve()`
      );
    }

    if (tx.data.length < 138) {
      throw new Error(
        "Security policy violation: Malformed ERC20 approve calldata (insufficient length)"
      );
    }

    // Verify spender is the configured OrderBook
    const spenderHex = ("0x" + tx.data.slice(34, 74)).toLowerCase();
    if (spenderHex !== allowedOrderBook) {
      throw new Error(
        `Security policy violation: Approval spender ${spenderHex} does not match OrderBook ${config.orderBook}`
      );
    }

    // Verify amount is exact (> 0 and < MaxUint256)
    const amountHex = "0x" + tx.data.slice(74, 138);
    const amount = BigInt(amountHex);
    if (amount <= 0n) {
      throw new Error(
        "Security policy violation: Approval amount must be strictly greater than 0"
      );
    }
    if (amount === MAX_UINT256) {
      throw new Error(
        "Security policy violation: Unlimited token approval (MaxUint256) is strictly forbidden"
      );
    }

    if (maxAllowedAmount !== undefined && amount > maxAllowedAmount) {
      throw new Error(
        `Security policy violation: Approval amount (${amount}) exceeds maximum allowed order amount (${maxAllowedAmount})`
      );
    }

    return;
  }

  // 5. Case C: Target is not allowlisted
  throw new Error(
    `Security policy violation: Target ${tx.to} is not an allowlisted Limit Orders contract`
  );
}

export function buildCreateOrderCall(params: {
  orderBook: Address;
  stockToken: Address;
  orderType: number;
  amountIn: bigint;
  triggerPrice: bigint;
  minAmountOut: bigint;
  expiry: number;
}): PreparedTx {
  return {
    to: params.orderBook,
    data: encodeFunctionData({
      abi: orderBookAbi,
      functionName: "createOrder",
      args: [
        params.stockToken,
        params.orderType,
        params.amountIn,
        params.triggerPrice,
        params.minAmountOut,
        params.expiry,
      ],
    }),
  };
}

export function buildCreateTrailingStopCall(params: {
  orderBook: Address;
  stockToken: Address;
  amountIn: bigint;
  trailBps: number;
  minAmountOut: bigint;
  expiry: number;
}): PreparedTx {
  return {
    to: params.orderBook,
    data: encodeFunctionData({
      abi: orderBookAbi,
      functionName: "createTrailingStop",
      args: [
        params.stockToken,
        params.amountIn,
        params.trailBps,
        params.minAmountOut,
        params.expiry,
      ],
    }),
  };
}

export function buildCreateBracketCall(params: {
  orderBook: Address;
  stockToken: Address;
  amountIn: bigint;
  takeProfitPrice: bigint;
  stopLossPrice: bigint;
  minOutTakeProfit: bigint;
  minOutStopLoss: bigint;
  expiry: number;
}): PreparedTx {
  return {
    to: params.orderBook,
    data: encodeFunctionData({
      abi: orderBookAbi,
      functionName: "createBracket",
      args: [
        params.stockToken,
        params.amountIn,
        params.takeProfitPrice,
        params.stopLossPrice,
        params.minOutTakeProfit,
        params.minOutStopLoss,
        params.expiry,
      ],
    }),
  };
}

export function buildUpdateOrderCall(params: {
  orderBook: Address;
  orderId: bigint;
  newTrigger: bigint;
  newMinAmountOut: bigint;
}): PreparedTx {
  return {
    to: params.orderBook,
    data: encodeFunctionData({
      abi: orderBookAbi,
      functionName: "updateOrder",
      args: [params.orderId, params.newTrigger, params.newMinAmountOut],
    }),
  };
}

export function buildCancelOrderCall(orderBook: Address, orderId: bigint): PreparedTx {
  return {
    to: orderBook,
    data: encodeFunctionData({
      abi: orderBookAbi,
      functionName: "cancelOrder",
      args: [orderId],
    }),
  };
}

export function buildRefundExpiredCall(orderBook: Address, orderId: bigint): PreparedTx {
  return {
    to: orderBook,
    data: encodeFunctionData({
      abi: orderBookAbi,
      functionName: "refundExpired",
      args: [orderId],
    }),
  };
}

export function buildCreateDcaCall(params: {
  orderBook: Address;
  stockToken: Address;
  amountPerBuy: bigint;
  buys: number;
  interval: number;
  maxPrice: bigint;
}): PreparedTx {
  return {
    to: params.orderBook,
    data: encodeFunctionData({
      abi: orderBookAbi,
      functionName: "createDca",
      args: [
        params.stockToken,
        params.amountPerBuy,
        params.buys,
        params.interval,
        params.maxPrice,
      ],
    }),
  };
}

export function buildCancelDcaCall(orderBook: Address, planId: bigint): PreparedTx {
  return {
    to: orderBook,
    data: encodeFunctionData({
      abi: orderBookAbi,
      functionName: "cancelDca",
      args: [planId],
    }),
  };
}

// =========================================================================
// 2. High-level Form to Transaction Encoders
// =========================================================================

const ORDER_KINDS: OrderKind[] = ["LIMIT_BUY", "LIMIT_SELL", "STOP_LOSS", "TRAILING_STOP"];

export function encodeFormCreateOrder(params: {
  orderBook: Address;
  stockToken: Address;
  orderType: number; // 0=LIMIT_BUY, 1=LIMIT_SELL, 2=STOP_LOSS
  amountStr: string;
  inDecimals: number;
  triggerStr: string;
  slippagePercent: number;
  stockDecimals: number;
  quoteDecimals: number;
  keeperFeeBps: number;
  expirySeconds: number;
  nowSeconds?: number;
}): PreparedTx {
  const amountIn = parseDecimalInput(params.amountStr, params.inDecimals);
  if (amountIn === null) throw new Error("Invalid amount");
  const triggerPrice = parseTriggerPrice(params.triggerStr);
  if (triggerPrice === null) throw new Error("Invalid trigger price");
  const slippageBps = Math.round(params.slippagePercent * 100);

  const kind = ORDER_KINDS[params.orderType] || "LIMIT_BUY";
  const expected = expectedAmountOut(
    kind,
    amountIn,
    triggerPrice,
    params.stockDecimals,
    params.quoteDecimals
  );
  const minOut = minAmountOut(expected, slippageBps);
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const expiry = now + params.expirySeconds;

  return buildCreateOrderCall({
    orderBook: params.orderBook,
    stockToken: params.stockToken,
    orderType: params.orderType,
    amountIn,
    triggerPrice,
    minAmountOut: minOut,
    expiry,
  });
}

export function encodeFormCreateTrailingStop(params: {
  orderBook: Address;
  stockToken: Address;
  amountStr: string;
  inDecimals: number;
  trailPercent: number;
  slippagePercent: number;
  currentPrice: bigint;
  stockDecimals: number;
  quoteDecimals: number;
  keeperFeeBps: number;
  expirySeconds: number;
  nowSeconds?: number;
}): PreparedTx {
  const amountIn = parseDecimalInput(params.amountStr, params.inDecimals);
  if (amountIn === null) throw new Error("Invalid amount");
  const trailBps = Math.round(params.trailPercent * 100);
  const slippageBps = Math.round(params.slippagePercent * 100);
  const stopPrice = trailingStopPrice(params.currentPrice, trailBps);

  const expected = expectedAmountOut(
    "STOP_LOSS",
    amountIn,
    stopPrice,
    params.stockDecimals,
    params.quoteDecimals
  );
  const minOut = minAmountOut(expected, slippageBps);
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const expiry = now + params.expirySeconds;

  return buildCreateTrailingStopCall({
    orderBook: params.orderBook,
    stockToken: params.stockToken,
    amountIn,
    trailBps,
    minAmountOut: minOut,
    expiry,
  });
}

export function encodeFormCreateBracket(params: {
  orderBook: Address;
  stockToken: Address;
  amountStr: string;
  inDecimals: number;
  takeProfitStr: string;
  stopLossStr: string;
  slippagePercent: number;
  stockDecimals: number;
  quoteDecimals: number;
  keeperFeeBps: number;
  expirySeconds: number;
  nowSeconds?: number;
}): PreparedTx {
  const amountIn = parseDecimalInput(params.amountStr, params.inDecimals);
  if (amountIn === null) throw new Error("Invalid amount");
  const tpPrice = parseTriggerPrice(params.takeProfitStr);
  if (tpPrice === null) throw new Error("Invalid take profit price");
  const slPrice = parseTriggerPrice(params.stopLossStr);
  if (slPrice === null) throw new Error("Invalid stop loss price");
  const slippageBps = Math.round(params.slippagePercent * 100);

  const expectedTp = expectedAmountOut("LIMIT_SELL", amountIn, tpPrice, params.stockDecimals, params.quoteDecimals);
  const minOutTp = minAmountOut(expectedTp, slippageBps);

  const expectedSl = expectedAmountOut("STOP_LOSS", amountIn, slPrice, params.stockDecimals, params.quoteDecimals);
  const minOutSl = minAmountOut(expectedSl, slippageBps);

  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const expiry = now + params.expirySeconds;

  return buildCreateBracketCall({
    orderBook: params.orderBook,
    stockToken: params.stockToken,
    amountIn,
    takeProfitPrice: tpPrice,
    stopLossPrice: slPrice,
    minOutTakeProfit: minOutTp,
    minOutStopLoss: minOutSl,
    expiry,
  });
}

export function encodeFormCreateDca(params: {
  orderBook: Address;
  stockToken: Address;
  amountPerBuyStr: string;
  quoteDecimals: number;
  buys: number;
  intervalSeconds: number;
  ceilingPriceStr?: string;
}): PreparedTx {
  const amountPerBuy = parseDecimalInput(params.amountPerBuyStr, params.quoteDecimals);
  if (amountPerBuy === null) throw new Error("Invalid amount per buy");
  const ceiling = params.ceilingPriceStr && params.ceilingPriceStr.trim() !== ""
    ? parseTriggerPrice(params.ceilingPriceStr)
    : 0n;
  if (ceiling === null) throw new Error("Invalid ceiling price");

  return buildCreateDcaCall({
    orderBook: params.orderBook,
    stockToken: params.stockToken,
    amountPerBuy,
    buys: params.buys,
    interval: params.intervalSeconds,
    maxPrice: ceiling,
  });
}
