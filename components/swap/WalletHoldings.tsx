"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { parseAbi } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { COMMON_BASE_TOKENS, type CommonToken } from "@/lib/launchpad/common-tokens";
import { commonTokenToCounter } from "@/lib/launchpad/token-logo";
import { CounterAvatar, type SwapCounter } from "@/components/launchpad/TokenPickerDialog";
import { formatUsd } from "@/lib/launchpad/format";

const ERC20_BALANCE_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

export interface TokenHolding {
  token: CommonToken | null; // null = native ETH
  symbol: string;
  balance: number;
  usdValue: number;
  counter: SwapCounter;
}

const TOP_TOKENS = COMMON_BASE_TOKENS.slice(0, 12);

async function fetchHoldings(
  address: string,
  ethUsd: number
): Promise<TokenHolding[]> {
  const client = createBasePublicClient();
  const addr = address as `0x${string}`;

  const ethBalPromise = client.getBalance({ address: addr }).catch(() => BigInt(0));

  const tokenBalPromises = TOP_TOKENS.map((t) =>
    client
      .readContract({
        address: t.address,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [addr],
      })
      .catch(() => BigInt(0))
  );

  const [ethBal, ...tokenBals] = await Promise.all([
    ethBalPromise,
    ...tokenBalPromises,
  ]);

  const holdings: TokenHolding[] = [];

  const ethBalance = parseFloat(formatUnits(ethBal, 18));
  if (ethBalance > 0.0001) {
    holdings.push({
      token: null,
      symbol: "ETH",
      balance: ethBalance,
      usdValue: ethBalance * ethUsd,
      counter: { kind: "eth" },
    });
  }

  for (let i = 0; i < TOP_TOKENS.length; i++) {
    const t = TOP_TOKENS[i]!;
    const raw = tokenBals[i]!;
    if (raw === BigInt(0)) continue;
    const bal = parseFloat(formatUnits(raw, t.decimals));
    if (bal <= 0) continue;

    let usdValue = 0;
    const sym = t.symbol.toUpperCase();
    if (["USDC", "USDT", "DAI", "USDBC", "EURC", "USDS"].includes(sym)) {
      usdValue = bal;
    } else if (["WETH", "CBETH", "WSTETH"].includes(sym)) {
      usdValue = bal * ethUsd;
    } else if (sym === "CBBTC") {
      usdValue = bal * ethUsd * 25; // rough BTC/ETH ratio
    } else {
      // For other tokens without price feed, show balance but no USD
      usdValue = 0;
    }

    holdings.push({
      token: t,
      symbol: t.symbol,
      balance: bal,
      usdValue,
      counter: commonTokenToCounter(t),
    });
  }

  holdings.sort((a, b) => b.usdValue - a.usdValue);
  return holdings;
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
  ethUsd,
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
    fetchHoldings(walletAddress, ethUsd ?? 2500)
      .then((h) => {
        if (!cancelled) setHoldings(h);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [walletAddress, ethUsd]);

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
              key={h.symbol}
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
