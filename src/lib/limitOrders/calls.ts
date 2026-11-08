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

export function buildApproveCall(token: Address, spender: Address, amount?: bigint): PreparedTx {
  return {
    to: token,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [spender, amount ?? maxUint256],
    }),
  };
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
