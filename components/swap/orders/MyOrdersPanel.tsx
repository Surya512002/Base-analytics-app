"use client";

import { useState, useEffect } from "react";
import { formatUnits } from "viem";
import {
  Edit2,
  Trash2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingDown,
  TrendingUp,
  Layers,
} from "lucide-react";
import type { GroupedOrderItem, OnChainOrder, BracketOrderDisplay, SingleOrderDisplay } from "@/src/lib/limitOrders/types";
import {
  ORDER_LABEL,
  PRICE_DECIMALS,
  trailingStopPrice,
  ORDER_STATUS,
} from "@/src/lib/limitOrders/orderMath";
import type { MarketState } from "@/src/lib/limitOrders/useLimitOrders";
import EditOrderModal from "./EditOrderModal";

interface MyOrdersPanelProps {
  openOrders: GroupedOrderItem[];
  historyOrders: GroupedOrderItem[];
  markets: Record<string, MarketState>;
  quoteSymbol: string;
  quoteDecimals: number;
  onCancelOrder: (id: bigint) => Promise<boolean>;
  onRefundExpired: (id: bigint) => Promise<boolean>;
  onUpdateOrder: (id: bigint, newTrigger: bigint, newMinOut: bigint) => Promise<boolean>;
  isSubmitting: boolean;
}

