import {
  listCreatorBatches,
  readBatchDetail,
} from "@/lib/voucher/batch-read";
import {
  prepareCreateBatch,
  prepareRedeem,
  voucherContractReady,
} from "@/lib/voucher/agent-api";
import { MAX_VOUCHER_CARDS, type VoucherAsset } from "@/lib/utils/voucher";
import { APP_URL_WEB } from "@/lib/constants/env";

export function voucherMcpReady(): boolean {
  return voucherContractReady();
}

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export async function mcpPrepareCreate(args: {
  asset?: string;
  total: string;
  cards: number;
  message?: string;
  creator?: string;
}) {
  if (!voucherMcpReady()) {
    return jsonResult({ valid: false, error: "Voucher contract not configured." });
  }

  const asset = (args.asset || "USDC").toUpperCase() as VoucherAsset;
  if (asset !== "USDC" && asset !== "ETH") {
    return jsonResult({ valid: false, error: "asset must be USDC or ETH" });
  }
  if (!args.total?.trim()) {
    return jsonResult({ valid: false, error: "total is required" });
  }
  if (!Number.isFinite(args.cards) || args.cards < 1 || args.cards > MAX_VOUCHER_CARDS) {
    return jsonResult({
      valid: false,
      error: `cards must be 1–${MAX_VOUCHER_CARDS}`,
    });
  }

  const creator = args.creator?.trim() as `0x${string}` | undefined;
  if (creator && !creator.startsWith("0x")) {
    return jsonResult({ valid: false, error: "creator must be a 0x address" });
  }

  const result = await prepareCreateBatch({
    asset,
    total: args.total,
    cards: args.cards,
    message: args.message || "",
    creator,
  });

  return jsonResult({
    ...result,
    nextStep:
      result.valid && result.calls.length > 0
        ? 'Pass response.calls to Base MCP send_calls with chain="base". After confirmation, show response.cards (cardId, secret, shareText) to the user once.'
        : undefined,
    appUrl: APP_URL_WEB,
  });
}

export async function mcpPrepareRedeem(args: { cardId: string; secret: string }) {
  if (!voucherMcpReady()) {
    return jsonResult({ valid: false, error: "Voucher contract not configured." });
  }
  if (!args.cardId?.trim() || !args.secret?.trim()) {
    return jsonResult({ valid: false, error: "cardId and secret are required" });
  }

  const result = await prepareRedeem(args.cardId.trim(), args.secret.trim());

  return jsonResult({
    ...result,
    nextStep:
      result.valid && result.preview && !result.preview.alreadyRedeemed
        ? `Confirm preview.amountFormatted (${result.preview.amountFormatted}) with the user, then send_calls(chain="base", calls=response.calls).`
        : undefined,
    appUrl: APP_URL_WEB,
  });
}

export async function mcpLookupBatch(batchId: number) {
  if (!Number.isFinite(batchId) || batchId < 1) {
    return jsonResult({ error: "batchId must be a positive integer" });
  }

  const detail = await readBatchDetail(batchId);
  if (!detail.batch) {
    return jsonResult({ batch: null, cards: [], error: "Batch not found onchain." });
  }

  return jsonResult({
    ...detail,
    unredeemedCount: detail.batch.unredeemedCount,
  });
}

export async function mcpListByCreator(creator: string) {
  const trimmed = creator?.trim();
  if (!trimmed?.startsWith("0x") || trimmed.length < 42) {
    return jsonResult({ error: "creator must be a 0x wallet address from get_wallets" });
  }

  const summary = await listCreatorBatches(trimmed);
  return jsonResult({
    ...summary,
    nextStep:
      summary.batchCount > 0
        ? "Use voucher_batch_status(batchId) for per-card redemption detail. Secrets are never returned here."
        : "No batches found for this wallet. Create one with voucher_prepare_create.",
    appUrl: APP_URL_WEB,
  });
}
