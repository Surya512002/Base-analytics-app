"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Repeat } from "lucide-react";
import type { useLimitOrders } from "@/src/lib/limitOrders/useLimitOrders";
import { getOrdersConfigError } from "@/src/config/limitOrders";
import RecurringCard from "@/components/trade/RecurringCard";

interface RecurringViewProps {
  limitOrders: ReturnType<typeof useLimitOrders>;
  onConnectWallet?: () => void;
  onSwitchChain?: () => void;
  onSwitchSepolia?: () => void;
  initialStock?: string;
}

/** One-stock plans on the Auto-invest screen: pick the stock, then the same form as on Trade. */
export default function RecurringView({
  limitOrders,
  onConnectWallet,
  onSwitchChain,
  onSwitchSepolia,
  initialStock,
}: RecurringViewProps) {
  const { config, chainId } = limitOrders;

  const wanted = initialStock?.toLowerCase();
  const wantedListed = config.markets.some((m) => m.stockToken.toLowerCase() === wanted);
  const [selectedStock, setSelectedStock] = useState<string>(
    wanted || config.markets[0]?.stockToken.toLowerCase() || ""
  );
  useEffect(() => {
    if (wanted) setSelectedStock(wanted);
  }, [wanted]);

  // Keep selectedStock valid across chain switches (e.g. Sepolia vs Mainnet)
  useEffect(() => {
    const current = config.markets.find(
      (m) => m.stockToken.toLowerCase() === selectedStock.toLowerCase()
    );
    if (!current && config.markets.length > 0) {
      setSelectedStock(config.markets[0].stockToken.toLowerCase());
    }
  }, [config.markets, selectedStock]);

  const isMainnetWithoutOrderBook =
    chainId === 8453 &&
    (!config.orderBook || config.orderBook === "0x0000000000000000000000000000000000000000");
  const configError = getOrdersConfigError(config, chainId);

  return (
    <div className="space-y-4">
      {/* Configuration Error Notice when feature flag is ON but required deployment/market is missing */}
      {configError && !isMainnetWithoutOrderBook ? (
        <div
          data-testid="recurring-config-error"
          className="p-6 rounded-2xl bg-[var(--surface)] border border-rose-500/30 text-center space-y-4 shadow-card"
        >
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--ink)]">
              Configuration Notice
            </h3>
            <p className="text-xs text-[var(--ink-muted)] mt-1.5 max-w-sm mx-auto font-medium">
              {configError}
            </p>
          </div>
          <div className="flex justify-center gap-2 pt-1">
            {chainId !== 84532 && (
              <button
                type="button"
                onClick={onSwitchSepolia}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--brand)] text-white text-xs font-bold hover:bg-[var(--brand-hover)] transition cursor-pointer shadow-xs"
              >
                <span>Switch to Base Sepolia</span>
              </button>
            )}
            {chainId !== 8453 && (
              <button
                type="button"
                onClick={onSwitchChain}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--ink)] text-xs font-bold hover:bg-[var(--surface-3)] transition cursor-pointer border border-[var(--border-subtle)]"
              >
                <span>Switch to Base Mainnet</span>
              </button>
            )}
          </div>
        </div>
      ) : isMainnetWithoutOrderBook ? (
        <div
          data-testid="mainnet-recurring-placeholder"
          className="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] text-center space-y-4 shadow-card"
        >
          <div className="w-12 h-12 mx-auto rounded-full bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
            <Repeat size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--ink)]">
              Recurring buys aren&apos;t live on Base mainnet yet. Switch to Base Sepolia to test.
            </h3>
            <p className="text-xs text-[var(--ink-muted)] mt-1.5 max-w-sm mx-auto">
              Testnet contracts are deployed on Base Sepolia. You can try scheduled buys there with test tokens.
            </p>
          </div>
          <button
            type="button"
            onClick={onSwitchSepolia}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--brand)] text-white text-xs font-bold hover:bg-[var(--brand-hover)] transition cursor-pointer shadow-xs"
          >
            <span>Switch to Base Sepolia</span>
          </button>
        </div>
      ) : (
        <>
          {wanted && !wantedListed && (
            <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-[var(--ink-muted)]">
              Plans aren&apos;t available for the token in your link. Choose a stock below.
            </p>
          )}
          <label className="flex items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-2.5">
            <span className="text-xs font-semibold text-[var(--ink)]">Stock</span>
            <select
              aria-label="Stock"
              value={selectedStock}
              onChange={(e) => setSelectedStock(e.target.value)}
              className="min-h-[40px] w-full min-w-0 cursor-pointer rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 text-sm font-bold text-[var(--ink)]"
            >
              {config.markets.map((m) => (
                <option key={m.stockToken} value={m.stockToken.toLowerCase()}>
                  {m.symbol} &middot; {m.name}
                </option>
              ))}
            </select>
          </label>
          <RecurringCard limitOrders={limitOrders} stockAddress={selectedStock} onConnectWallet={onConnectWallet} />
        </>
      )}
    </div>
  );
}
