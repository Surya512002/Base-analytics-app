import { ImageResponse } from "next/og";
import { renderSectionCard } from "@/lib/og/share-cards";
import { ogFonts } from "@/lib/og/og-fonts";

export const runtime = "nodejs";

/** Marketing thumbnail at 1.91:1 (1200×628). GET /thumbnail-image */
export async function GET() {
  return new ImageResponse(renderSectionCard("home"), { width: 1200, height: 628, fonts: ogFonts() });
}
