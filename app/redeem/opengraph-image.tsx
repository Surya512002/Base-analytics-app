import { ImageResponse } from "next/og";
import { renderGiftShareCard } from "@/lib/og/share-cards";
import { ogFonts } from "@/lib/og/og-fonts";
import { OG_SIZE } from "@/lib/og/types";

export const runtime = "nodejs";
export const alt = "A gift is waiting for you on Base — see who sent it, then claim it.";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(renderGiftShareCard(null), { ...OG_SIZE, fonts: ogFonts() });
}
