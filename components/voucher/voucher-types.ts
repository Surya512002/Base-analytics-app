import type { VoucherAsset } from "@/lib/utils/voucher";

export type VoucherView = "create" | "redeem" | "view" | "mine";

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
