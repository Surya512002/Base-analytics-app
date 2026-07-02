import { ImageResponse } from "next/og";
import { renderAppThumbnail } from "@/lib/marketing/render-thumbnail";
import { OG_SIZE } from "@/lib/og/types";

export const runtime = "edge";
export const alt =
  "Base Analytics — Crypto prediction market on Base. Trade BTC, ETH & SOL YES/NO odds.";
export const size = OG_SIZE;
export const contentType = "image/png";

/** Default link preview — matches the predictions-first homepage. */
export default async function Image() {
  return new ImageResponse(renderAppThumbnail(), { ...OG_SIZE });
}
