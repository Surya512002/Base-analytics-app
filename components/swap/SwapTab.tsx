"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { resolveTokenByAddress } from "@/lib/api/launchpad-client";
import { buildSwapTokenPath, resolveTokenFromUrl, syncTabUrl } from "@/lib/utils/app-url";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import SwapQuickPick from "@/components/swap/SwapQuickPick";

const DexSwapPanel = dynamic(() => import("@/components/swap/DexSwapPanel"), {
  loading: () => (
    <div className="dex-swap-card h-[340px] animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]" />
  ),
});

export default function SwapTab({
  app,
  guestMode,
  onRequestConnect,
  initialToken,
}: {
  app: WalletAppState;
  guestMode?: boolean;
  onRequestConnect?: () => void;
  initialToken?: string | null;
}) {
  const [prefill, setPrefill] = useState<LaunchedToken | null>(null);
  const [sidebarPick, setSidebarPick] = useState<SwapCounter | null>(null);
  const resolvingRef = useRef(false);

  const resolveAndPrefill = useCallback(
    async (addr: string) => {
      if (resolvingRef.current) return;
      resolvingRef.current = true;
      try {
        const { token } = await resolveTokenByAddress(addr);
        if (token) {
          setPrefill(token);
          syncTabUrl("swap", { token: token.address });
          if (typeof window !== "undefined" && window.location.pathname.startsWith("/swap")) {
            window.history.replaceState({}, "", buildSwapTokenPath(token.address));
          }
        } else {
          app.showToast("Token not found on Base — check the address", "");
        }
      } finally {
        resolvingRef.current = false;
      }
    },
    [app]
  );

  useEffect(() => {
    const fromProp = initialToken?.trim().toLowerCase();
    const fromUrl = resolveTokenFromUrl();
    const addr = fromProp ?? fromUrl;
    if (!addr?.startsWith("0x") || addr.length !== 42) return;
    void resolveAndPrefill(addr);
  }, [initialToken, resolveAndPrefill]);

  const panelKey = useMemo(() => prefill?.address ?? "default", [prefill?.address]);

  return (
    <div className="dex-swap-page">
      <DexSwapPanel
        key={panelKey}
        app={app}
        guestMode={guestMode}
        onRequestConnect={onRequestConnect}
        prefillToken={prefill}
        prefillReceiveCounter={sidebarPick}
        onPrefillReceiveApplied={() => setSidebarPick(null)}
      />
      <SwapQuickPick onPick={setSidebarPick} />
    </div>
  );
}
