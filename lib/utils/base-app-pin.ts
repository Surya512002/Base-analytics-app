"use client";

import { detectMiniAppHost, detectMiniAppConnType } from "@/lib/utils/wallet-connection";

const DISMISS_KEY = "base_pin_banner_dismissed_v1";
const PINNED_KEY = "base_app_pinned_v1";

export type PinPromptResult =
  | { ok: true; notificationsEnabled: boolean }
  | { ok: false; reason: "not_mini_app" | "rejected" | "invalid_manifest" | "error" };

export function readPinBannerDismissed(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(DISMISS_KEY) === "1";
}

export function dismissPinBanner(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DISMISS_KEY, "1");
}

export function markAppPinnedLocally(notificationsEnabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(PINNED_KEY, notificationsEnabled ? "notifs" : "pinned");
}

export function readLocalPinState(): "none" | "pinned" | "notifs" {
  if (typeof window === "undefined") return "none";
  const v = localStorage.getItem(PINNED_KEY);
  if (v === "notifs") return "notifs";
  if (v === "pinned") return "pinned";
  return "none";
}

export async function isBaseAppShell(): Promise<boolean> {
  if (!(await detectMiniAppConnType())) return false;
  const host = await detectMiniAppHost();
  return host === "base" || host === "other";
}

/** Prompt user to pin Base Analytics in Base App (enables notification opt-in). */
export async function promptPinBaseApp(): Promise<PinPromptResult> {
  if (!(await detectMiniAppConnType())) {
    return { ok: false, reason: "not_mini_app" };
  }

  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    if (sdk?.actions?.ready) {
      try {
        await sdk.actions.ready();
      } catch {
        /* ignore */
      }
    }

    const add = sdk.actions.addMiniApp ?? sdk.actions.addFrame;
    if (!add) return { ok: false, reason: "error" };

    const result = await add();
    const hasNotifs = Boolean(result?.notificationDetails);
    markAppPinnedLocally(hasNotifs);
    return { ok: true, notificationsEnabled: hasNotifs };
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name.includes("RejectedByUser")) {
      return { ok: false, reason: "rejected" };
    }
    if (name.includes("InvalidDomainManifest")) {
      return { ok: false, reason: "invalid_manifest" };
    }
    return { ok: false, reason: "error" };
  }
}

export function subscribePinSdkEvents(handlers: {
  onAdded?: (notificationsEnabled: boolean) => void;
  onRejected?: () => void;
}): () => void {
  let alive = true;
  void import("@farcaster/miniapp-sdk").then(({ sdk }) => {
    if (!alive) return;

    const onAdded = (payload: { notificationDetails?: unknown }) => {
      const enabled = Boolean(payload?.notificationDetails);
      markAppPinnedLocally(enabled);
      handlers.onAdded?.(enabled);
    };

    sdk.on?.("miniAppAdded", onAdded);
    sdk.on?.("miniAppAddRejected", () => handlers.onRejected?.());
    sdk.on?.("notificationsEnabled", () => {
      markAppPinnedLocally(true);
      handlers.onAdded?.(true);
    });
  });

  return () => {
    alive = false;
  };
}
