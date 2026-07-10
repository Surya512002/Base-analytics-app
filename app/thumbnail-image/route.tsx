import { ImageResponse } from "next/og";
import { fetchOgTrendingB20 } from "@/lib/marketing/og-trending";
import { renderAppThumbnail } from "@/lib/marketing/render-thumbnail";
import { THUMBNAIL_SIZE } from "@/lib/marketing/thumbnail";

export const runtime = "nodejs";
export const revalidate = 120;

/** Marketing thumbnail at 1.91:1 (1200×628). GET /thumbnail-image */
export async function GET() {
  const trending = await fetchOgTrendingB20(3);
  return new ImageResponse(renderAppThumbnail(trending), { ...THUMBNAIL_SIZE });
}
