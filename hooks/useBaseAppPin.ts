"use client";

import { useCallback, useEffect, useState } from "react";
import {
  dismissPinBanner,
  isBaseAppShell,
  promptPinBaseApp,
  readLocalPinState,
  readPinBannerDismissed,
  subscribePinSdkEvents,
} from "@/lib/utils/base-app-pin";

export function useBaseAppPin(walletAddress?: string | null) {
  const [showBanner, setShowBanner] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [appPinned, setAppPinned] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [checked, setChecked] = useState(false);

  const refreshStatus = useCallback(async () => {
    const local = readLocalPinState();
    if (local === "notifs") {
      setAppPinned(true);
      setNotificationsEnabled(true);
      setShowBanner(false);
      return;
    }
    if (local === "pinned") {
      setAppPinned(true);
      setNotificationsEnabled(false);
    }

    if (!walletAddress) return;

    try {
      const r = await fetch(
        `/api/base-app/pin-status?address=${encodeURIComponent(walletAddress)}`,
        { cache: "no-store" }
      );
      if (!r.ok) return;
      const data = (await r.json()) as {
        appPinned?: boolean;
        notificationsEnabled?: boolean;
      };
      setAppPinned(data.appPinned === true);
      setNotificationsEnabled(data.notificationsEnabled === true);
      if (data.appPinned && data.notificationsEnabled) {
        setShowBanner(false);
      }
    } catch {
      /* optional */
    }
  }, [walletAddress]);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const inBase = await isBaseAppShell();
      if (!alive) return;
      setChecked(true);
      if (!inBase || readPinBannerDismissed()) {
        setShowBanner(false);
        return;
      }
      setShowBanner(true);
      await refreshStatus();
    })();

    const unsub = subscribePinSdkEvents({
      onAdded: (enabled) => {
        setAppPinned(true);
        setNotificationsEnabled(enabled);
        setShowBanner(false);
      },
      onRejected: () => setPinning(false),
    });

    return () => {
      alive = false;
      unsub();
    };
  }, [refreshStatus]);

  useEffect(() => {
    if (walletAddress) void refreshStatus();
  }, [walletAddress, refreshStatus]);

  const pinApp = useCallback(async () => {
    setPinning(true);
    const result = await promptPinBaseApp();
    setPinning(false);
    if (result.ok) {
      setAppPinned(true);
      setNotificationsEnabled(result.notificationsEnabled);
      setShowBanner(false);
      return { ok: true as const, notificationsEnabled: result.notificationsEnabled };
    }
    return { ok: false as const, reason: result.reason };
  }, []);

  const dismiss = useCallback(() => {
    dismissPinBanner();
    setShowBanner(false);
  }, []);

  return {
    checked,
    showBanner,
    pinning,
    appPinned,
    notificationsEnabled,
    pinApp,
    dismiss,
    refreshStatus,
  };
}
