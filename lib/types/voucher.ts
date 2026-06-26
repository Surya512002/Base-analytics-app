import type { VoucherAsset } from "@/lib/utils/voucher";

export interface VoucherBatchMeta {
  batchId: number;
  creator: string;
  asset: VoucherAsset;
  totalAmount: string;
  amountPerCard: string;
  cardCount: number;
  message: string;
  redeemedCount: number;
  createdAt: number;
  txHash?: string;
}
