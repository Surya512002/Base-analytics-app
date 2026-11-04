/**
 * Smarter Alerts Engine
 * Multi-condition alert monitoring:
 * - Target price crosses
 * - Whale DEX swaps (> $25,000)
 * - Yield spikes (> 5% APY)
 * - Liquidity drops (> 15%)
 * Supports In-App, Browser Notification, and Custom Webhook (Discord / Slack).
 */

export type AlertTriggerType = "price" | "whale_swap" | "yield_spike" | "liquidity_drop";
export type AlertChannel = "in_app" | "browser" | "webhook";

export interface SmarterAlert {
  id: string;
  wallet?: string;
  type: AlertTriggerType;
  channel: AlertChannel;
  targetSymbol: string;
  targetAddress?: string;
  thresholdValue: number;
  direction?: "above" | "below";
  webhookUrl?: string;
  createdAt: number;
  triggered: boolean;
  lastTriggeredAt?: number;
}

export interface AlertEvaluationEvent {
  symbol: string;
  currentPriceUsd?: number;
  swapAmountUsd?: number;
  currentApy?: number;
  previousApy?: number;
  currentLiquidityUsd?: number;
  previousLiquidityUsd?: number;
}

export interface EvaluationResult {
  triggered: boolean;
  reason: string;
  details?: Record<string, unknown>;
}

/**
 * Evaluates whether an event satisfies a smart alert rule.
 */
export function evaluateAlertTrigger(
  alert: SmarterAlert,
  event: AlertEvaluationEvent
): EvaluationResult {
  if (alert.targetSymbol.toUpperCase() !== event.symbol.toUpperCase()) {
    return { triggered: false, reason: "Symbol mismatch" };
  }

  switch (alert.type) {
    case "price": {
      if (typeof event.currentPriceUsd !== "number" || event.currentPriceUsd <= 0) {
        return { triggered: false, reason: "Price data unavailable" };
      }
      if (alert.direction === "above" && event.currentPriceUsd >= alert.thresholdValue) {
        return {
          triggered: true,
          reason: `${alert.targetSymbol} reached $${event.currentPriceUsd.toFixed(2)} (>= $${alert.thresholdValue})`,
        };
      }
      if (alert.direction === "below" && event.currentPriceUsd <= alert.thresholdValue) {
        return {
          triggered: true,
          reason: `${alert.targetSymbol} dropped to $${event.currentPriceUsd.toFixed(2)} (<= $${alert.thresholdValue})`,
        };
      }
      return { triggered: false, reason: "Price condition not met" };
    }

    case "whale_swap": {
      const swapUsd = event.swapAmountUsd ?? 0;
      if (swapUsd >= alert.thresholdValue) {
        return {
          triggered: true,
          reason: `Whale swap of $${swapUsd.toLocaleString()} detected on ${alert.targetSymbol} (Threshold: $${alert.thresholdValue.toLocaleString()})`,
        };
      }
      return { triggered: false, reason: "Swap amount below whale threshold" };
    }

    case "yield_spike": {
      if (typeof event.currentApy !== "number" || typeof event.previousApy !== "number") {
        return { triggered: false, reason: "APY history unavailable" };
      }
      const spike = event.currentApy - event.previousApy;
      if (spike >= alert.thresholdValue) {
        return {
          triggered: true,
          reason: `${alert.targetSymbol} yield spiked +${spike.toFixed(1)}% (Now ${event.currentApy.toFixed(1)}% APY)`,
        };
      }
      return { triggered: false, reason: "Yield change below spike threshold" };
    }

    case "liquidity_drop": {
      if (
        typeof event.currentLiquidityUsd !== "number" ||
        typeof event.previousLiquidityUsd !== "number" ||
        event.previousLiquidityUsd <= 0
      ) {
        return { triggered: false, reason: "Liquidity history unavailable" };
      }
      const dropPct =
        ((event.previousLiquidityUsd - event.currentLiquidityUsd) /
          event.previousLiquidityUsd) *
        100;
      if (dropPct >= alert.thresholdValue) {
        return {
          triggered: true,
          reason: `${alert.targetSymbol} pool liquidity dropped by ${dropPct.toFixed(1)}% (>= ${alert.thresholdValue}%)`,
        };
      }
      return { triggered: false, reason: "Liquidity change within normal range" };
    }

    default:
      return { triggered: false, reason: "Unknown alert type" };
  }
}

const STORAGE_KEY = "base_smarter_alerts_registry";
let memoryAlerts: SmarterAlert[] = [];

export function _resetAlertMemoryStoreForTesting(): void {
  memoryAlerts = [];
}

export function readSmarterAlerts(wallet?: string | null): SmarterAlert[] {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const raw = localStorage.getItem(`${STORAGE_KEY}_${wallet?.toLowerCase() ?? "guest"}`);
      return raw ? JSON.parse(raw) : [];
    }
    return memoryAlerts;
  } catch {
    return memoryAlerts;
  }
}

export function saveSmarterAlert(
  wallet: string | null | undefined,
  alert: Omit<SmarterAlert, "id" | "createdAt" | "triggered">
): SmarterAlert[] {
  const newAlert: SmarterAlert = {
    ...alert,
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    wallet: wallet || undefined,
    createdAt: Date.now(),
    triggered: false,
  };

  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const key = `${STORAGE_KEY}_${wallet?.toLowerCase() ?? "guest"}`;
      const existing = readSmarterAlerts(wallet);
      const updated = [newAlert, ...existing];
      localStorage.setItem(key, JSON.stringify(updated));
      return updated;
    }
    memoryAlerts = [newAlert, ...memoryAlerts];
    return memoryAlerts;
  } catch {
    memoryAlerts = [newAlert, ...memoryAlerts];
    return memoryAlerts;
  }
}

export function deleteSmarterAlert(
  wallet: string | null | undefined,
  id: string
): SmarterAlert[] {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const key = `${STORAGE_KEY}_${wallet?.toLowerCase() ?? "guest"}`;
      const existing = readSmarterAlerts(wallet);
      const updated = existing.filter((a) => a.id !== id);
      localStorage.setItem(key, JSON.stringify(updated));
      return updated;
    }
    memoryAlerts = memoryAlerts.filter((a) => a.id !== id);
    return memoryAlerts;
  } catch {
    memoryAlerts = memoryAlerts.filter((a) => a.id !== id);
    return memoryAlerts;
  }
}
