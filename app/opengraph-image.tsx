import { ImageResponse } from "next/og";
import { fetchOgTrendingB20 } from "@/lib/marketing/og-trending";
import { renderAppThumbnail } from "@/lib/marketing/render-thumbnail";
import { OG_SIZE } from "@/lib/og/types";

export const runtime = "nodejs";
export const alt =
  "Base Analytics — B20 launchpad on Base. Explore tokens, swap in-app via Uniswap & Aerodrome, earn XP.";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 120;

/** Default link preview — live B20 trending + in-app trading on Base. */
export default async function Image() {
  const trending = await fetchOgTrendingB20(3);
  return new ImageResponse(renderAppThumbnail(trending), { ...OG_SIZE });
}
