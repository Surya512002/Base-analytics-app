import { APP_URL_WEB } from "@/lib/constants/env";
import type { StoredVoucherBatch } from "@/lib/utils/voucher";
import { formatBatchShareText } from "@/lib/utils/voucher";
import { warpcast } from "@/lib/utils/share";

export function buildVoucherShareMessage(batch: StoredVoucherBatch): string {
  const first = batch.cards[0];
  if (!first) return `🎁 Base Voucher gift cards on Base!\n\nCreate & redeem ETH/USDC onchain.\n\n${APP_URL_WEB}`;
  return `🎁 You got a Base Voucher on Base!\n\nCard ID: ${first.cardId}\nRedeem at ${APP_URL_WEB}/redeem\n\n— Sent via Base Analytics`;
}

export function buildBatchFarcasterUrl(batch: StoredVoucherBatch): string {
  const text = `🎁 I just created ${batch.cardCount} crypto gift cards on Base!\n\nETH/USDC vouchers anyone can redeem — plus B20 explore & in-app swaps on Base Analytics.`;
  return warpcast(text, `${APP_URL_WEB}/?tab=voucher`);
}

export function buildRedeemPageUrl(cardId?: string): string {
  if (!cardId?.trim()) return `${APP_URL_WEB}/redeem`;
  return `${APP_URL_WEB}/redeem?card=${encodeURIComponent(cardId.trim())}`;
}

export function buildPayLinkUrl(address: string): string {
  return `${APP_URL_WEB}/pay/${address.toLowerCase()}`;
}

export function buildVoucherCastText(batch: StoredVoucherBatch): string {
  return `🎁 ${batch.cardCount} Base Voucher cards funded on Base (${batch.asset})!\n\nCrypto gift cards + B20 launchpad & in-app DEX swaps — all on Base Analytics.\n\n${APP_URL_WEB}/?tab=voucher`;
}

export function buildRedeemFarcasterUrl(cardId?: string): string {
  const url = buildRedeemPageUrl(cardId);
  const text = cardId
    ? `🎁 I got a Base Voucher gift card!\n\nRedeem Card ID ${cardId} on Base — ETH or USDC.`
    : `🎁 Redeem your Base Voucher gift card on Base!\n\nCrypto gift cards — fully onchain.`;
  return warpcast(text, url);
}

export function copyBatchShareText(batch: StoredVoucherBatch): string {
  return formatBatchShareText(batch);
}
