"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
import SwapTokenActivity from "@/components/swap/SwapTokenActivity";
import SwapPortfolio from "@/components/swap/SwapPortfolio";
import SwapTokenInsight, { RecentSwapTokens } from "@/components/swap/SwapTokenInsight";
import type { SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import { useLimitOrders } from "@/src/lib/limitOrders/useLimitOrders";
import { isLimitOrdersFeatureEnabled } from "@/src/lib/limitOrders/featureFlag";
import Link from "next/link";
import { LIMIT_ORDERS_HREF } from "@/lib/constants/destinations";
import RecurringHub from "@/components/swap/orders/RecurringHub";

type SwapSubTab = "market" | "recurring";

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

  // Old links to the Swap orders tab now open the order ticket in Trade, keeping the chosen token.
  const router = useRouter();
  const wantsOrders = searchParams?.get("mode") === "orders";
  const ordersToken = searchParams?.get("buy");
  useEffect(() => {
    if (wantsOrders) router.replace(ordersToken ? `${LIMIT_ORDERS_HREF}&token=${encodeURIComponent(ordersToken)}` : LIMIT_ORDERS_HREF);
  }, [wantsOrders, ordersToken, router]);

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
    refresh: refreshHoldings,
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
    if (modeParam === "recurring" || modeParam === "market") {
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
    <div className={`w-full mx-auto space-y-3 pb-8 ${activeSubTab === "recurring" ? "max-w-[480px] lg:max-w-5xl" : "max-w-[480px]"}`}>
      {/* Top Navigation Bar: Market | Orders | Recurring (Orders & Recurring gated by feature flag) */}
      {isOrdersEnabled && (
        <div className="mx-auto flex w-full max-w-[480px] items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-2)] p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveSubTab("market")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-bold transition ${
              activeSubTab === "market"
                ? "pulse-tab-on"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <BarChart2 size={14} />
            <span>Market</span>
          </button>

          <Link
            href={LIMIT_ORDERS_HREF}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-bold transition text-[var(--ink-muted)] hover:text-[var(--ink)]"
          >
            <Layers size={14} />
            <span>Limit orders</span>
            {limitOrders.openOrders.length > 0 && (
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-[#0052FF] text-white">
                {limitOrders.openOrders.length}
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setActiveSubTab("recurring")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-bold transition ${
              activeSubTab === "recurring"
                ? "pulse-tab-on"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)]"
            }`}
          >
            <Repeat size={14} />
            <span>Auto-invest</span>
            {limitOrders.plans.length > 0 && (
              <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-cyan-600 text-white">
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
          {Boolean(app.wallet?.address) && !guestMode && (
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
                  <span className="text-[11px] uppercase font-bold tracking-wider text-[var(--ink-muted)]">
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
                      <span className="text-[11px] px-1.5 py-0.2 rounded-full bg-[var(--surface-2)] text-[var(--ink-muted)] font-medium">
                        +{unpricedTokens.length} unpriced
                      </span>
                    )}
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setHoldingsDrawerOpen(true)}
                className="tap-target p-1 rounded-lg text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition"
                aria-label="Open portfolio drawer"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}

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

          {/* Tokens picked recently (this browser only) */}
          <RecentSwapTokens current={buyToken} onSelect={handleBuyTokenChange} />

          {/* What you're buying: price, liquidity, volume, buy/sell split and warnings */}
          <SwapTokenInsight token={buyToken} />

          {/* Live buys / sells of the token being bought, with Share and Chart */}
          <SwapTokenActivity token={buyToken} />

          {/* Your holdings: one tap to sell a token or buy more of it */}
          <SwapPortfolio
            tokens={allTokens}
            totalUsd={totalUsd}
            loading={holdingsLoading}
            connected={Boolean(app.wallet?.address) && !guestMode}
            onConnect={onRequestConnect}
            onSell={(counter) => {
              setFromPick(counter);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onBuy={(counter) => {
              setSidebarPick(counter);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onOpenAll={() => setHoldingsDrawerOpen(true)}
            onRefresh={() => void refreshHoldings()}
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

      {/* RECURRING TAB: Recurring buys (DCA) with optional price ceiling */}
      {isOrdersEnabled && activeSubTab === "recurring" && (
        <RecurringHub
          initialPlan={searchParams?.get("plan") === "basket" ? "basket" : undefined}
          limitOrders={limitOrders}
          onConnectWallet={onRequestConnect}
          onSwitchChain={handleSwitchBase}
          onSwitchSepolia={handleSwitchSepolia}
        />
      )}
    </div>
  );
}
