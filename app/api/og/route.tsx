import { ImageResponse } from "next/og";
import { renderOgCard } from "@/lib/og/render-card";
import { OG_SIZE, parseOgParams } from "@/lib/og/types";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const data = parseOgParams(searchParams);

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
    }),
    { ...OG_SIZE }
  );
}
