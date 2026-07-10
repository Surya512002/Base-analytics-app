"use client";

import { useEffect, useState } from "react";
import { formatUnits, parseAbi } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

const ERC20_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);

export function useTokenHoldings(
  walletAddress: string | undefined,
  tokens: { address: string; decimals: number }[]
): Record<string, number> {
  const [holdings, setHoldings] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!walletAddress || !tokens.length) {
      setHoldings({});
      return;
    }
    let alive = true;
    const pub = createBasePublicClient();
    const addrs = tokens.slice(0, 40);
    void Promise.all(
      addrs.map(async (t) => {
        try {
          const raw = await pub.readContract({
            address: t.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [walletAddress as `0x${string}`],
          });
          const n = parseFloat(formatUnits(raw, t.decimals));
          return [t.address.toLowerCase(), n] as const;
        } catch {
          return [t.address.toLowerCase(), 0] as const;
        }
      })
    ).then((rows) => {
      if (!alive) return;
      const map: Record<string, number> = {};
      for (const [a, n] of rows) {
        if (n > 0) map[a] = n;
      }
      setHoldings(map);
    });
    return () => {
      alive = false;
    };
  }, [walletAddress, tokens]);

  return holdings;
}
