import { NextResponse } from "next/server";
import { getAddress, formatUnits, parseAbi } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { COMMON_BASE_TOKENS } from "@/lib/launchpad/common-tokens";

export const dynamic = "force-dynamic";

const ERC20_BALANCE_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

const STABLECOINS = new Set([
  "USDC", "USDT", "DAI", "USDBC", "USDbC", "EURC", "USDS", "USDE", "FRAX", "LUSD",
]);
const ETH_PEGGED = new Set(["WETH", "CBETH", "WSTETH", "RETH"]);

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
    const client = createBasePublicClient();
    const addr = address as `0x${string}`;

    // Batch all balance calls via multicall (single RPC round-trip)
    const contracts = COMMON_BASE_TOKENS.map((t) => ({
      address: t.address,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf" as const,
      args: [addr] as const,
    }));

    const [ethBal, tokenResults] = await Promise.all([
      client.getBalance({ address: addr }).catch(() => BigInt(0)),
      client.multicall({ contracts }).catch(() => contracts.map(() => ({ status: "failure" as const, result: undefined }))),
    ]);

    // Fetch ETH price from CoinGecko (free, no key)
    let ethUsd = 2500;
    try {
      const priceRes = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
        { signal: AbortSignal.timeout(5_000) }
      );
      if (priceRes.ok) {
        const priceData = (await priceRes.json()) as { ethereum?: { usd?: number } };
        if (priceData.ethereum?.usd) ethUsd = priceData.ethereum.usd;
      }
    } catch { /* fallback to 2500 */ }

    const holdings: {
      symbol: string;
      name: string;
      balance: number;
      usdValue: number;
      address: string | null;
      decimals: number;
      logo: string | null;
    }[] = [];

    const ethBalance = parseFloat(formatUnits(ethBal, 18));
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

    for (let i = 0; i < COMMON_BASE_TOKENS.length; i++) {
      const t = COMMON_BASE_TOKENS[i]!;
      const result = tokenResults[i];
      if (!result || result.status === "failure") continue;
      const raw = result.result as bigint;
      if (!raw || raw === BigInt(0)) continue;

      const bal = parseFloat(formatUnits(raw, t.decimals));
      if (bal <= 0) continue;

      const sym = t.symbol.toUpperCase();
      let usdValue = 0;
      if (STABLECOINS.has(sym)) {
        usdValue = bal;
      } else if (ETH_PEGGED.has(sym)) {
        usdValue = bal * ethUsd;
      } else if (sym === "CBBTC") {
        usdValue = bal * ethUsd * 25;
      }

      holdings.push({
        symbol: t.symbol,
        name: t.name,
        balance: bal,
        usdValue,
        address: t.address,
        decimals: t.decimals,
        logo: null,
      });
    }

    // Also try Blockscout for additional tokens (non-blocking, 6s timeout)
    try {
      const bsRes = await fetch(
        `https://base.blockscout.com/api/v2/addresses/${address}/token-balances`,
        { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6_000) }
      );
      if (bsRes.ok) {
        const data = (await bsRes.json()) as Array<{
          value: string;
          token: { address: string; name: string; symbol: string; decimals: string | number; type: string; icon_url?: string | null; exchange_rate?: string | null };
        }>;
        const knownAddrs = new Set(holdings.map((h) => h.address?.toLowerCase()));
        for (const item of data) {
          if (!item.token || item.token.type !== "ERC-20") continue;
          if (knownAddrs.has(item.token.address.toLowerCase())) continue;
          const decimals = Number(item.token.decimals);
          if (!decimals || !item.value || item.value === "0") continue;
          const bal = parseFloat(formatUnits(BigInt(item.value), decimals));
          if (bal <= 0) continue;

          let usdValue = 0;
          if (item.token.exchange_rate) {
            const rate = parseFloat(item.token.exchange_rate);
            if (rate > 0 && Number.isFinite(rate)) usdValue = bal * rate;
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
      }
    } catch { /* Blockscout optional — ignore failures */ }

    holdings.sort((a, b) => {
      if (b.usdValue !== a.usdValue) return b.usdValue - a.usdValue;
      return b.balance - a.balance;
    });

    return NextResponse.json({ holdings: holdings.slice(0, 30) });
  } catch (e) {
    console.warn("[wallet-holdings]", e);
    return NextResponse.json({ holdings: [] });
  }
}
