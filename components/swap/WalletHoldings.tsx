"use client";

import { useEffect, useState } from "react";
import { CounterAvatar, type SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import { formatUsd } from "@/lib/launchpad/format";

export interface TokenHolding {
  symbol: string;
  name: string;
  balance: number;
  usdValue: number;
  address: string | null;
  decimals: number;
  logo: string | null;
  counter: SwapCounter;
}

function holdingToCounter(h: {
  symbol: string;
  address: string | null;
  decimals: number;
  logo: string | null;
}): SwapCounter {
  if (!h.address || h.symbol === "ETH") return { kind: "eth" };
  return {
    kind: "token",
    address: h.address as `0x${string}`,
    symbol: h.symbol,
    decimals: h.decimals,
    imageUrl: h.logo ?? undefined,
  };
}

function formatBalance(bal: number): string {
  if (bal >= 1_000_000) return `${(bal / 1_000_000).toFixed(1)}M`;
  if (bal >= 1_000) return `${(bal / 1_000).toFixed(1)}K`;
  if (bal >= 1) return bal.toFixed(2);
  if (bal >= 0.001) return bal.toFixed(4);
  return bal.toFixed(6);
}

export default function WalletHoldings({
  walletAddress,
  onSelectToken,
}: {
  walletAddress: string | null;
  ethUsd?: number;
  onSelectToken?: (counter: SwapCounter) => void;
}) {
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!walletAddress) {
      setHoldings([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/wallet-holdings?address=${encodeURIComponent(walletAddress)}`)
      .then((r) => r.json())
      .then((data: { holdings?: Array<{
        symbol: string; name: string; balance: number;
        usdValue: number; address: string | null; decimals: number; logo: string | null;
      }> }) => {
        if (cancelled) return;
        const items: TokenHolding[] = (data.holdings ?? []).map((h) => ({
          ...h,
          counter: holdingToCounter(h),
        }));
        setHoldings(items);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [walletAddress]);

  if (!walletAddress || (holdings.length === 0 && !loading)) return null;

  const totalUsd = holdings.reduce((s, h) => s + h.usdValue, 0);

  return (
    <div className="wallet-holdings-strip">
      <div className="wallet-holdings-header">
        <span className="wallet-holdings-title">Your Holdings</span>
        {totalUsd > 0 && (
          <span className="wallet-holdings-total">{formatUsd(totalUsd)}</span>
        )}
      </div>
      {loading ? (
        <div className="wallet-holdings-loading">Loading balances…</div>
      ) : (
        <div className="wallet-holdings-list">
          {holdings.map((h) => (
            <button
              key={h.symbol + (h.address ?? "eth")}
              type="button"
              className="wallet-holding-chip"
              onClick={() => onSelectToken?.(h.counter)}
              title={`Swap from ${h.symbol}`}
            >
              <CounterAvatar counter={h.counter} size={20} />
              <span className="wallet-holding-info">
                <span className="wallet-holding-symbol">{h.symbol}</span>
                <span className="wallet-holding-bal">
                  {formatBalance(h.balance)}
                </span>
              </span>
              {h.usdValue > 0.01 && (
                <span className="wallet-holding-usd">{formatUsd(h.usdValue)}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
