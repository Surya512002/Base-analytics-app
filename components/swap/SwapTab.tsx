"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { resolveTokenByAddress } from "@/lib/api/launchpad-client";
import { buildSwapTokenPath, resolveTokenFromUrl, syncTabUrl } from "@/lib/utils/app-url";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import SwapQuickPick from "@/components/swap/SwapQuickPick";
import WalletHoldings from "@/components/swap/WalletHoldings";

const DexSwapPanel = dynamic(() => import("@/components/swap/DexSwapPanel"), {
  loading: () => (
    <div className="dex-swap-card h-[340px] animate-pulse rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)]" />
  ),
});

function normalizeTokenAddr(raw: string | null | undefined): string | null {
  const t = raw?.trim().toLowerCase();
  if (!t?.startsWith("0x") || t.length !== 42) return null;
  return t;
}

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
  const [fromPick, setFromPick] = useState<SwapCounter | null>(null);
  const resolvingAddrRef = useRef<string | null>(null);
  const lastPrefillAddrRef = useRef<string | null>(null);

  const resolveAndPrefill = useCallback(
    async (addr: string) => {
      const key = normalizeTokenAddr(addr);
      if (!key) return;
      if (resolvingAddrRef.current === key) return;
      if (lastPrefillAddrRef.current === key) return;
      resolvingAddrRef.current = key;
      try {
        const { token } = await resolveTokenByAddress(key);
        if (token) {
          lastPrefillAddrRef.current = token.address.toLowerCase();
          setPrefill(token);
          syncTabUrl("swap", { token: token.address });
          if (typeof window !== "undefined" && window.location.pathname.startsWith("/swap")) {
            const path = buildSwapTokenPath(token.address);
            if (window.location.pathname.toLowerCase() !== path.toLowerCase()) {
              window.history.replaceState({}, "", path);
            }
          }
        } else {
          app.showToast("Token not found on Base — check the address", "");
        }
      } finally {
        if (resolvingAddrRef.current === key) resolvingAddrRef.current = null;
      }
    },
    [app]
  );

  useEffect(() => {
    const fromProp = normalizeTokenAddr(initialToken);
    const fromUrl = resolveTokenFromUrl();
    let fromPath: string | null = null;
    if (typeof window !== "undefined") {
      const m = window.location.pathname.match(/^\/swap\/token\/(0x[a-fA-F0-9]{40})\/?$/i);
      if (m?.[1]) fromPath = m[1].toLowerCase();
    }
    const addr = fromProp ?? fromPath ?? fromUrl;
    if (!addr) return;
    if (lastPrefillAddrRef.current && lastPrefillAddrRef.current !== addr) {
      lastPrefillAddrRef.current = null;
    }
    void resolveAndPrefill(addr);
  }, [initialToken, resolveAndPrefill]);

  const panelKey = useMemo(() => prefill?.address ?? "default", [prefill?.address]);

  return (
    <div className="dex-swap-page space-y-4">
      <div
        className="rounded-2xl border px-4 py-3 overflow-hidden relative"
        style={{
          borderColor: "rgba(99,102,241,0.28)",
          background:
            "linear-gradient(135deg, rgba(99,102,241,0.1), var(--surface) 60%)",
        }}
      >
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-indigo-500 via-violet-400 to-blue-400" />
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-800">
          Swap
        </p>
        <p className="text-sm text-indigo-950/70 mt-0.5">
          Route via Uniswap + Aerodrome + 0x on Base
        </p>
      </div>
      {!guestMode && app.wallet?.address && (
        <WalletHoldings
          walletAddress={app.wallet.address}
          ethUsd={2500}
          onSelectToken={setFromPick}
        />
      )}
      <DexSwapPanel
        key={panelKey}
        app={app}
        guestMode={guestMode}
        onRequestConnect={onRequestConnect}
        prefillToken={prefill}
        prefillReceiveCounter={sidebarPick}
        onPrefillReceiveApplied={() => setSidebarPick(null)}
        prefillFromCounter={fromPick}
        onPrefillFromApplied={() => setFromPick(null)}
      />
      <SwapQuickPick onPick={setSidebarPick} />
    </div>
  );
}
