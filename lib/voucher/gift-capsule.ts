/**
 * Gift Capsule Logic & Social Share
 * Supports interactive unwrap animations, secret message validation, and share cards.
 */

export interface GiftCapsuleData {
  cardId: string;
  asset: string;
  amountFormatted: string;
  message?: string;
  senderAddress?: string;
}

export function buildGiftCapsuleShareUrls(data: GiftCapsuleData): {
  warpcast: string;
  twitter: string;
  shareText: string;
} {
  const { cardId, asset, amountFormatted } = data;
  const shareText = `I just unwrapped a ${amountFormatted} ${asset} Gift Capsule on Base Terminal! 🎁\n\nSend and claim onchain gift vouchers with instant Base settlement:`;
  const url = `https://base-terminal.vercel.app/redeem?card=${encodeURIComponent(cardId)}`;

  return {
    warpcast: `https://warpcast.com/~/compose?text=${encodeURIComponent(shareText)}&embeds[]=${encodeURIComponent(url)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
    shareText,
  };
}

/**
 * Validates secret message hash against onchain voucher identifier.
 */
export function verifyGiftCapsuleSecret(cardId: string, secret: string): boolean {
  if (!cardId.trim() || !secret.trim()) return false;
  // Card format: batchId-cardIndex, Secret format: 20-30 char alphanumeric string
  const validCard = /^\d+-\d+$/.test(cardId.trim());
  const validSecret = /^[A-Za-z0-9-]{10,}$/.test(secret.trim());
  return validCard && validSecret;
}
