import { NextResponse } from "next/server";
import { getAddress, formatUnits } from "viem";
import { getAlchemyKey, alchemyRpcForKey } from "@/lib/constants/env";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

export const dynamic = "force-dynamic";

interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string;
}

interface TokenMeta {
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

const STABLECOINS = new Set([
  "USDC", "USDT", "DAI", "USDBC", "USDbC", "EURC", "USDS", "USDE", "BUSD", "FRAX",
]);
const ETH_PEGGED = new Set(["WETH", "CBETH", "WSTETH", "RETH", "STETH"]);

async function alchemyFetch(method: string, params: unknown[], key: string) {
  const rpc = alchemyRpcForKey(key);
  const res = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: unknown; error?: unknown };
  return json.result;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("address")?.trim();
  if (!raw?.startsWith("0x") || raw.length !== 42) {
    return NextResponse.json({ holdings: [] });
  }

  const key = getAlchemyKey();
  if (!key) {
    return NextResponse.json({ holdings: [] });
  }

  let address: string;
  try {
    address = getAddress(raw);
  } catch {
    return NextResponse.json({ holdings: [] });
  }

  try {
    // Fetch all ERC-20 balances
    const balResult = (await alchemyFetch(
      "alchemy_getTokenBalances",
      [address, "erc20"],
      key
    )) as { tokenBalances?: AlchemyTokenBalance[] } | null;

    const tokenBalances = balResult?.tokenBalances ?? [];

    // Filter non-zero balances
    const nonZero = tokenBalances.filter(
      (t) => t.tokenBalance && t.tokenBalance !== "0x0" && BigInt(t.tokenBalance) > BigInt(0)
    );

    if (nonZero.length === 0) {
      // Still get ETH balance
      const client = createBasePublicClient();
      const ethBal = await client.getBalance({ address: address as `0x${string}` }).catch(() => BigInt(0));
      const eth = parseFloat(formatUnits(ethBal, 18));
      if (eth > 0.0001) {
        return NextResponse.json({
          holdings: [{ symbol: "ETH", name: "Ether", balance: eth, usdValue: 0, address: null, decimals: 18, logo: null }],
        });
      }
      return NextResponse.json({ holdings: [] });
    }

    // Get metadata for top tokens (limit to 25 to avoid rate limits)
    const top = nonZero.slice(0, 25);
    const metaResults = await Promise.all(
      top.map((t) =>
        alchemyFetch("alchemy_getTokenMetadata", [t.contractAddress], key)
          .then((r) => r as TokenMeta | null)
          .catch(() => null)
      )
    );

    // Get ETH balance and price
    const client = createBasePublicClient();
    const ethBal = await client.getBalance({ address: address as `0x${string}` }).catch(() => BigInt(0));
    const ethBalance = parseFloat(formatUnits(ethBal, 18));

    // Rough ETH price from a WETH/USDC pool or use 2500 as fallback
    const ethUsd = 2500; // We'll get a better price below if possible

    const holdings: {
      symbol: string;
      name: string;
      balance: number;
      usdValue: number;
      address: string | null;
      decimals: number;
      logo: string | null;
    }[] = [];

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

    for (let i = 0; i < top.length; i++) {
      const meta = metaResults[i];
      if (!meta || !meta.decimals || !meta.symbol) continue;

      const rawBal = top[i]!.tokenBalance;
      const bal = parseFloat(formatUnits(BigInt(rawBal), meta.decimals));
      if (bal <= 0) continue;

      let usdValue = 0;
      const sym = meta.symbol.toUpperCase();
      if (STABLECOINS.has(sym)) {
        usdValue = bal;
      } else if (ETH_PEGGED.has(sym)) {
        usdValue = bal * ethUsd;
      } else {
        // Unknown price — mark 0, client will still show balance
        usdValue = 0;
      }

      holdings.push({
        symbol: meta.symbol,
        name: meta.name || meta.symbol,
        balance: bal,
        usdValue,
        address: top[i]!.contractAddress,
        decimals: meta.decimals,
        logo: meta.logo || null,
      });
    }

    // Sort by USD value descending, then by balance for unpriced
    holdings.sort((a, b) => {
      if (b.usdValue !== a.usdValue) return b.usdValue - a.usdValue;
      return b.balance - a.balance;
    });

    return NextResponse.json({ holdings });
  } catch (e) {
    console.warn("[wallet-holdings]", e);
    return NextResponse.json({ holdings: [] });
  }
}
