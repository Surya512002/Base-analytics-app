import { evaluateAlertTrigger, type SmarterAlert } from "@/lib/alerts/smarter-alerts";
import { TOKENIZED_STOCKS_REGISTRY } from "@/lib/stocks/tokenized-stocks-registry";
import { VERIFIED_BASE_CRYPTO_TOKENS } from "@/lib/swap/verified-tokens";

/** Fired after alerts are added or removed, so the watcher and open lists refresh at once. */
export const ALERTS_CHANGED = "price-alerts-changed";

// Only the official stocks and the curated major tokens can be named by symbol: a symbol alone must
// never resolve to a look-alike token.
const BY_SYMBOL = new Map<string, string>(
  [...VERIFIED_BASE_CRYPTO_TOKENS, ...TOKENIZED_STOCKS_REGISTRY].map((t) => [t.symbol.toUpperCase(), t.address.toLowerCase()])
);
BY_SYMBOL.set("ETH", BY_SYMBOL.get("WETH")!);

/** The token an alert watches, or null when its symbol is not one we can price safely. */
export function alertAddress(alert: Pick<SmarterAlert, "targetAddress" | "targetSymbol">): string | null {
  return alert.targetAddress?.toLowerCase() ?? BY_SYMBOL.get(alert.targetSymbol.trim().toUpperCase()) ?? null;
}

/** Only price alerts are checked; older alerts of other kinds were never sent. */
export const isWatchable = (a: SmarterAlert) => a.type === "price" && alertAddress(a) !== null;

/** Alerts still waiting whose price condition is met now. `prices` is keyed by lower-case address. */
export function dueAlerts(alerts: ReadonlyArray<SmarterAlert>, prices: ReadonlyMap<string, number>) {
  return alerts.flatMap((alert) => {
    if (alert.triggered || !isWatchable(alert)) return [];
    const currentPriceUsd = prices.get(alertAddress(alert)!);
    const result = evaluateAlertTrigger(alert, { symbol: alert.targetSymbol, currentPriceUsd });
    return result.triggered ? [{ alert, reason: result.reason }] : [];
  });
}
