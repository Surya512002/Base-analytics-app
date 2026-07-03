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

const pendingKey = (address: string) =>
  `base_voucher_pending_${address.toLowerCase()}`;

const pendingLatestKey = "base_voucher_pending_latest";

const pendingTxKey = (txHash: string) =>
  `base_voucher_pending_tx_${txHash.toLowerCase()}`;

/** Persist in-flight batch (with secrets) until funding confirms — localStorage survives Base App reloads. */
export function savePendingBatch(address: string, batch: StoredVoucherBatch): void {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(batch);
  localStorage.setItem(pendingKey(address), json);
  localStorage.setItem(pendingLatestKey, json);
  try {
    sessionStorage.setItem(pendingKey(address), json);
  } catch {
    /* sessionStorage may be unavailable in some webviews */
  }
}

/** Link pending secrets to a deposit tx as soon as the wallet returns a hash. */
export function savePendingBatchForTx(txHash: string, batch: StoredVoucherBatch): void {
  if (typeof window === "undefined" || !txHash) return;
  localStorage.setItem(pendingTxKey(txHash), JSON.stringify(batch));
}

export function loadPendingBatchForTx(txHash: string): StoredVoucherBatch | null {
  if (typeof window === "undefined" || !txHash) return null;
  try {
    const raw = localStorage.getItem(pendingTxKey(txHash));
    return raw ? (JSON.parse(raw) as StoredVoucherBatch) : null;
  } catch {
    return null;
  }
}

export function clearPendingBatchForTx(txHash: string): void {
  if (typeof window === "undefined" || !txHash) return;
  localStorage.removeItem(pendingTxKey(txHash));
}

export function loadPendingBatch(address: string): StoredVoucherBatch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      localStorage.getItem(pendingKey(address)) ??
      sessionStorage.getItem(pendingKey(address));
    return raw ? (JSON.parse(raw) as StoredVoucherBatch) : null;
  } catch {
    return null;
  }
}

/** Find a pending batch (with secrets) — wallet address, latest, or by tx hash. */
export function loadAnyPendingBatch(txHash?: string): StoredVoucherBatch | null {
  if (typeof window === "undefined") return null;

  if (txHash) {
    const byTx = loadPendingBatchForTx(txHash);
    if (byTx?.cards?.some((c) => c.secret)) return byTx;
  }

  try {
    const latest = localStorage.getItem(pendingLatestKey);
    if (latest) {
      const batch = JSON.parse(latest) as StoredVoucherBatch;
      if (batch.cards?.some((c) => c.secret)) return batch;
    }
  } catch {
    /* ignore */
  }

  const prefix = "base_voucher_pending_";
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix) || key === pendingLatestKey) continue;
      if (key.startsWith("base_voucher_pending_tx_")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const batch = JSON.parse(raw) as StoredVoucherBatch;
      if (batch.cards?.some((c) => c.secret)) return batch;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function clearPendingBatch(address: string, txHash?: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(pendingKey(address));
  localStorage.removeItem(pendingLatestKey);
  if (txHash) clearPendingBatchForTx(txHash);
  try {
    sessionStorage.removeItem(pendingKey(address));
  } catch {
    /* ignore */
  }
}

const lastTxKey = (address: string) =>
  `base_voucher_last_tx_${address.toLowerCase()}`;

export function saveLastVoucherTx(address: string, txHash: string): void {
  if (typeof window === "undefined" || !txHash) return;
  localStorage.setItem(lastTxKey(address), txHash);
}

export function loadLastVoucherTx(address: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(lastTxKey(address));
}

function parseStoredBatch(raw: string | null): StoredVoucherBatch | null {
  if (!raw) return null;
  try {
    const b = JSON.parse(raw) as StoredVoucherBatch;
    if (b?.batchId == null || !Array.isArray(b.cards)) return null;
    return b;
  } catch {
    return null;
  }
}

/** Every voucher batch blob in local/session storage — prefers entries that include secrets. */
export function scanAllVoucherBatches(): StoredVoucherBatch[] {
  if (typeof window === "undefined") return [];

  const byId = new Map<number, StoredVoucherBatch>();

  const collect = (raw: string | null) => {
    const b = parseStoredBatch(raw);
    if (!b) return;

    const prev = byId.get(b.batchId);
    if (!prev) {
      byId.set(b.batchId, b);
      return;
    }

    const prevHas = prev.cards.some((c) => c.secret?.trim());
    const nextHas = b.cards.some((c) => c.secret?.trim());
    if (!prevHas && nextHas) {
      byId.set(b.batchId, b);
      return;
    }
    if (prevHas && nextHas) {
      byId.set(b.batchId, {
        ...prev,
        cards: prev.cards.map((c, i) => ({
          ...c,
          secret: c.secret?.trim() || b.cards[i]?.secret?.trim() || "",
        })),
      });
    }
  };

  collect(localStorage.getItem(pendingLatestKey));

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("base_voucher_")) continue;
      collect(localStorage.getItem(key));
    }
  } catch {
    /* ignore */
  }

  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith("base_voucher_")) continue;
      collect(sessionStorage.getItem(key));
    }
  } catch {
    /* sessionStorage may be unavailable in Base App webviews */
  }

  return [...byId.values()];
}

