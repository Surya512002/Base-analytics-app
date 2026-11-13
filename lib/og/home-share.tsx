import { ImageResponse } from "next/og";
import { fetchStockMarkets } from "@/lib/markets/markets-service";
import { renderHomeShareCard, type ShareStockRow } from "./share-cards";
import { ogFonts } from "@/lib/og/og-fonts";
import { OG_SIZE } from "./types";

/** Home/default link preview with the four most liquid stocks — or feature text if data is unavailable. */
export async function homeShareImage(): Promise<ImageResponse> {
  let stocks: ShareStockRow[] = [];
  let asOf: Date | null = null;
  try {
    const all = await Promise.race([
      fetchStockMarkets(false),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
    ]);
    stocks = all
      .filter((s) => s.status === "active" && Number.isFinite(s.price) && s.price > 0 && Number.isFinite(s.change24h))
      .sort((a, b) => b.tradingLiquidity - a.tradingLiquidity)
      .slice(0, 4)
      .map((s) => ({ symbol: s.symbol, price: s.price, change24h: s.change24h }));
    const stamps = all.map((s) => Date.parse(s.lastUpdated)).filter(Number.isFinite);
    asOf = stamps.length ? new Date(Math.max(...stamps)) : null;
  } catch {
    stocks = [];
  }
  return new ImageResponse(renderHomeShareCard({ stocks, asOf }), { ...OG_SIZE, fonts: ogFonts() });
}
