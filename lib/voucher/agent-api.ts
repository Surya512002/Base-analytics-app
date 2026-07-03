import { type Hex } from "viem";
import { base } from "viem/chains";
import {
  ERC20_ABI,
  USDC_BASE,
  VOUCHER_ABI,
} from "@/lib/constants/contracts";
import { BASE_RPC, VOUCHER_CONTRACT } from "@/lib/constants/env";
import type { ContractCall } from "@/lib/utils/tx";
import { encodeContractCall } from "@/lib/utils/tx";
import {
  MAX_VOUCHER_CARDS,
  computeSplit,
  formatCardShareText,
  formatVoucherAmount,
  generateVoucherCards,
  hashVoucherSecret,
  parseCardId,
  type StoredVoucherBatch,
  type VoucherAsset,
} from "@/lib/utils/voucher";
import { upsertCreatorBatch } from "@/lib/voucher/credentials-store";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

export type McpCall = {
  to: `0x${string}`;
  data: Hex;
  value: string;
};

export function toMcpCall(call: ContractCall): McpCall {
  return {
    to: call.to,
    data: call.data,
    value: call.value ? `0x${call.value.toString(16)}` : "0x0",
  };
}

export function voucherContractReady(): boolean {
  return Boolean(VOUCHER_CONTRACT && BASE_RPC);
}

export async function readNextBatchId(): Promise<number> {
  const client = createBasePublicClient();
  const id = await client.readContract({
    address: VOUCHER_CONTRACT as `0x${string}`,
    abi: VOUCHER_ABI,
    functionName: "nextBatchId",
  });
  return Number(id);
}

export async function readUsdcAllowance(owner: `0x${string}`): Promise<bigint> {
  const client = createBasePublicClient();
  return client.readContract({
    address: USDC_BASE as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, VOUCHER_CONTRACT as `0x${string}`],
  });
}

export interface PrepareCreateInput {
  asset: VoucherAsset;
  total: string;
  cards: number;
  message?: string;
  creator?: `0x${string}`;
}

export interface PrepareCreateResult {
  protocol: "Base Voucher";
  chain: "base";
  contract: string;
  expectedBatchId: number;
  asset: VoucherAsset;
  /** Human input, e.g. "1" for $1 USDC */
  totalInput: string;
  /** Base units string — USDC 6 decimals, ETH wei */
  totalAmount: string;
  /** @deprecated Prefer totalInput (display) and totalAmount (contracts) */
  total: string;
  cardCount: number;
  /** Per-card amount in base units */
  perCard: string;
  perCardFormatted: string;
  message: string;
  valid: boolean;
  error?: string;
  calls: McpCall[];
  cards: Array<{
    cardId: string;
    cardIndex: number;
    secret: string;
    shareText: string;
  }>;
  credentialsSaved?: boolean;
}

export async function prepareCreateBatch(
  input: PrepareCreateInput
): Promise<PrepareCreateResult> {
  const { asset, total, cards, message = "", creator } = input;
  const trimmedMessage = message.trim();

  if (trimmedMessage.length > 280) {
    return {
      protocol: "Base Voucher",
      chain: "base",
      contract: VOUCHER_CONTRACT,
      expectedBatchId: 0,
      asset,
      totalInput: total,
      totalAmount: "0",
      total,
      cardCount: cards,
      perCard: "0",
      perCardFormatted: "",
      message: trimmedMessage,
      valid: false,
      error: "Message too long (max 280 characters).",
      calls: [],
      cards: [],
    };
  }

  const split = computeSplit(total, cards, asset);

  if (!split) {
    return {
      protocol: "Base Voucher",
      chain: "base",
      contract: VOUCHER_CONTRACT,
      expectedBatchId: 0,
      asset,
      totalInput: total,
      totalAmount: "0",
      total,
      cardCount: cards,
      perCard: "0",
      perCardFormatted: "",
      message: trimmedMessage,
      valid: false,
      error: `Invalid input. Use 1–${MAX_VOUCHER_CARDS} cards and an amount that splits evenly.`,
      calls: [],
      cards: [],
    };
  }

  if (!split.valid) {
    return {
      protocol: "Base Voucher",
      chain: "base",
      contract: VOUCHER_CONTRACT,
      expectedBatchId: 0,
      asset,
      totalInput: total,
      totalAmount: split.total.toString(),
      total,
      cardCount: cards,
      perCard: split.perCard.toString(),
      perCardFormatted: formatVoucherAmount(asset, split.perCard),
      message: trimmedMessage,
      valid: false,
      error: `${formatVoucherAmount(asset, split.total)} cannot split evenly into ${cards} cards.`,
      calls: [],
      cards: [],
    };
  }

  const expectedBatchId = await readNextBatchId();
  const voucherCards = generateVoucherCards(expectedBatchId, cards);
  const secretHashes = voucherCards.map((c) => hashVoucherSecret(c.secret));

  const calls: ContractCall[] = [];

  if (asset === "ETH") {
    calls.push(
      encodeContractCall(
        VOUCHER_CONTRACT as `0x${string}`,
        VOUCHER_ABI,
        "createEthBatch",
        [BigInt(cards), secretHashes, trimmedMessage],
        split.total
      )
    );
  } else {
    const needsApproval =
      !creator || (await readUsdcAllowance(creator)) < split.total;
    if (needsApproval) {
      calls.push(
        encodeContractCall(USDC_BASE as `0x${string}`, ERC20_ABI, "approve", [
          VOUCHER_CONTRACT as `0x${string}`,
          split.total,
        ])
      );
    }
    calls.push(
      encodeContractCall(
        VOUCHER_CONTRACT as `0x${string}`,
        VOUCHER_ABI,
        "createUsdcBatch",
        [BigInt(cards), secretHashes, trimmedMessage, split.total]
      )
    );
  }

  // Server-first: persist secrets by wallet address BEFORE user signs deposit (Base App / web / Farcaster).
  let credentialsSaved = false;
  if (creator) {
    const stored: StoredVoucherBatch = {
      batchId: expectedBatchId,
      asset,
      totalAmount: split.total.toString(),
      amountPerCard: split.perCard.toString(),
      cardCount: cards,
      message: trimmedMessage,
      creator: creator.toLowerCase(),
      createdAt: Date.now(),
      cards: voucherCards,
    };
    credentialsSaved = await upsertCreatorBatch(creator, stored);
    if (!credentialsSaved) {
      console.error("[prepareCreateBatch] failed to persist credentials for", creator);
    }
  }

  return {
    protocol: "Base Voucher",
    chain: "base",
    contract: VOUCHER_CONTRACT,
    expectedBatchId,
    asset,
    totalInput: total,
    totalAmount: split.total.toString(),
    total,
    cardCount: cards,
    perCard: split.perCard.toString(),
    perCardFormatted: formatVoucherAmount(asset, split.perCard),
    message: trimmedMessage,
    valid: true,
    calls: calls.map(toMcpCall),
    cards: voucherCards.map((c) => ({
      cardId: c.cardId,
      cardIndex: c.cardIndex,
      secret: c.secret,
      shareText: formatCardShareText(c, {
        asset,
        amountPerCard: split.perCard.toString(),
        message: trimmedMessage,
      }),
    })),
    credentialsSaved,
  };
}

