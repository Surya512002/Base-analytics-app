import { ImageResponse } from "next/og";
import { renderOgCard } from "@/lib/og/render-card";
import { renderOgTokenCard } from "@/lib/og/render-token-card";
import { OG_SIZE, parseOgParams } from "@/lib/og/types";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = parseOgParams(searchParams);
  const variant = searchParams.get("v") ?? data.variant;

  if (variant === "token") {
    return new ImageResponse(
      renderOgTokenCard({
        variant: "token",
        tokenSymbol: searchParams.get("sym") ?? undefined,
        tokenName: searchParams.get("tname") ?? undefined,
        tokenPrice: searchParams.get("tprice") ?? undefined,
        tokenChange24h: parseFloat(searchParams.get("tchg") ?? "0") || 0,
        tokenMcap: searchParams.get("tmcap") ?? undefined,
      }),
      { ...OG_SIZE }
    );
  }

  return new ImageResponse(
    renderOgCard({
      score: data.score,
      rank: data.rank,
      badges: data.badges,
      days: data.days,
      xp: data.xp,
      streak: data.streak,
      title: data.title || undefined,
      subtitle: data.subtitle || undefined,
      variant: data.variant,
      address: data.address,
      activeDays: data.activeDays,
      txs: data.txs,
      healthScore: data.healthScore,
      boosts: data.boosts,
    }),
    { ...OG_SIZE }
  );
}
