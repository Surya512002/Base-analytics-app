"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Wallet, ChevronRight, Loader2 } from "lucide-react";
import type { WalletAppState } from "@/hooks/useWalletApp";
import type { LaunchedToken } from "@/lib/launchpad/types";
import { parseSwapUrlParams } from "@/lib/swap/swap-link";
import { resolveSwapToken } from "@/lib/swap/token-metadata";
import { syncTabUrl } from "@/lib/utils/app-url";
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
  const searchParams = useSearchParams();
  const [sidebarPick, setSidebarPick] = useState<SwapCounter | null>(null);
  const [fromPick, setFromPick] = useState<SwapCounter | null>(null);
  const [buyToken, setBuyToken] = useState<SwapCounter | null>(null);
  const [loadingBuyMetadata, setLoadingBuyMetadata] = useState(false);
  const [loadingSellMetadata, setLoadingSellMetadata] = useState(false);
  const [urlAmount, setUrlAmount] = useState<string | null>(null);
  const [holdingsDrawerOpen, setHoldingsDrawerOpen] = useState(false);

  // Hook for wallet holdings, dust filter, and total USD balance
  const holdingsState = useWalletHoldings(app.wallet?.address);
  const {
    allTokens,
    totalUsd,
    unpricedTokens,
    loading: holdingsLoading,
  } = holdingsState;

  // Ingest URL params reactively whenever searchParams or initialToken changes
  useEffect(() => {
    const rawSearch = searchParams?.toString()
      ? `?${searchParams.toString()}`
      : typeof window !== "undefined"
        ? window.location.search
        : "";
    const parsed = parseSwapUrlParams(rawSearch);
    const buyParam = parsed.buy || (initialToken ? initialToken.trim().toLowerCase() : null);
    const sellParam = parsed.sell;
    const amountParam = parsed.amount;

    if (amountParam) {
      setUrlAmount(amountParam);
    }

    if (buyParam) {
      setLoadingBuyMetadata(true);
      void resolveSwapToken(buyParam).then((res) => {
        setLoadingBuyMetadata(false);
        if (res.counter) {
          setBuyToken(res.counter);
        } else if (res.error) {
          app.showToast(res.error, "");
        }
      });
    }

    if (sellParam) {
      setLoadingSellMetadata(true);
      void resolveSwapToken(sellParam).then((res) => {
        setLoadingSellMetadata(false);
        if (res.counter) {
          setFromPick(res.counter);
        } else if (res.error) {
          app.showToast(res.error, "");
        }
      });
    }
  }, [searchParams, initialToken, app]);

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
              {holdingsLoading && allTokens.length === 0 ? (
                <span className="text-xs text-[var(--ink-dim)]">Loading…</span>
              ) : (
                <div className="flex items-baseline gap-1.5 truncate">
                  <span className="text-xs font-mono font-black text-[var(--ink)] tabular-nums">
                    {formatUsd(totalUsd)}
                  </span>
                  {unpricedTokens.length > 0 && (
                    <span className="text-[10px] text-[var(--ink-dim)] font-medium">
                      (+{unpricedTokens.length} unpriced)
                    </span>
                  )}
                </div>
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
            className="pop-pill inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-[var(--brand)] hover:bg-[var(--brand-soft)] border border-[var(--brand)]/20 transition-all cursor-pointer shrink-0"
          >
            <span>View tokens</span>
            <span className="font-mono text-[10px] bg-[var(--surface-2)] text-[var(--ink-dim)] px-1 rounded">
              {allTokens.length}
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
        app={app}
        guestMode={guestMode}
        onRequestConnect={onRequestConnect}
        prefillReceiveCounter={sidebarPick}
        onPrefillReceiveApplied={() => setSidebarPick(null)}
        prefillFromCounter={fromPick}
        onPrefillFromApplied={() => setFromPick(null)}
        holdings={allTokens}
        currentBuyToken={buyToken}
        onBuyTokenChange={setBuyToken}
        loadingBuyMetadata={loadingBuyMetadata}
        loadingSellMetadata={loadingSellMetadata}
        initialAmount={urlAmount}
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
        holdingsState={holdingsState}
        onSelectToken={(counter) => {
          setFromPick(counter);
          setHoldingsDrawerOpen(false);
        }}
      />
    </div>
  );
}
