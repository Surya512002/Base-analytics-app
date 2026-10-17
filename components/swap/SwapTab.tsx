"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Wallet, ChevronRight, Loader2 } from "lucide-react";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { resolveTokenByAddress } from "@/lib/api/launchpad-client";
import { buildSwapTokenPath, resolveTokenFromUrl, syncTabUrl } from "@/lib/utils/app-url";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import { useWalletHoldings } from "@/hooks/useWalletHoldings";
import { formatUsd } from "@/lib/launchpad/format";
import DexSwapCard from "./DexSwapCard";
import PopularChips from "./PopularChips";
import HoldingsDrawer from "./HoldingsDrawer";

export default function SwapTab({
  app,
  guestMode = false,
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
  const [buyToken, setBuyToken] = useState<SwapCounter | null>(null);
  const [holdingsDrawerOpen, setHoldingsDrawerOpen] = useState(false);
  const resolvingRef = useRef(false);

  // Hook for wallet holdings, dust filter, and total USD balance
  const {
    holdings,
    allHoldings,
    totalUsd,
    dustCount,
    showDust,
    setShowDust,
    loading: holdingsLoading,
    refresh: refreshHoldings,
  } = useWalletHoldings(app.wallet?.address);

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
    <div className="w-full max-w-[480px] mx-auto space-y-3 pb-8">
      {/* Portfolio Summary Line above Swap Card */}
      <div className="pop flex items-center justify-between px-4 py-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-6 w-6 rounded-lg bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center shrink-0">
            <Wallet size={13} />
          </div>
          {app.wallet?.address && !guestMode ? (
            <div className="flex items-baseline gap-1.5 truncate">
              <span className="text-xs text-[var(--ink-muted)] font-medium">Portfolio:</span>
              {holdingsLoading && allHoldings.length === 0 ? (
                <span className="text-xs text-[var(--ink-dim)]">Loading…</span>
              ) : (
                <span className="text-xs font-mono font-black text-[var(--ink)] tabular-nums">
                  {formatUsd(totalUsd)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-[var(--ink-muted)]">Connect to view wallet balances</span>
          )}
        </div>

        {app.wallet?.address && !guestMode ? (
          <button
            type="button"
            onClick={() => setHoldingsDrawerOpen(true)}
            className="pop-pill inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-[var(--brand)] hover:bg-[var(--brand-soft)] border border-[var(--brand)]/20 transition-all cursor-pointer"
          >
            <span>View tokens</span>
            <span className="font-mono text-[10px] bg-[var(--surface-2)] text-[var(--ink-dim)] px-1 rounded">
              {allHoldings.length}
            </span>
            <ChevronRight size={13} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onRequestConnect}
            className="text-xs font-bold text-[var(--brand)] hover:underline cursor-pointer"
          >
            Connect
          </button>
        )}
      </div>

      {/* Hero Swap Card */}
      <DexSwapCard
        key={panelKey}
        app={app}
        guestMode={guestMode}
        onRequestConnect={onRequestConnect}
        prefillToken={prefill}
        prefillReceiveCounter={sidebarPick}
        onPrefillReceiveApplied={() => setSidebarPick(null)}
        prefillFromCounter={fromPick}
        onPrefillFromApplied={() => setFromPick(null)}
        holdings={allHoldings}
        currentBuyToken={buyToken}
        onBuyTokenChange={setBuyToken}
      />

      {/* Popular Chips Row below Swap Card */}
      <PopularChips
        currentBuyToken={buyToken}
        onSelectBuyToken={(counter) => setBuyToken(counter)}
      />

      {/* Holdings Drawer */}
      <HoldingsDrawer
        open={holdingsDrawerOpen}
        onClose={() => setHoldingsDrawerOpen(false)}
        holdings={holdings}
        allHoldings={allHoldings}
        totalUsd={totalUsd}
        loading={holdingsLoading}
        dustCount={dustCount}
        showDust={showDust}
        onToggleDust={() => setShowDust((v) => !v)}
        onSelectToken={(counter) => {
          setFromPick(counter);
          setHoldingsDrawerOpen(false);
        }}
        onRefresh={refreshHoldings}
      />
    </div>
  );
}
