import type { OnChainOrder, GroupedOrderItem, BracketOrderDisplay, SingleOrderDisplay } from "./types";
import type { OrderKind } from "./orderMath";

function kindFromType(typeIndex: number): OrderKind {
  switch (typeIndex) {
    case 0:
      return "LIMIT_BUY";
    case 1:
      return "LIMIT_SELL";
    case 2:
      return "STOP_LOSS";
    case 3:
      return "TRAILING_STOP";
    default:
      return "LIMIT_BUY";
  }
}

/**
 * Groups an array of raw on-chain orders into:
 * - Single order cards (for standalone limit buy, take profit, stop loss, trailing stop)
 * - Merged bracket cards (for linked take-profit + stop-loss pairs)
 *
 * Returned items are split into open orders and history items.
 */
export function groupOrders(orders: OnChainOrder[]): {
  open: GroupedOrderItem[];
  history: GroupedOrderItem[];
} {
  const orderMap = new Map<string, OnChainOrder>();
  for (const o of orders) {
    orderMap.set(o.id.toString(), o);
  }

  const processedBracketIds = new Set<string>();
  const items: GroupedOrderItem[] = [];

  for (const o of orders) {
    const idStr = o.id.toString();

    // If already processed as part of a bracket pair, skip
    if (processedBracketIds.has(idStr)) {
      continue;
    }

    if (o.linkedId !== 0n) {
      const linkedIdStr = o.linkedId.toString();
      const linkedOrder = orderMap.get(linkedIdStr);

      if (linkedOrder) {
        // We have both legs of the bracket
        processedBracketIds.add(idStr);
        processedBracketIds.add(linkedIdStr);

        const isTakeProfit = o.orderType === 1;
        const takeProfitLeg = isTakeProfit ? o : linkedOrder;
        const stopLossLeg = isTakeProfit ? linkedOrder : o;

        const isOpen = takeProfitLeg.status === 1 || stopLossLeg.status === 1;

        let historySummary: BracketOrderDisplay["historySummary"] = undefined;
        if (!isOpen) {
          if (takeProfitLeg.status === 2) {
            historySummary = "Filled: Take-profit";
          } else if (stopLossLeg.status === 2) {
            historySummary = "Filled: Stop-loss";
          } else if (takeProfitLeg.status === 3 || stopLossLeg.status === 3) {
            historySummary = "Cancelled";
          } else if (takeProfitLeg.status === 4 || stopLossLeg.status === 4) {
            historySummary = "Expired";
          }
        }

        const bracketDisplay: BracketOrderDisplay = {
          kind: "bracket",
          id: takeProfitLeg.id < stopLossLeg.id ? takeProfitLeg.id : stopLossLeg.id,
          takeProfitLeg,
          stopLossLeg,
          isOpen,
          isHistory: !isOpen,
          historySummary,
        };

        items.push(bracketDisplay);
        continue;
      }
    }

    // Standalone order (or unpaired bracket leg fallback)
    const isOpen = o.status === 1;
    const singleDisplay: SingleOrderDisplay = {
      kind: "single",
      id: o.id,
      order: o,
      orderKind: kindFromType(o.orderType),
      isOpen,
      isHistory: !isOpen,
    };
    items.push(singleDisplay);
  }

  const open = items.filter((item) => item.isOpen);
  const history = items.filter((item) => item.isHistory);

  // Sort descending by id so newest orders show first
  open.sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));
  history.sort((a, b) => (b.id > a.id ? 1 : b.id < a.id ? -1 : 0));

  return { open, history };
}
