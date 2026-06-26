import { keccak256, toBytes, parseUnits, formatUnits } from "viem";
import { APP_URL_WEB } from "@/lib/constants/env";

export const MAX_VOUCHER_CARDS = 50;
export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const USDC_DECIMALS = 6;

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type VoucherAsset = "ETH" | "USDC";

export interface VoucherCard {
  batchId: number;
  cardIndex: number;
  secret: string;
  cardId: string;
}

export interface StoredVoucherBatch {
  batchId: number;
  asset: VoucherAsset;
  totalAmount: string;
  amountPerCard: string;
  cardCount: number;
  message: string;
  creator: string;
  createdAt: number;
  txHash?: string;
  cards: VoucherCard[];
}

function randomChar(): string {
  return CHARSET[Math.floor(Math.random() * CHARSET.length)];
}

function randomGroup(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) s += randomChar();
  return s;
}

/** UniVoucher-style: XXXXX-XXXXX-XXXXX-XXXXX */
export function generateVoucherSecret(): string {
  return `${randomGroup(5)}-${randomGroup(5)}-${randomGroup(5)}-${randomGroup(5)}`;
}

export function hashVoucherSecret(secret: string): `0x${string}` {
  return keccak256(toBytes(secret.replace(/\s/g, "").toUpperCase()));
}

export function formatCardId(batchId: number, cardIndex: number): string {
  return `${batchId}-${cardIndex}`;
}

export function parseCardId(cardId: string): { batchId: number; cardIndex: number } | null {
  const m = cardId.trim().match(/^(\d+)-(\d+)$/);
  if (!m) return null;
  return { batchId: parseInt(m[1], 10), cardIndex: parseInt(m[2], 10) };
}

export function generateVoucherCards(batchId: number, count: number): VoucherCard[] {
  const cards: VoucherCard[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < count; i++) {
    let secret = generateVoucherSecret();
    while (seen.has(secret)) secret = generateVoucherSecret();
    seen.add(secret);
    cards.push({
      batchId,
      cardIndex: i,
      secret,
      cardId: formatCardId(batchId, i),
    });
  }
  return cards;
}

export function parseEthAmount(input: string): bigint | null {
  const n = parseFloat(input);
  if (!Number.isFinite(n) || n <= 0) return null;
  return parseUnits(n.toFixed(8).replace(/\.?0+$/, "") || "0", 18);
}

export function parseUsdcAmount(input: string): bigint | null {
  const n = parseFloat(input);
  if (!Number.isFinite(n) || n <= 0) return null;
  return parseUnits(n.toFixed(6), USDC_DECIMALS);
}

export function formatVoucherAmount(asset: VoucherAsset, wei: bigint): string {
  if (asset === "ETH") return `${formatUnits(wei, 18)} ETH`;
  return `$${formatUnits(wei, USDC_DECIMALS)} USDC`;
}

export function storageKey(address: string): string {
  return `base_voucher_batches_${address.toLowerCase()}`;
}

export function loadLocalBatches(address: string): StoredVoucherBatch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(address));
    return raw ? (JSON.parse(raw) as StoredVoucherBatch[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalBatch(address: string, batch: StoredVoucherBatch): void {
  const existing = loadLocalBatches(address);
  const idx = existing.findIndex((b) => b.batchId === batch.batchId);
  if (idx >= 0) existing[idx] = batch;
  else existing.unshift(batch);
  localStorage.setItem(storageKey(address), JSON.stringify(existing));
}

export function evenSplit(total: bigint, count: number): bigint | null {
  if (count < 1 || count > MAX_VOUCHER_CARDS) return null;
  if (total % BigInt(count) !== BigInt(0)) return null;
  return total / BigInt(count);
}

export interface SplitBreakdown {
  total: bigint;
  perCard: bigint;
  cardCount: number;
  asset: VoucherAsset;
  valid: boolean;
}

export function computeSplit(
  totalInput: string,
  cardCount: number,
  asset: VoucherAsset
): SplitBreakdown | null {
  const total =
    asset === "ETH" ? parseEthAmount(totalInput) : parseUsdcAmount(totalInput);
  if (!total || cardCount < 1 || cardCount > MAX_VOUCHER_CARDS) return null;
  const perCard = evenSplit(total, cardCount);
  return {
    total,
    perCard: perCard ?? BigInt(0),
    cardCount,
    asset,
    valid: perCard !== null,
  };
}

export function formatSplitSummary(split: SplitBreakdown): string {
  const totalLabel = formatVoucherAmount(split.asset, split.total);
  const perLabel = formatVoucherAmount(split.asset, split.perCard);
  return `${totalLabel} ÷ ${split.cardCount} cards = ${perLabel} each`;
}

export function tokenToAsset(token: string): VoucherAsset {
  return token === "0x0000000000000000000000000000000000000000" ? "ETH" : "USDC";
}

export function formatCardShareText(
  card: VoucherCard,
  batch: Pick<StoredVoucherBatch, "asset" | "amountPerCard" | "message">,
  appUrl = APP_URL_WEB
): string {
  const amount = formatVoucherAmount(batch.asset, BigInt(batch.amountPerCard));
  const lines = [
    "🎁 Base Voucher — Crypto Gift Card",
    "",
    `Card ID: ${card.cardId}`,
    `Secret: ${card.secret}`,
    `Amount: ${amount}`,
  ];
  if (batch.message) lines.push(`Message: "${batch.message}"`);
  lines.push("", `Redeem: ${appUrl}`);
  return lines.join("\n");
}

export function formatBatchShareText(
  batch: StoredVoucherBatch,
  appUrl = APP_URL_WEB
): string {
  const header = `🎁 Base Voucher Batch #${batch.batchId} (${batch.cardCount} cards)`;
  const body = batch.cards
    .map((c) => formatCardShareText(c, batch, appUrl))
    .join("\n\n---\n\n");
  return `${header}\n\n${body}`;
}
