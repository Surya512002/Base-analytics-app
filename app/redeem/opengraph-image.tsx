import { ImageResponse } from "next/og";
import { renderRedeemThumbnail } from "@/lib/marketing/render-redeem-thumbnail";
import { OG_SIZE } from "@/lib/og/types";

export const runtime = "edge";
export const alt = "Redeem your Base Voucher gift card on Base";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(renderRedeemThumbnail(), { ...OG_SIZE });
}