export default function MyOrdersPanel({
  openOrders,
  historyOrders,
  markets,
  quoteSymbol,
  quoteDecimals,
  onCancelOrder,
  onRefundExpired,
  onUpdateOrder,
  isSubmitting,
}: MyOrdersPanelProps) {
  const [activeTab, setActiveTab] = useState<"open" | "history">("open");
  const [editingOrder, setEditingOrder] = useState<OnChainOrder | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);
  const [currentTimeSec, setCurrentTimeSec] = useState<number>(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTimeSec(Math.floor(Date.now() / 1000));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const getMarket = (stockToken: string): MarketState | undefined => {
    return markets[stockToken.toLowerCase()];
  };

  const formatDistance = (current: bigint | null, target: bigint) => {
    if (!current || current === 0n) return null;
    const diff = Number(target - current);
    const pct = (diff / Number(current)) * 100;
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(2)}%`;
  };

  const handleCancel = async (id: bigint) => {
    setActingId(id.toString());
    try {
      await onCancelOrder(id);
    } finally {
      setActingId(null);
    }
  };

  const handleRefund = async (id: bigint) => {
    setActingId(id.toString());
    try {
      await onRefundExpired(id);
    } finally {
      setActingId(null);
    }
  };

  const editingMarket = editingOrder ? getMarket(editingOrder.stockToken) : undefined;

  const renderSingleCard = (item: SingleOrderDisplay) => {
    const { order, orderKind, isOpen } = item;
    const market = getMarket(order.stockToken);
    const symbol = market?.symbol || "Stock";
    const stockDecimals = market?.decimals || 8;
    const currentPrice = market?.currentPrice || null;

    const isBuy = orderKind === "LIMIT_BUY";
    const inDecimals = isBuy ? quoteDecimals : stockDecimals;
    const inSymbol = isBuy ? quoteSymbol : symbol;
    const outDecimals = isBuy ? stockDecimals : quoteDecimals;
    const outSymbol = isBuy ? symbol : quoteSymbol;

    const amountInStr = formatUnits(order.amountIn, inDecimals);
    const triggerStr = formatUnits(order.triggerPrice, PRICE_DECIMALS);
    const minOutStr = formatUnits(order.minAmountOut, outDecimals);
    const distance = formatDistance(currentPrice, order.triggerPrice);

    // Trailing stop metrics
    const isTrailing = orderKind === "TRAILING_STOP";
    const peakStr = order.peakPrice > 0n ? formatUnits(order.peakPrice, PRICE_DECIMALS) : "—";
    const currentStop = isTrailing && order.peakPrice > 0n
      ? trailingStopPrice(order.peakPrice, order.trailBps)
      : null;
    const currentStopStr = currentStop ? formatUnits(currentStop, PRICE_DECIMALS) : "—";
    const stopDistance = isTrailing && currentPrice && currentStop
      ? formatDistance(currentPrice, currentStop)
      : null;

    const isExpired = isOpen && currentTimeSec > order.expiry;
    const isActionBusy = actingId === order.id.toString() || isSubmitting;

    return (
      <div
        key={`order-${order.id.toString()}`}
        className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs space-y-2.5 transition hover:border-[var(--brand)]/30"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isTrailing
                  ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                  : isBuy
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              }`}
            >
              {ORDER_LABEL[orderKind]}
            </span>
            <span className="text-xs font-semibold text-[var(--ink)]">{symbol}</span>
            <span className="text-[11px] text-[var(--ink-muted)] font-mono">
              #{order.id.toString()}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {order.status === 2 && (
              <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={12} /> Executed
              </span>
            )}
            {order.status === 3 && (
              <span className="flex items-center gap-1 text-[11px] text-zinc-400 font-semibold bg-zinc-500/10 px-2 py-0.5 rounded-full">
                <XCircle size={12} /> Cancelled
              </span>
            )}
            {order.status === 4 && (
              <span className="flex items-center gap-1 text-[11px] text-amber-500 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full">
                <Clock size={12} /> Expired
              </span>
            )}
            {isOpen && isExpired && (
              <span className="text-[11px] text-amber-500 font-semibold bg-amber-500/10 px-2 py-0.5 rounded-full">
                Expired (Pending Refund)
              </span>
            )}
          </div>
        </div>

        {/* Amount & Trigger Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <div className="p-2 rounded-xl bg-[var(--surface-2)]">
            <span className="block text-[10px] text-[var(--ink-muted)] uppercase tracking-wider">
              {isBuy ? "Budget" : "Deposit"}
            </span>
            <span className="font-semibold text-[var(--ink)] tabular-nums">
              {amountInStr} {inSymbol}
            </span>
          </div>

          <div className="p-2 rounded-xl bg-[var(--surface-2)]">
            <span className="block text-[10px] text-[var(--ink-muted)] uppercase tracking-wider">
              {isTrailing ? "Current Stop" : "Trigger Price"}
            </span>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--ink)] tabular-nums font-mono">
                ${isTrailing ? currentStopStr : triggerStr}
              </span>
              {distance && !isTrailing && (
                <span
                  className={`text-[10px] font-bold ${
                    distance.startsWith("+") ? "text-emerald-500" : "text-rose-500"
                  }`}
                >
                  {distance}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Minimum out information */}
        <div className="text-[11px] text-[var(--ink-muted)] px-2 py-1 flex items-center justify-between">
          <span>Min. Receive:</span>
          <span className="font-medium text-[var(--ink)]">
            {minOutStr} {outSymbol}
          </span>
        </div>

        {/* Trailing details */}
        {isTrailing && (
          <div className="text-[11px] text-[var(--ink-muted)] px-2.5 py-1.5 rounded-xl bg-purple-500/5 border border-purple-500/10 flex items-center justify-between">
            <span>Peak: ${peakStr}</span>
            <span>Trail: {(order.trailBps / 100).toFixed(1)}%</span>
            {stopDistance && <span>Distance: {stopDistance}</span>}
          </div>
        )}

        {/* Actions for Open Orders */}
        {isOpen && (
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-[var(--border-subtle)]">
            {!isTrailing && (
              <button
                type="button"
                onClick={() => setEditingOrder(order)}
                disabled={isActionBusy}
                className="flex items-center gap-1 text-[11px] font-semibold text-[var(--ink)] px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--surface-2)] transition disabled:opacity-50"
              >
                <Edit2 size={12} /> Edit
              </button>
            )}

            {isExpired ? (
              <button
                type="button"
                onClick={() => handleRefund(order.id)}
                disabled={isActionBusy}
                className="flex items-center gap-1 text-[11px] font-semibold text-amber-500 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition disabled:opacity-50"
              >
                <RotateCcw size={12} /> Refund Deposit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleCancel(order.id)}
                disabled={isActionBusy}
                className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 transition disabled:opacity-50"
              >
                <Trash2 size={12} /> Cancel
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderBracketCard = (item: BracketOrderDisplay) => {
    const { takeProfitLeg, stopLossLeg, isOpen, historySummary } = item;
    const market = getMarket(takeProfitLeg.stockToken);
    const symbol = market?.symbol || "Stock";
    const stockDecimals = market?.decimals || 8;
    const currentPrice = market?.currentPrice || null;

    const amountInStr = formatUnits(takeProfitLeg.amountIn, stockDecimals);
    const tpPriceStr = formatUnits(takeProfitLeg.triggerPrice, PRICE_DECIMALS);
    const slPriceStr = formatUnits(stopLossLeg.triggerPrice, PRICE_DECIMALS);

    const tpDistance = formatDistance(currentPrice, takeProfitLeg.triggerPrice);
    const slDistance = formatDistance(currentPrice, stopLossLeg.triggerPrice);

    const isExpired =
      isOpen &&
      currentTimeSec > Math.min(takeProfitLeg.expiry, stopLossLeg.expiry);
    const isActionBusy = actingId === item.id.toString() || isSubmitting;

    return (
      <div
        key={`bracket-${item.id.toString()}`}
        className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs space-y-2.5 transition hover:border-[var(--brand)]/30"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Layers size={12} /> Bracket Order
            </span>
            <span className="text-xs font-semibold text-[var(--ink)]">{symbol}</span>
            <span className="text-[11px] text-[var(--ink-muted)] font-mono">
              #{takeProfitLeg.id.toString()}/{stopLossLeg.id.toString()}
            </span>
          </div>

          <div>
            {historySummary ? (
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                  historySummary.startsWith("Filled")
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-zinc-500/10 text-zinc-400"
                }`}
              >
                {historySummary}
              </span>
            ) : isOpen ? (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                Active Both Legs
              </span>
            ) : null}
          </div>
        </div>

        {/* Deposit info */}
        <div className="text-xs text-[var(--ink-muted)] flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-[var(--surface-2)]">
          <span>Escrowed Deposit (One Deposit)</span>
          <span className="font-semibold text-[var(--ink)] tabular-nums">
            {amountInStr} {symbol}
          </span>
        </div>

        {/* Side-by-side Take-Profit & Stop-Loss Legs */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {/* Take-profit leg */}
          <div className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">
              <span>Take-Profit Leg</span>
              <TrendingUp size={12} />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-[var(--ink)] tabular-nums">
                ${tpPriceStr}
              </span>
              {tpDistance && (
                <span className="text-[10px] font-bold text-emerald-500">{tpDistance}</span>
              )}
            </div>
            <div className="text-[10px] text-[var(--ink-muted)]">
              Status: {ORDER_STATUS[takeProfitLeg.status]}
            </div>
          </div>

          {/* Stop-loss leg */}
          <div className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/10 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-rose-600 dark:text-rose-400 font-bold uppercase">
              <span>Stop-Loss Leg</span>
              <TrendingDown size={12} />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-[var(--ink)] tabular-nums">
                ${slPriceStr}
              </span>
              {slDistance && (
                <span className="text-[10px] font-bold text-rose-500">{slDistance}</span>
              )}
            </div>
            <div className="text-[10px] text-[var(--ink-muted)]">
              Status: {ORDER_STATUS[stopLossLeg.status]}
            </div>
          </div>
        </div>

        {/* Actions for Open Bracket */}
        {isOpen && (
          <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEditingOrder(takeProfitLeg)}
                disabled={isActionBusy}
                className="text-[11px] font-medium text-[var(--ink)] px-2 py-1 rounded-md border border-[var(--border-subtle)] hover:bg-[var(--surface-2)]"
              >
                Edit TP
              </button>
              <button
                type="button"
                onClick={() => setEditingOrder(stopLossLeg)}
                disabled={isActionBusy}
                className="text-[11px] font-medium text-[var(--ink)] px-2 py-1 rounded-md border border-[var(--border-subtle)] hover:bg-[var(--surface-2)]"
              >
                Edit SL
              </button>
            </div>

            {isExpired ? (
              <button
                type="button"
                onClick={() => handleRefund(item.id)}
                disabled={isActionBusy}
                className="flex items-center gap-1 text-[11px] font-semibold text-amber-500 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 transition disabled:opacity-50"
              >
                <RotateCcw size={12} /> Refund
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleCancel(item.id)}
                disabled={isActionBusy}
                className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 px-2.5 py-1 rounded-lg hover:bg-rose-500/10 transition disabled:opacity-50"
              >
                <Trash2 size={12} /> Cancel Bracket
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const listToRender = activeTab === "open" ? openOrders : historyOrders;

  return (
    <div className="space-y-3 pt-4">
      {/* Sub-tabs: Open vs History */}
      <div className="flex items-center justify-between px-1">
        <h4 className="text-sm font-bold text-[var(--ink)]">My Orders</h4>
        <div className="flex items-center gap-1 p-0.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setActiveTab("open")}
            className={`text-xs font-semibold px-3 py-1 rounded-lg transition ${
              activeTab === "open"
                ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            Open ({openOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`text-xs font-semibold px-3 py-1 rounded-lg transition ${
              activeTab === "history"
                ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            History ({historyOrders.length})
          </button>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-2.5">
        {listToRender.length === 0 ? (
          <div className="p-6 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] text-center space-y-1">
            <p className="text-xs text-[var(--ink-muted)] font-medium">
              {activeTab === "open"
                ? "No open orders. Place a limit, take-profit, or bracket order above to get started."
                : "No past orders in history yet."}
            </p>
          </div>
        ) : (
          listToRender.map((item) =>
            item.kind === "bracket" ? renderBracketCard(item) : renderSingleCard(item)
          )
        )}
      </div>

      {/* Edit Order Modal */}
      {editingOrder && (
        <EditOrderModal
          order={editingOrder}
          market={editingMarket}
          quoteDecimals={quoteDecimals}
          onClose={() => setEditingOrder(null)}
          onSave={onUpdateOrder}
        />
      )}
    </div>
  );
}
