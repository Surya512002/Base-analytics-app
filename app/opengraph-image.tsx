import { ImageResponse } from "next/og";
import { renderOgCard } from "@/lib/og/render-card";
import { OG_SIZE } from "@/lib/og/types";

export const runtime = "edge";
export const alt = "Base Analytics - Connected wallet dashboard on Base";
export const size = OG_SIZE;
export const contentType = "image/png";

/** Default link preview — looks like the live connected dashboard. */
export default async function Image() {
  return new ImageResponse(
    renderOgCard({
      score: 72,
      rank: "Base Shark",
      badges: 3,
      activeDays: 47,
      txs: 1248,
      xp: 120,
      streak: 5,
      healthScore: 72,
      variant: "default",
    }),
    { ...OG_SIZE }
  );
}
