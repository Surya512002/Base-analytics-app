import { ImageResponse } from "next/og";
import { renderAppThumbnail } from "@/lib/marketing/render-thumbnail";
import { THUMBNAIL_SIZE } from "@/lib/marketing/thumbnail";

export const runtime = "edge";

/** Marketing thumbnail at 1.91:1 (1200×628). GET /thumbnail-image */
export async function GET() {
  return new ImageResponse(renderAppThumbnail(), { ...THUMBNAIL_SIZE });
}
