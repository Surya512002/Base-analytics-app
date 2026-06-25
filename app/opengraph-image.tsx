import { ImageResponse } from "next/og";
import { renderOgCard } from "@/lib/og/render-card";
import { OG_SIZE } from "@/lib/og/types";

export const runtime = "edge";
export const alt = "Base Analytics — Mint Your Onchain Identity on Base";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(renderOgCard({ score: 88, rank: "Base God 👑", badges: 4 }), {
    ...OG_SIZE,
  });
}