export interface PrepareRedeemResult {
  protocol: "Base Voucher";
  chain: "base";
  valid: boolean;
  error?: string;
  cardId?: string;
  batchId?: number;
  cardIndex?: number;
  calls: McpCall[];
  preview?: {
    asset: VoucherAsset;
    amountFormatted: string;
    message: string;
    alreadyRedeemed: boolean;
  };
}

export async function prepareRedeem(
  cardId: string,
  secret: string
): Promise<PrepareRedeemResult> {
  const parsed = parseCardId(cardId);
  if (!parsed) {
    return {
      protocol: "Base Voucher",
      chain: "base",
      valid: false,
      error: 'Invalid card ID. Use format "batchId-cardIndex" (e.g. 12-3).',
      calls: [],
    };
  }

  const client = createBasePublicClient();
  const { batchId, cardIndex } = parsed;

  const [batch, redeemed] = await Promise.all([
    client.readContract({
      address: VOUCHER_CONTRACT as `0x${string}`,
      abi: VOUCHER_ABI,
      functionName: "getBatch",
      args: [BigInt(batchId)],
    }),
    client.readContract({
      address: VOUCHER_CONTRACT as `0x${string}`,
      abi: VOUCHER_ABI,
      functionName: "isCardRedeemed",
      args: [BigInt(batchId), BigInt(cardIndex)],
    }),
  ]);

  const [, token, amountPerCard, cardCount] = batch;
  if (cardCount === BigInt(0)) {
    return {
      protocol: "Base Voucher",
      chain: "base",
      valid: false,
      error: "Batch not found onchain.",
      calls: [],
    };
  }

  if (cardIndex >= Number(cardCount)) {
    return {
      protocol: "Base Voucher",
      chain: "base",
      valid: false,
      error: `This batch only has cards 0–${Number(cardCount) - 1}.`,
      calls: [],
    };
  }

  const asset: VoucherAsset =
    token === "0x0000000000000000000000000000000000000000" ? "ETH" : "USDC";

  if (redeemed) {
    return {
      protocol: "Base Voucher",
      chain: "base",
      valid: false,
      cardId,
      batchId,
      cardIndex,
      error: "This card has already been redeemed.",
      calls: [],
      preview: {
        asset,
        amountFormatted: formatVoucherAmount(asset, amountPerCard),
        message: batch[5] as string,
        alreadyRedeemed: true,
      },
    };
  }

  const call = encodeContractCall(
    VOUCHER_CONTRACT as `0x${string}`,
    VOUCHER_ABI,
    "redeem",
    [BigInt(batchId), BigInt(cardIndex), secret.replace(/\s/g, "").toUpperCase()]
  );

  return {
    protocol: "Base Voucher",
    chain: "base",
    valid: true,
    cardId,
    batchId,
    cardIndex,
    calls: [toMcpCall(call)],
    preview: {
      asset,
      amountFormatted: formatVoucherAmount(asset, amountPerCard),
      message: batch[5] as string,
      alreadyRedeemed: false,
    },
  };
}
