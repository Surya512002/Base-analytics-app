"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Wallet, ChevronRight, Loader2 } from "lucide-react";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { parseSwapUrlParams } from "@/lib/swap/swap-link";
import { resolveSwapToken } from "@/lib/swap/token-metadata";
import { isVerifiedBaseToken } from "@/lib/swap/verified-tokens";
import { useWalletHoldings } from "@/hooks/useWalletHoldings";
import DexSwapCard from "@/components/swap/DexSwapCard";
import HoldingsDrawer from "@/components/swap/HoldingsDrawer";
import PopularChips from "@/components/swap/PopularChips";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";

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

  const handleBuyTokenChange = useCallback((counter: SwapCounter | null) => {
    setBuyToken(counter);
  }, []);

  const buyAddr = buyToken?.kind === "token" ? buyToken.address : null;
  const fromAddr = fromPick?.kind === "token" ? fromPick.address : null;
  const extraTokens = useMemo(() => {
    const list: string[] = [];
    if (initialToken && initialToken.startsWith("0x")) list.push(initialToken);
    const buyParam = searchParams?.get("buy");
    if (buyParam && buyParam.startsWith("0x")) list.push(buyParam);
    const sellParam = searchParams?.get("sell");
    if (sellParam && sellParam.startsWith("0x")) list.push(sellParam);
    if (buyAddr) list.push(buyAddr);
    if (fromAddr) list.push(fromAddr);
    return list;
  }, [initialToken, searchParams, buyAddr, fromAddr]);

  // Hook for wallet holdings, dust filter, and total USD balance
  const holdingsState = useWalletHoldings(app.wallet?.address, extraTokens);
  const {
    allTokens,
    totalUsd,
    unpricedTokens,
    loading: holdingsLoading,
  } = holdingsState;

  const showToastRef = useRef(app.showToast);
  useEffect(() => {
    showToastRef.current = app.showToast;
  }, [app.showToast]);

  const lastIngestedKeyRef = useRef<string | null>(null);

  // Ingest URL params once per unique parameter set — never re-run merely on app re-render
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

    const ingestionKey = `${buyParam || ""}|${sellParam || ""}|${amountParam || ""}`;
    if (lastIngestedKeyRef.current === ingestionKey) {
      return;
    }
    lastIngestedKeyRef.current = ingestionKey;

    if (amountParam) {
      setUrlAmount(amountParam);
    }

    if (buyParam) {
      setLoadingBuyMetadata(true);
      void resolveSwapToken(buyParam).then((res) => {
        setLoadingBuyMetadata(false);
        if (res.counter) {
          const verified = isVerifiedBaseToken(res.counter);
          setBuyToken({
            ...res.counter,
            isVerified: verified,
            isUnverified: verified ? false : Boolean(res.counter.isUnverified),
          });
        } else if (res.error) {
          showToastRef.current(res.error, "");
        }
      });
    }

    if (sellParam) {
      setLoadingSellMetadata(true);
      void resolveSwapToken(sellParam).then((res) => {
        setLoadingSellMetadata(false);
        if (res.counter) {
          const verified = isVerifiedBaseToken(res.counter);
          setFromPick({
            ...res.counter,
            isVerified: verified,
            isUnverified: verified ? false : Boolean(res.counter.isUnverified),
          });
        } else if (res.error) {
          showToastRef.current(res.error, "");
        }
      });
    }
  }, [searchParams, initialToken]);

  return (
    <div className="w-full max-w-[480px] mx-auto space-y-3 pb-8">
      {/* Portfolio Summary Line above Swap Card */}
      <div className="pop flex items-center justify-between px-4 py-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] shadow-xs">
        <button
          type="button"
          onClick={() => setHoldingsDrawerOpen(true)}
          className="flex items-center gap-2 group text-left cursor-pointer transition hover:opacity-85"
        >
          <div className="w-7 h-7 rounded-lg bg-[var(--brand)]/10 text-[var(--brand-text)] flex items-center justify-center shrink-0">
            <Wallet size={15} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--ink-muted)]">
              Base Portfolio
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-[var(--ink)] tabular-nums">
                {holdingsLoading ? (
                  <span className="inline-flex items-center gap-1 text-[var(--ink-muted)]">
                    <Loader2 size={12} className="animate-spin" /> Loading…
                  </span>
                ) : (
                  `$${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                )}
              </span>
              <span className="text-[11px] text-[var(--ink-muted)]">
                · {allTokens.length} assets
              </span>
              {unpricedTokens.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] font-medium">
                  +{unpricedTokens.length} unpriced
                </span>
              )}
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setHoldingsDrawerOpen(true)}
          className="p-1 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition"
          aria-label="Open portfolio drawer"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Main Single Action Swap Card */}
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
        onBuyTokenChange={handleBuyTokenChange}
        loadingBuyMetadata={loadingBuyMetadata}
        loadingSellMetadata={loadingSellMetadata}
        initialAmount={urlAmount}
      />

      {/* Popular Chips Row below Swap Card */}
      <PopularChips
        currentBuyToken={buyToken}
        onSelectBuyToken={handleBuyTokenChange}
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
