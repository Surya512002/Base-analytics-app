import { homeShareImage } from "@/lib/og/home-share";
import { OG_SIZE } from "@/lib/og/types";

export const runtime = "nodejs";
export const alt = "Base Analytics — tokenized stocks on Base: explore, swap, borrow and gift.";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 300;

/** Default link preview (Open Graph). */
export default async function Image() {
  return homeShareImage();
}