/** Scan every storage slot for secrets matching a batch (no early dedupe skip). */
export function collectSecretsForBatch(batchId: number): Map<number, string> {
  const secretByIndex = new Map<number, string>();
  if (typeof window === "undefined") return secretByIndex;

  const ingest = (raw: string | null) => {
    const b = parseStoredBatch(raw);
    if (!b || b.batchId !== batchId) return;
    for (const c of b.cards) {
      if (c.secret?.trim()) secretByIndex.set(c.cardIndex, c.secret.trim());
    }
  };

  ingest(localStorage.getItem(pendingLatestKey));

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("base_voucher_")) continue;
      ingest(localStorage.getItem(key));
    }
  } catch {
    /* ignore */
  }

  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith("base_voucher_")) continue;
      ingest(sessionStorage.getItem(key));
    }
  } catch {
    /* ignore */
  }

  return secretByIndex;
}

/** Pull card secrets from any storage slot (pending, saved batches, tx-keyed pending). */
export function mergeSecretsIntoBatch(batch: StoredVoucherBatch): StoredVoucherBatch {
  const secretByIndex = collectSecretsForBatch(batch.batchId);

  for (const c of batch.cards) {
    if (c.secret?.trim()) secretByIndex.set(c.cardIndex, c.secret.trim());
  }

  if (secretByIndex.size === 0) return batch;

  return {
    ...batch,
    cards: Array.from({ length: batch.cardCount }, (_, i) => ({
      batchId: batch.batchId,
      cardIndex: i,
      cardId: formatCardId(batch.batchId, i),
      secret: secretByIndex.get(i) ?? batch.cards[i]?.secret ?? "",
    })),
  };
}

/** Load saved batches for an address plus any other wallet keys on this device. */
export function loadAllLocalBatchesForDevice(preferredAddress: string): StoredVoucherBatch[] {
  const byId = new Map<number, StoredVoucherBatch>();
  const normalized = preferredAddress.toLowerCase();

  const ingest = (b: StoredVoucherBatch) => {
    const prev = byId.get(b.batchId);
    if (!prev) {
      byId.set(b.batchId, b);
      return;
    }
    byId.set(b.batchId, mergeSecretsIntoBatch({ ...prev, ...b, cards: prev.cards.length ? prev.cards : b.cards }));
  };

  for (const b of loadLocalBatches(normalized)) ingest(b);

  if (typeof window === "undefined") return [...byId.values()];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("base_voucher_batches_")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        for (const b of JSON.parse(raw) as StoredVoucherBatch[]) ingest(b);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }

  return [...byId.values()];
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
