import { NextResponse } from "next/server";
import { fetchMarketSummaries } from "@/lib/launchpad/dexscreener";
import { sendBaseNotification } from "@/lib/base/notifications-client";
import {
  listActivePriceAlerts,
  markPriceAlertTriggered,
} from "@/lib/price-alerts/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function assertCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV === "development";
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!assertCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey =
    process.env.BASE_DASHBOARD_API_KEY?.trim() ||
    process.env.BASE_NOTIFICATIONS_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({
      ok: true,
      checked: 0,
      triggered: 0,
      skipped: "BASE_DASHBOARD_API_KEY not set",
    });
  }

  const alerts = await listActivePriceAlerts();
  if (!alerts.length) {
    return NextResponse.json({ ok: true, checked: 0, triggered: 0 });
  }

  const addresses = [...new Set(alerts.map((a) => a.address))];
  const markets = await fetchMarketSummaries(addresses);

  let triggered = 0;

  for (const alert of alerts) {
    const price = markets[alert.address]?.priceUsd;
    if (price == null || price <= 0) continue;

    const hit =
      (alert.direction === "above" && price >= alert.priceUsd) ||
      (alert.direction === "below" && price <= alert.priceUsd);
    if (!hit) continue;

    try {
      await sendBaseNotification({
        walletAddresses: [alert.wallet],
        title: `$${alert.symbol.slice(0, 10)} alert`,
        message: `${alert.symbol} is ${alert.direction} $${alert.priceUsd.toFixed(
          price < 0.01 ? 6 : 4
        )} — now $${price < 0.01 ? price.toExponential(2) : price.toFixed(4)}`,
        targetPath: `/explore/token/${alert.address}`,
      });
      await markPriceAlertTriggered(alert.id);
      triggered += 1;
    } catch (e) {
      console.warn("[cron/price-alerts]", alert.id, e);
    }
  }

  return NextResponse.json({
    ok: true,
    checked: alerts.length,
    triggered,
  });
}
