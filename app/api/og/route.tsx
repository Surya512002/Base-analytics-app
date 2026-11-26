import { ImageResponse } from "next/og";
import { homeShareImage } from "@/lib/og/home-share";
import { renderOgTokenCard } from "@/lib/og/render-token-card";
import { tokenCardData } from "@/lib/og/token-card-data";
import { OG_SIZE } from "@/lib/og/types";

export const runtime = "nodejs";

/** Short-lived: the image carries live prices and the time they were read. */
const CACHE = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

/**
 * GET /api/og?v=token&addr=0x… draws a token card from live data. Every other request, including
 * old links that carried their own numbers, gets the home image.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const address = params.get("v") === "token" ? params.get("addr") : null;
  const data = address && /^0x[0-9a-fA-F]{40}$/.test(address) ? await tokenCardData(address) : null;

  if (data) return new ImageResponse(renderOgTokenCard(data), { ...OG_SIZE, headers: { "Cache-Control": CACHE } });
  const home = await homeShareImage();
  home.headers.set("Cache-Control", CACHE);
  return home;
}
