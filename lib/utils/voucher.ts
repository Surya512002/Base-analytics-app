import { keccak256, toBytes, parseUnits, formatUnits } from "viem";
import { APP_URL_WEB } from "@/lib/constants/env";
import {
  BASE_STOCKS,
  getBaseStockBySymbol,
  getBaseStockByAddress,
  BASE_STOCK_DECIMALS,
} from "@/lib/stocks/base-stocks";

export const MAX_VOUCHER_CARDS = 50;
export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
export const USDC_DECIMALS = 6;

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type VoucherAsset = "ETH" | "USDC" | string;

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
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return CHARSET[buf[0]! % CHARSET.length]!;
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

export interface VaultShareInfo {
  symbol: string;
  name: string;
  underlyingSymbol: string;
  address: `0x${string}`;
  apy: number;
  protocol: string;
  icon: string;
  decimals: number;
}

export const YIELD_VAULT_SHARES: readonly VaultShareInfo[] = [
  {
    symbol: "bvMSFTc",
    name: "Beefy MSFTc-USDC Vault",
    underlyingSymbol: "MSFTc",
    address: "0x8061731243c1aeFCD50fDD4f69A7618Cdfb3EdD5",
    apy: 32.14,
    protocol: "Beefy Finance",
    icon: "🥩",
    decimals: 18,
  },
  {
    symbol: "bvTSLAc",
    name: "Beefy TSLAc-USDC Vault",
    underlyingSymbol: "TSLAc",
    address: "0xD534d5fe383AE824333C9215DE93D8026eFEDEba",
    apy: 54.13,
    protocol: "Beefy Finance",
    icon: "🥩",
    decimals: 18,
  },
  {
    symbol: "bvMSTRc",
    name: "Beefy MSTRc-USDC Vault",
    underlyingSymbol: "MSTRc",
    address: "0x005b8Aa7aB7bB665902d4E9509B9D4e9fB87BC2b",
    apy: 48.65,
    protocol: "Beefy Finance",
    icon: "🥩",
    decimals: 18,
  },
  {
    symbol: "bvSNDKc",
    name: "Beefy SNDKc-USDC Vault",
    underlyingSymbol: "SNDKc",
    address: "0xf336516CDFA8546B92A399305817F525ACcf87f9",
    apy: 38.20,
    protocol: "Beefy Finance",
    icon: "🥩",
    decimals: 18,
  },
];

export function isVaultShareAsset(asset: string): boolean {
  return YIELD_VAULT_SHARES.some((v) => v.symbol.toLowerCase() === asset.toLowerCase());
}

export function getVaultShareBySymbol(symbol: string): VaultShareInfo | null {
  return YIELD_VAULT_SHARES.find((v) => v.symbol.toLowerCase() === symbol.toLowerCase()) ?? null;
}

export function getVaultShareByAddress(address: string): VaultShareInfo | null {
  return YIELD_VAULT_SHARES.find((v) => v.address.toLowerCase() === address.toLowerCase()) ?? null;
}

export function isStockAsset(asset: string): boolean {
  return (
    asset !== "ETH" &&
    asset !== "USDC" &&
    (Boolean(getBaseStockBySymbol(asset)) || isVaultShareAsset(asset))
  );
}

export function parseStockAmount(input: string, decimals = BASE_STOCK_DECIMALS): bigint | null {
  const n = parseFloat(input);
  if (!Number.isFinite(n) || n <= 0) return null;
  return parseUnits(n.toFixed(decimals).replace(/\.?0+$/, "") || "0", decimals);
}

export function parseAssetAmount(input: string, asset: VoucherAsset): bigint | null {
  if (asset === "ETH") return parseEthAmount(input);
  if (asset === "USDC") return parseUsdcAmount(input);
  return parseStockAmount(input, BASE_STOCK_DECIMALS);
}

export function formatVoucherAmount(asset: VoucherAsset, wei: bigint): string {
  if (asset === "ETH") return `${formatUnits(wei, 18)} ETH`;
  if (asset === "USDC") return `$${formatUnits(wei, USDC_DECIMALS)} USDC`;
  if (isVaultShareAsset(asset)) {
    const vault = getVaultShareBySymbol(asset);
    const shares = formatUnits(wei, vault?.decimals ?? BASE_STOCK_DECIMALS);
    const cleanShares = parseFloat(shares).toString();
    return `${cleanShares} ${asset} Vault Shares (${vault?.name ?? asset} · +${vault?.apy.toFixed(2)}% APY)`;
  }
  const stock = getBaseStockBySymbol(asset);
  const shares = formatUnits(wei, BASE_STOCK_DECIMALS);
  const cleanShares = parseFloat(shares).toString();
  return `${cleanShares} ${asset} Share${cleanShares !== "1" ? "s" : ""}${stock ? ` (${stock.name})` : ""}`;
}

