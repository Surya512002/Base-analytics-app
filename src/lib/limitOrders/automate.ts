import { BASE_MAINNET_CONFIG } from "@/src/config/limitOrders";
import { isLimitOrdersFeatureEnabled } from "./featureFlag";

/** Auto-invest and stop-loss run on the order book: only offer them where it is live and lists this token. */
export function canAutomateStock(address: string): boolean {
  if (!isLimitOrdersFeatureEnabled() || /^0x0{40}$/i.test(BASE_MAINNET_CONFIG.orderBook)) return false;
  return BASE_MAINNET_CONFIG.markets.some((m) => m.stockToken.toLowerCase() === address.toLowerCase());
}

/** Trade page deep link that opens the recurring-buy card, or the Simple card on its stop-loss goal. */
export function automateLink(address: string, kind: "auto-invest" | "stop-loss"): string {
  return `/trade?token=${address}&ticket=${kind === "auto-invest" ? "recurring" : "orders&goal=stop-loss"}`;
}
