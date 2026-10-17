import type { VoucherAsset } from "@/lib/utils/voucher";

export type VoucherView = "create" | "redeem" | "mine" | "view";

export type CardTheme = "base-blue" | "midnight" | "stock" | "mint";

export type VoucherAssetCategory = "usdc" | "eth" | "stock" | "vault";

export interface VoucherAssetConfig {
  symbol: string;
  name: string;
  category: VoucherAssetCategory;
  address?: `0x${string}`;
  decimals: number;
  icon?: string;
  apy?: number;
  protocol?: string;
  priceUsd?: number;
}

export interface OccasionTemplate {
  id: string;
  label: string;
  emoji: string;
  message: string;
  theme: CardTheme;
}

export interface ViewedCard {
  cardId: string;
  batchId: number;
  cardIndex: number;
  asset: VoucherAsset;
  amountPerCard: bigint;
  message: string;
  creator: string;
  cardCount: number;
  redeemedCount: number;
  redeemed: boolean;
  secretValid: boolean | null;
}

export interface RedeemPreview {
  cardId: string;
  asset: VoucherAsset;
  amountPerCard: bigint;
  message: string;
  redeemed: boolean;
}

export interface RedeemSuccess {
  cardId: string;
  asset: VoucherAsset;
  amountPerCard: bigint;
  message: string;
  txHash?: string;
}
