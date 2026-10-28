"use client";

import { useEffect, useState, useCallback } from "react";

export const STOCK_ACKNOWLEDGEMENT_VERSION = "1.0";
const STORAGE_KEY = `base_stock_ack_v${STOCK_ACKNOWLEDGEMENT_VERSION}`;

export interface ComplianceStatusState {
  country: string | null;
  isRestricted: boolean;
  mode: "full" | "exit-only" | "blocked";
  canEnter: boolean;
  canExit: boolean;
  globalKillSwitch: boolean;
  features: {
    "stocks.swap": boolean;
    "stocks.lend": boolean;
    "stocks.launchPairs": boolean;
    "stocks.vouchers": boolean;
  };
  notice: string;
  issuerTermsUrl: string;
  acknowledgementVersion: string;
}

const DEFAULT_STATE: ComplianceStatusState = {
  country: null,
  isRestricted: false,
  mode: "full",
  canEnter: true,
  canExit: true,
  globalKillSwitch: false,
  features: {
    "stocks.swap": true,
    "stocks.lend": true,
    "stocks.launchPairs": true,
    "stocks.vouchers": true,
  },
  notice: "Availability of tokenized stocks may depend on your location and the issuer's terms.",
  issuerTermsUrl: "https://www.coinbase.com/legal/tokenized-stocks",
  acknowledgementVersion: STOCK_ACKNOWLEDGEMENT_VERSION,
};

let cachedState: ComplianceStatusState | null = null;

export function useCompliance() {
  const [status, setStatus] = useState<ComplianceStatusState>(cachedState || DEFAULT_STATE);
  const [hasAcknowledged, setHasAcknowledged] = useState<boolean>(true); // default true before check to avoid flicker
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Check client-side acknowledgement in localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.version === STOCK_ACKNOWLEDGEMENT_VERSION && parsed.timestamp) {
          setHasAcknowledged(true);
          return;
        }
      }
      setHasAcknowledged(false);
    } catch {
      setHasAcknowledged(false);
    }
  }, []);

  // Fetch server-verified compliance status
  useEffect(() => {
    let unmounted = false;
    async function loadStatus() {
      try {
        const res = await fetch("/api/compliance/status", { cache: "no-store" });
        if (!res.ok) return;
        const data: ComplianceStatusState = await res.json();
        if (!unmounted) {
          cachedState = data;
          setStatus(data);
        }
      } catch {
        // Fall back to default
      }
    }
    loadStatus();
    return () => {
      unmounted = true;
    };
  }, []);

  const acknowledge = useCallback(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: STOCK_ACKNOWLEDGEMENT_VERSION,
          timestamp: Date.now(),
        })
      );
      setHasAcknowledged(true);
      setModalOpen(false);
      if (pendingAction) {
        pendingAction();
        setPendingAction(null);
      }
    } catch {
      setHasAcknowledged(true);
      setModalOpen(false);
    }
  }, [pendingAction]);

  /**
   * Evaluates if a given stock action is permissible under the user's regional mode.
   * If permissible and risk not yet acknowledged, opens the acknowledgement modal.
   */
  const guardStockAction = useCallback(
    (
      actionType: "enter" | "exit",
      onProceed: () => void,
      onBlocked?: (reason: string) => void
    ) => {
      // 1. If kill switch active
      if (status.globalKillSwitch && actionType === "enter") {
        const msg = "Tokenized stock features are temporarily paused for maintenance.";
        onBlocked?.(msg);
        return false;
      }

      // 2. If restricted region
      if (status.isRestricted) {
        if (actionType === "enter" && !status.canEnter) {
          const msg = "Tokenized stock features are not available in your region.";
          onBlocked?.(msg);
          return false;
        }
        // In exit-only mode, exiting is permitted!
      }

      // 3. Acknowledgement check
      if (!hasAcknowledged) {
        setPendingAction(() => onProceed);
        setModalOpen(true);
        return false;
      }

      onProceed();
      return true;
    },
    [status, hasAcknowledged]
  );

  return {
    status,
    isRestricted: status.isRestricted,
    mode: status.mode,
    canEnter: status.canEnter,
    canExit: status.canExit,
    country: status.country,
    hasAcknowledged,
    modalOpen,
    openModal: () => setModalOpen(true),
    closeModal: () => {
      setModalOpen(false);
      setPendingAction(null);
    },
    acknowledge,
    guardStockAction,
  };
}
