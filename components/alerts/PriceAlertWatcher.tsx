"use client";

import { useEffect, useRef } from "react";
import { ALERTS_CHANGED, alertAddress, dueAlerts, isWatchable } from "@/lib/alerts/price-watch";
import { markSmarterAlertTriggered, readSmarterAlerts } from "@/lib/alerts/smarter-alerts";
import { getStockPricesUsd } from "@/lib/stocks/stock-prices";

const EVERY_MS = 60_000;

/** Checks saved price alerts while the app is open, and says so when one is reached. */
export default function PriceAlertWatcher({ wallet, onAlert }: { wallet: string | null; onAlert: (message: string) => void }) {
  const onAlertRef = useRef(onAlert);
  onAlertRef.current = onAlert;

  useEffect(() => {
    let stopped = false;
    // Alerts set before connecting are kept under "guest" and stay active afterwards.
    const owners = wallet ? [wallet, null] : [null];

    const check = async () => {
      const addresses = owners.flatMap((o) =>
        readSmarterAlerts(o).filter((a) => !a.triggered && isWatchable(a)).map((a) => alertAddress(a)!)
      );
      if (addresses.length === 0) return;
      const prices = await getStockPricesUsd(addresses).catch(() => null);
      if (stopped || !prices) return;
      // Read again after the wait, and mark before telling, so one alert is never announced twice.
      for (const owner of owners) {
        for (const { alert, reason } of dueAlerts(readSmarterAlerts(owner), prices)) {
          markSmarterAlertTriggered(owner, alert.id);
          onAlertRef.current(reason);
          if (alert.channel === "browser" && "Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("Price alert", { body: reason, icon: "/icon-192.png" });
            } catch {
              // Some phone browsers refuse page notifications; the in-app message above still shows.
            }
          }
          window.dispatchEvent(new Event(ALERTS_CHANGED));
        }
      }
    };

    void check();
    const timer = setInterval(() => void check(), EVERY_MS);
    const onChange = () => void check();
    window.addEventListener(ALERTS_CHANGED, onChange);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener(ALERTS_CHANGED, onChange);
    };
  }, [wallet]);

  return null;
}
