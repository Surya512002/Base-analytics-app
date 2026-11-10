"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Wallet, ChevronRight, Loader2, BarChart2, Layers, Repeat } from "lucide-react";
import { useSwitchChain } from "wagmi";
import { base } from "viem/chains";
import type { WalletAppState } from "@/hooks/useWalletApp";
import { parseSwapUrlParams } from "@/lib/swap/swap-link";
import { resolveSwapToken } from "@/lib/swap/token-metadata";
import { isVerifiedBaseToken } from "@/lib/swap/verified-tokens";
import { useWalletHoldings } from "@/hooks/useWalletHoldings";
import DexSwapCard from "@/components/swap/DexSwapCard";
import HoldingsDrawer from "@/components/swap/HoldingsDrawer";
import PopularChips from "@/components/swap/PopularChips";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import { useLimitOrders } from "@/src/lib/limitOrders/useLimitOrders";
import {
  isLimitOrdersFeatureEnabled,
  isVercelPreview,
  isExplicitLimitOrdersEnabled,
} from "@/src/lib/limitOrders/featureFlag";
import OrdersView from "@/components/swap/orders/OrdersView";
import RecurringView from "@/components/swap/orders/RecurringView";

type SwapSubTab = "market" | "orders" | "recurring";

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
  const [activeSubTab, setActiveSubTab] = useState<SwapSubTab>("market");

  const [sidebarPick, setSidebarPick] = useState<SwapCounter | null>(null);
  const [fromPick, setFromPick] = useState<SwapCounter | null>(null);
  const [buyToken, setBuyToken] = useState<SwapCounter | null>(null);
  const [sellToken, setSellToken] = useState<SwapCounter | null>(null);
  const [loadingBuyMetadata, setLoadingBuyMetadata] = useState(false);
  const [loadingSellMetadata, setLoadingSellMetadata] = useState(false);
  const [urlAmount, setUrlAmount] = useState<string | null>(null);
  const [holdingsDrawerOpen, setHoldingsDrawerOpen] = useState(false);

  const { switchChain } = useSwitchChain();
  const limitOrders = useLimitOrders(app);

  const isOrdersEnabled = isLimitOrdersFeatureEnabled();
  const isProd = process.env.NODE_ENV === "production";
  const isPreview = isVercelPreview();
  const flagOn = isExplicitLimitOrdersEnabled();

  const showDebugNotice = !isProd || isPreview;
  const debugReasons = useMemo(() => {
    const list: string[] = [];
    if (!flagOn) list.push("flag off (NEXT_PUBLIC_LIMIT_ORDERS_ENABLED != 'true')");
    if (limitOrders.regionRestricted) list.push(`region restricted (${limitOrders.regionCountry || "blocked"})`);
    if (limitOrders.chainId !== 8453 && limitOrders.chainId !== 84532) {
      list.push(`wrong network (chain ID ${limitOrders.chainId})`);
    } else if (
      limitOrders.chainId === 8453 &&
      (!limitOrders.config.orderBook || limitOrders.config.orderBook === "0x0000000000000000000000000000000000000000")
    ) {
      list.push("mainnet order book not deployed yet (switch to Sepolia)");
    }
    return list;
  }, [flagOn, limitOrders.regionRestricted, limitOrders.regionCountry, limitOrders.chainId, limitOrders.config.orderBook]);

  useEffect(() => {
    if (!isOrdersEnabled && activeSubTab !== "market") {
      setActiveSubTab("market");
    }
  }, [isOrdersEnabled, activeSubTab]);

  const handleSwitchBase = useCallback(async () => {
    try {
      switchChain?.({ chainId: base.id });
    } catch {}
    if (typeof window !== "undefined" && (window as any).ethereum?.request) {
      try {
        await (window as any).ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }],
        });
      } catch {}
    }
  }, [switchChain]);

  const handleSwitchSepolia = useCallback(async () => {
    try {
      switchChain?.({ chainId: 84532 });
    } catch {}
    if (typeof window !== "undefined" && (window as any).ethereum?.request) {
      try {
        await (window as any).ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x14a34" }],
        });
      } catch (err: any) {
        if (err?.code === 4902) {
          try {
            await (window as any).ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: "0x14a34",
                  chainName: "Base Sepolia",
                  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                  rpcUrls: ["https://sepolia.base.org"],
                  blockExplorerUrls: ["https://sepolia.basescan.org"],
                },
              ],
            });
          } catch {}
        }
      }
    }
  }, [switchChain]);

  const handleBuyTokenChange = useCallback((counter: SwapCounter | null) => {
    setBuyToken(counter);
  }, []);

  const handleSellTokenChange = useCallback((counter: SwapCounter | null) => {
    setSellToken(counter);
  }, []);

  const buyAddr = buyToken?.kind === "token" ? buyToken.address : null;
  const sellAddr = sellToken?.kind === "token" ? sellToken.address : null;
  const fromAddr = fromPick?.kind === "token" ? fromPick.address : null;
  const extraTokens = useMemo(() => {
    const list: string[] = [];
    if (initialToken && initialToken.startsWith("0x")) list.push(initialToken);
    const buyParam = searchParams?.get("buy");
    if (buyParam && buyParam.startsWith("0x")) list.push(buyParam);
    const sellParam = searchParams?.get("sell");
    if (sellParam && sellParam.startsWith("0x")) list.push(sellParam);
    if (buyAddr) list.push(buyAddr);
    if (sellAddr) list.push(sellAddr);
    if (fromAddr) list.push(fromAddr);
    return list;
  }, [initialToken, searchParams, buyAddr, sellAddr, fromAddr]);

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

    // Check if subtab requested in url (e.g. ?mode=orders or ?tab=recurring)
    const modeParam = searchParams?.get("mode");
    if (modeParam === "orders" || modeParam === "recurring" || modeParam === "market") {
      setActiveSubTab(modeParam);
    }

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
          const fullCounter = {
            ...res.counter,
            isVerified: verified,
            isUnverified: verified ? false : Boolean(res.counter.isUnverified),
          };
          setBuyToken(fullCounter);
          setSidebarPick(fullCounter);
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
      {/* Top Navigation Bar: Market | Orders | Recurring (Orders & Recurring gated by feature flag) */}
      {isOrdersEnabled && (
        <div className="p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)] flex items-center shadow-xs">
          <button
            type="button"
            onClick={() => setActiveSubTab("market")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition ${
              activeSubTab === "market"
                ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <BarChart2 size={14} />
            <span>Market</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("orders")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition ${
              activeSubTab === "orders"
                ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Layers size={14} />
            <span>Orders</span>
            {limitOrders.openOrders.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#0052FF] text-white">
                {limitOrders.openOrders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab("recurring")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition ${
              activeSubTab === "recurring"
                ? "bg-[var(--surface)] text-[var(--ink)] shadow-xs"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Repeat size={14} />
            <span>Recurring</span>
            {limitOrders.plans.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-600 text-white">
                {limitOrders.plans.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* MARKET TAB: Exact original swap functionality */}
      {activeSubTab === "market" && (
        <>
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
            onSellTokenChange={handleSellTokenChange}
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
        </>
      )}

      {/* ORDERS TAB: Pro Order Types (Limit buy, Take-profit, Stop-loss, Trailing stop, Bracket) */}
      {isOrdersEnabled && activeSubTab === "orders" && (
        <OrdersView
          limitOrders={limitOrders}
          onConnectWallet={onRequestConnect}
          onSwitchChain={handleSwitchBase}
          onSwitchSepolia={handleSwitchSepolia}
        />
      )}

      {/* RECURRING TAB: Recurring buys (DCA) with optional price ceiling */}
      {isOrdersEnabled && activeSubTab === "recurring" && (
        <RecurringView
          limitOrders={limitOrders}
          onConnectWallet={onRequestConnect}
          onSwitchChain={handleSwitchBase}
          onSwitchSepolia={handleSwitchSepolia}
        />
      )}

      {/* Development & Vercel Preview Debug Notice */}
      {showDebugNotice && debugReasons.length > 0 && (
        <div
          data-testid="limit-orders-debug-notice"
          className="text-[11px] font-mono text-[var(--ink-muted)] text-center px-3 py-1.5 bg-[var(--surface-2)]/60 rounded-xl border border-dashed border-[var(--border-subtle)]"
        >
          Debug (dev/preview): {debugReasons.join(" · ")}
        </div>
      )}
    </div>
  );
}
