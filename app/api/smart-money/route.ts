import { NextResponse } from "next/server";
import { PRESET_SMART_MONEY, type SmartMoneyBuyEvent } from "@/lib/smart-money/smart-money-store";
import { formatUnits } from "viem";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface BlockscoutTokenTxItem {
  hash: string;
  from: string;
  to: string;
  value: string;
  contractAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  timeStamp: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetWallet =
    searchParams.get("wallet")?.trim().toLowerCase() ||
    PRESET_SMART_MONEY[0].address.toLowerCase();

  const matchedPreset = PRESET_SMART_MONEY.find(
    (w) => w.address.toLowerCase() === targetWallet
  );
  const walletLabel = matchedPreset?.label || `Wallet ${targetWallet.slice(0, 6)}…`;

  const now = Date.now();
  const recentBuys: SmartMoneyBuyEvent[] = [];

  try {
    const url = `https://base.blockscout.com/api?module=account&action=tokentx&address=${targetWallet}&page=1&offset=8&sort=desc`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/json" },
    });

    if (res.ok) {
      const data = (await res.json()) as {
        status?: string;
        message?: string;
        result?: BlockscoutTokenTxItem[];
      };

      if (Array.isArray(data?.result)) {
        for (const tx of data.result) {
          // Identify inbound token acquisitions (buys / received)
          if (tx.to && tx.to.toLowerCase() === targetWallet) {
            const decimals = parseInt(tx.tokenDecimal || "18", 10);
            let formattedAmount = "0";
            try {
              const parsed = formatUnits(BigInt(tx.value || "0"), isNaN(decimals) ? 18 : decimals);
              const num = parseFloat(parsed);
              formattedAmount = num > 1000 ? num.toLocaleString(undefined, { maximumFractionDigits: 2 }) : num.toFixed(4);
            } catch {
              formattedAmount = tx.value;
            }

            recentBuys.push({
              txHash: tx.hash,
              walletAddress: targetWallet,
              walletLabel,
              tokenAddress: tx.contractAddress,
              tokenSymbol: tx.tokenSymbol || "TOKEN",
              amount: formattedAmount,
              usdValue: null,
              timestamp: Number(tx.timeStamp || "0") * 1000,
            });
          }
        }
      }
    }
  } catch {
    // Upstream indexer rate limit or timeout — degrade gracefully without crashing
  }

  return NextResponse.json({
    wallets: PRESET_SMART_MONEY,
    recentBuys,
    timestamp: now,
  });
}
