import { ImageResponse } from "next/og";
import { renderGiftShareCard, type GiftShareData } from "@/lib/og/share-cards";
import { ogFonts } from "@/lib/og/og-fonts";
import { OG_SIZE } from "@/lib/og/types";
import { readCampaignPublicView } from "@/lib/voucher/campaign-server";

export const runtime = "nodejs";
export const alt = "A gift on Base — see who sent it, then claim it.";
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 60;

/** Per-gift preview: real amount, sender name + address, slots left. Never includes the claim secret. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let data: GiftShareData | null = null;
  if (/^\d{1,12}$/.test(id)) {
    try {
      const v = await Promise.race([
        readCampaignPublicView(BigInt(id)),
        new Promise<null>((res) => setTimeout(() => res(null), 5000)),
      ]);
      if (v) {
        data = {
          amount: v.perClaimFormatted,
          senderName: v.sender.trust === "basename-verified" ? v.sender.basename : null,
          senderVerified: v.sender.trust === "basename-verified",
          senderAddress: v.sender.address,
          claimsRemaining: v.claimsRemaining,
          maxClaims: v.maxClaims,
          status: v.status,
          expiresAt: v.expiresAt,
          unlockAt: v.unlockAt,
          message: v.message,
        };
      }
    } catch {
      data = null;
    }
  }
  return new ImageResponse(renderGiftShareCard(data), { ...OG_SIZE, fonts: ogFonts() });
}