export function assetToToken(asset: VoucherAsset): `0x${string}` {
  if (asset === "ETH") return "0x0000000000000000000000000000000000000000";
  if (asset === "USDC") return USDC_BASE;
  if (isVaultShareAsset(asset)) {
    const vault = getVaultShareBySymbol(asset);
    if (vault) return vault.address;
  }
  const stock = getBaseStockBySymbol(asset);
  if (stock) return stock.address;
  return USDC_BASE;
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

const pendingLatestKey = (address: string) =>
  `base_voucher_pending_latest_${address.toLowerCase()}`;

const pendingTxKey = (txHash: string) =>
  `base_voucher_pending_tx_${txHash.toLowerCase()}`;

/** Persist in-flight batch (with secrets) until funding confirms — localStorage survives Base App reloads. */
export function savePendingBatch(address: string, batch: StoredVoucherBatch): void {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(batch);
  localStorage.setItem(pendingKey(address), json);
  localStorage.setItem(pendingLatestKey(address), json);
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

/** Find a pending batch (with secrets) for a wallet — never cross-wallet. */
export function loadAnyPendingBatch(
  address?: string,
  txHash?: string
): StoredVoucherBatch | null {
  if (typeof window === "undefined") return null;

  if (txHash) {
    const byTx = loadPendingBatchForTx(txHash);
    if (byTx?.cards?.some((c) => c.secret)) {
      if (!address || byTx.creator?.toLowerCase() === address.toLowerCase()) return byTx;
    }
  }

  if (!address) return null;

  const normalized = address.toLowerCase();
  const byWallet = loadPendingBatch(normalized);
  if (byWallet?.cards?.some((c) => c.secret)) return byWallet;

  try {
    const latest = localStorage.getItem(pendingLatestKey(normalized));
    if (latest) {
      const batch = JSON.parse(latest) as StoredVoucherBatch;
      if (
        batch.cards?.some((c) => c.secret) &&
        batch.creator?.toLowerCase() === normalized
      ) {
        return batch;
      }
    }
  } catch {
    /* ignore */
  }

  return null;
}

export function clearPendingBatch(address: string, txHash?: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(pendingKey(address));
  localStorage.removeItem(pendingLatestKey(address));
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
        cards: prev.cards.map((c) => {
          const fromNext = b.cards.find((x) => x.cardIndex === c.cardIndex);
          return {
            ...c,
            secret: c.secret?.trim() || fromNext?.secret?.trim() || "",
          };
        }),
      });
    }
  };

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
export function collectSecretsForBatch(
  batchId: number,
  creator?: string
): Map<number, string> {
  const secretByIndex = new Map<number, string>();
  if (typeof window === "undefined") return secretByIndex;

  const ingest = (raw: string | null) => {
    const b = parseStoredBatch(raw);
    if (!b || b.batchId !== batchId) return;
    if (
      creator &&
      b.creator &&
      b.creator.toLowerCase() !== creator.toLowerCase()
    ) {
      return;
    }
    for (const c of b.cards) {
      if (c.secret?.trim()) secretByIndex.set(c.cardIndex, c.secret.trim());
    }
  };

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
  const secretByIndex = collectSecretsForBatch(batch.batchId, batch.creator);

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

/** Load saved batches for a wallet (this device only — no cross-wallet merge). */
export function loadAllLocalBatchesForDevice(preferredAddress: string): StoredVoucherBatch[] {
  const normalized = preferredAddress.toLowerCase();
  return loadLocalBatches(normalized).map((b) => mergeSecretsIntoBatch(b));
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
  const total = parseAssetAmount(totalInput, asset);
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
  if (!token || token === "0x0000000000000000000000000000000000000000") return "ETH";
  if (token.toLowerCase() === USDC_BASE.toLowerCase()) return "USDC";
  const vault = getVaultShareByAddress(token);
  if (vault) return vault.symbol;
  const stock = getBaseStockByAddress(token);
  if (stock) return stock.symbol;
  return "USDC";
}

export function formatCardShareText(
  card: VoucherCard,
  batch: Pick<StoredVoucherBatch, "asset" | "amountPerCard" | "message">,
  appUrl = APP_URL_WEB
): string {
  const amount = formatVoucherAmount(batch.asset, BigInt(batch.amountPerCard));
  const isVault = isVaultShareAsset(batch.asset);
  const isStock = isStockAsset(batch.asset);
  const vault = isVault ? getVaultShareBySymbol(batch.asset) : null;
  const lines = [
    isVault
      ? `📈 Yield-Bearing Stock Vault Gift Card — ${vault?.protocol ?? "Vault"} (+${vault?.apy ?? 0}% APY)`
      : isStock
        ? `📈 Base Stock Gift Voucher — ${batch.asset} Shares`
        : "🎁 Base Voucher — Crypto Gift Card",
    "",
    `Card ID: ${card.cardId}`,
    `Secret: ${card.secret}`,
    `Amount: ${amount}`,
  ];
  if (batch.message) lines.push(`Message: "${batch.message}"`);
  const redeemUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/?tab=basehub&card=${encodeURIComponent(card.cardId)}`
      : `${appUrl}/?tab=basehub&card=${encodeURIComponent(card.cardId)}`;
  lines.push("", `Redeem: ${redeemUrl}`);
  return lines.join("\n");
}

export function formatBatchShareText(
  batch: StoredVoucherBatch,
  appUrl = APP_URL_WEB
): string {
  const isVault = isVaultShareAsset(batch.asset);
  const isStock = isStockAsset(batch.asset);
  const vault = isVault ? getVaultShareBySymbol(batch.asset) : null;
  const header = isVault
    ? `📈 Yield-Bearing Vault Batch #${batch.batchId} (${batch.cardCount} cards of ${batch.asset} · +${vault?.apy ?? 0}% APY)`
    : isStock
      ? `📈 Base Stock Gift Batch #${batch.batchId} (${batch.cardCount} cards of ${batch.asset})`
      : `🎁 Base Voucher Batch #${batch.batchId} (${batch.cardCount} cards)`;
  const body = batch.cards
    .map((c) => formatCardShareText(c, batch, appUrl))
    .join("\n\n---\n\n");
  return `${header}\n\n${body}`;
}
