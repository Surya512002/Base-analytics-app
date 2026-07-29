import { NextResponse } from "next/server";
import { getAddress, formatUnits } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

export const dynamic = "force-dynamic";

const BLOCKSCOUT_BASE = "https://base.blockscout.com/api/v2";

interface BlockscoutTokenBalance {
  value: string;
  token: {
    address: string;
    name: string;
    symbol: string;
    decimals: string | number;
    type: string;
    icon_url?: string | null;
    exchange_rate?: string | null;
  };
}

const STABLECOINS = new Set([
  "USDC", "USDT", "DAI", "USDBC", "USDbC", "EURC", "USDS", "USDE", "FRAX", "LUSD", "BUSD", "TUSD", "GUSD",
]);
const ETH_PEGGED = new Set(["WETH", "CBETH", "WSTETH", "RETH", "STETH"]);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("address")?.trim();
  if (!raw?.startsWith("0x") || raw.length !== 42) {
    return NextResponse.json({ holdings: [] });
  }

  let address: string;
  try {
    address = getAddress(raw);
  } catch {
    return NextResponse.json({ holdings: [] });
  }

  try {
    // Fetch all ERC-20 balances from Blockscout (free, no key needed)
    const [bsRes, ethBal] = await Promise.all([
      fetch(`${BLOCKSCOUT_BASE}/addresses/${address}/token-balances`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12_000),
      }).catch(() => null),
      createBasePublicClient()
        .getBalance({ address: address as `0x${string}` })
        .catch(() => BigInt(0)),
    ]);

    const holdings: {
      symbol: string;
      name: string;
      balance: number;
      usdValue: number;
      address: string | null;
      decimals: number;
      logo: string | null;
    }[] = [];

    // ETH balance
    const ethBalance = parseFloat(formatUnits(ethBal, 18));
    // We'll estimate ETH price from a stablecoin pair or fallback
    let ethUsd = 2500;

    // Parse Blockscout response
    let tokens: BlockscoutTokenBalance[] = [];
    if (bsRes?.ok) {
      const data = await bsRes.json();
      tokens = Array.isArray(data) ? data : [];
    }

    // Try to get ETH price from WETH exchange_rate if available
    const weth = tokens.find(
      (t) => t.token.symbol?.toUpperCase() === "WETH" && t.token.exchange_rate
    );
    if (weth?.token.exchange_rate) {
      const parsed = parseFloat(weth.token.exchange_rate);
      if (parsed > 100) ethUsd = parsed;
    }

    if (ethBalance > 0.0001) {
      holdings.push({
        symbol: "ETH",
        name: "Ether",
        balance: ethBalance,
        usdValue: ethBalance * ethUsd,
        address: null,
        decimals: 18,
        logo: null,
      });
    }

    for (const item of tokens) {
      if (!item.token || item.token.type !== "ERC-20") continue;
      const decimals = Number(item.token.decimals);
      if (!decimals || !item.value || item.value === "0") continue;

      const bal = parseFloat(formatUnits(BigInt(item.value), decimals));
      if (bal <= 0) continue;

      const sym = (item.token.symbol || "???").toUpperCase();
      let usdValue = 0;

      // Use exchange_rate from Blockscout if available (USD price per token)
      if (item.token.exchange_rate) {
        const rate = parseFloat(item.token.exchange_rate);
        if (rate > 0 && Number.isFinite(rate)) {
          usdValue = bal * rate;
        }
      } else if (STABLECOINS.has(sym)) {
        usdValue = bal;
      } else if (ETH_PEGGED.has(sym)) {
        usdValue = bal * ethUsd;
      }

      holdings.push({
        symbol: item.token.symbol || "???",
        name: item.token.name || item.token.symbol || "Unknown",
        balance: bal,
        usdValue,
        address: item.token.address,
        decimals,
        logo: item.token.icon_url || null,
      });
    }

    // Sort by USD value descending, unpriced tokens at the end sorted by balance
    holdings.sort((a, b) => {
      if (b.usdValue !== a.usdValue) return b.usdValue - a.usdValue;
      return b.balance - a.balance;
    });

    // Limit to top 30 to keep UI clean
    return NextResponse.json({ holdings: holdings.slice(0, 30) });
  } catch (e) {
    console.warn("[wallet-holdings]", e);
    return NextResponse.json({ holdings: [] });
  }
}
