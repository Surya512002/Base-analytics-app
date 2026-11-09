import type { Address } from "viem";
import type { OrderKind } from "./orderMath";

export type OrderStatus = "NONE" | "OPEN" | "EXECUTED" | "CANCELLED" | "EXPIRED";

export interface OnChainOrder {
  id: bigint;
  owner: Address;
  expiry: number;
  orderType: number; // 0 LIMIT_BUY, 1 LIMIT_SELL, 2 STOP_LOSS, 3 TRAILING_STOP
  status: number; // 0 NONE, 1 OPEN, 2 EXECUTED, 3 CANCELLED, 4 EXPIRED
  trailBps: number;
  stockToken: Address;
  triggerPrice: bigint;
  amountIn: bigint;
  minAmountOut: bigint;
  peakPrice: bigint;
  linkedId: bigint;
}

export interface OnChainPlan {
  id: bigint;
  owner: Address;
  status: number; // 0 NONE, 1 OPEN, 2 EXECUTED, 3 CANCELLED, 4 EXPIRED
  remaining: number;
  interval: number;
  nextTime: number;
  stockToken: Address;
  maxPrice: bigint;
  amountPerBuy: bigint;
}

export interface SingleOrderDisplay {
  kind: "single";
  id: bigint;
  order: OnChainOrder;
  orderKind: OrderKind;
  isOpen: boolean;
  isHistory: boolean;
}

export interface BracketOrderDisplay {
  kind: "bracket";
  id: bigint; // primary id (usually take-profit leg id)
  takeProfitLeg: OnChainOrder;
  stopLossLeg: OnChainOrder;
  isOpen: boolean;
  isHistory: boolean;
  historySummary?: "Filled: Take-profit" | "Filled: Stop-loss" | "Cancelled" | "Expired";
}

export type GroupedOrderItem = SingleOrderDisplay | BracketOrderDisplay;
