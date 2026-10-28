import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { getWalletPortfolio } from "@/lib/portfolio/portfolio-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("address")?.trim();
  if (!raw?.startsWith("0x") || raw.length !== 42) {
    return NextResponse.json({ holdings: [] });
  }

  let address: `0x${string}`;
  try {
    address = getAddress(raw);
  } catch {
    return NextResponse.json({ holdings: [] });
  }

  const customParam = searchParams.get("customTokens")?.trim();
  const customTokens = customParam ? customParam.split(",").map((s) => s.trim()) : [];

  try {
    const portfolio = await getWalletPortfolio(address, customTokens, true);

    // Map to legacy format expected by existing components while including full metadata
    const holdings = portfolio.tokens.map((t) => ({
      symbol: t.symbol,
      name: t.name,
      balance: t.balanceNumber,
      balanceFormatted: t.balanceFormatted,
      balanceRaw: t.balanceRaw,
      usdValue: t.usdValue ?? 0,
      priceUsd: t.priceUsd,
      priceSource: t.priceSource,
      priceChange24h: t.priceChange24h,
      address: t.address,
      decimals: t.decimals,
      logo: t.logo,
      isSpam: t.isSpam,
      spamReason: t.spamReason,
      isVerified: t.isVerified,
      isStock: t.isStock,
      isB20: t.isB20,
      isCustom: t.isCustom,
      hasTradeRoute: t.hasTradeRoute,
      counter: t.counter,
    }));

    return NextResponse.json({
      holdings,
      totalUsd: portfolio.totalUsd,
      pricedCount: portfolio.pricedCount,
      unpricedCount: portfolio.unpricedCount,
      spamCount: portfolio.spamCount,
      dustCount: portfolio.dustCount,
      defi: portfolio.defi,
      updatedAt: portfolio.updatedAt,
      partial: portfolio.partial,
      warning: portfolio.warning,
    });
  } catch (e) {
    console.error("[wallet-holdings-api] Fallback error:", e);
    return NextResponse.json({ holdings: [], totalUsd: 0 });
  }
}
