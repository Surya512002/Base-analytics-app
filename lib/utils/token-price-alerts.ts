export type PriceAlert = {
  address: string;
  symbol: string;
  direction: "above" | "below";
  priceUsd: number;
  createdAt: number;
  triggered?: boolean;
};

const KEY = "base_token_price_alerts";

export function readPriceAlerts(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PriceAlert[]) : [];
  } catch {
    return [];
  }
}

export function writePriceAlerts(alerts: PriceAlert[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(alerts));
}

export function addPriceAlert(alert: Omit<PriceAlert, "createdAt" | "triggered">): PriceAlert[] {
  const next: PriceAlert = { ...alert, createdAt: Date.now(), triggered: false };
  const list = readPriceAlerts().filter((a) => a.address !== alert.address);
  list.unshift(next);
  writePriceAlerts(list.slice(0, 24));
  return readPriceAlerts();
}

export function removePriceAlert(address: string) {
  writePriceAlerts(readPriceAlerts().filter((a) => a.address !== address.toLowerCase()));
}

export function checkAlerts(
  markets: Record<string, { priceUsd?: number | null }>,
  onTrigger: (alert: PriceAlert, price: number) => void
) {
  const alerts = readPriceAlerts().filter((a) => !a.triggered);
  for (const a of alerts) {
    const price = markets[a.address.toLowerCase()]?.priceUsd;
    if (price == null || price <= 0) continue;
    const hit =
      (a.direction === "above" && price >= a.priceUsd) ||
      (a.direction === "below" && price <= a.priceUsd);
    if (hit) {
      onTrigger(a, price);
      a.triggered = true;
    }
  }
  writePriceAlerts(alerts);
}
