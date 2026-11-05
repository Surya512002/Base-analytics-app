import { type Hex } from "viem";
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
  assetToToken,
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

export async function readTokenAllowance(
  token: `0x${string}`,
  owner: `0x${string}`
): Promise<bigint> {
  const client = createBasePublicClient();
  return client.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, VOUCHER_CONTRACT as `0x${string}`],
  });
}

export async function readUsdcAllowance(owner: `0x${string}`): Promise<bigint> {
  return readTokenAllowance(USDC_BASE as `0x${string}`, owner);
}


export interface PrepareCreateInput {
  asset: VoucherAsset;
  total: string;
  cards: number;
  message?: string;
  creator?: `0x${string}`;
  unlockTimestamp?: number;
  expirationTimestamp?: number;
  requiredSigner?: `0x${string}`;
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
  unlockTimestamp?: number;
  expirationTimestamp?: number;
  requiredSigner?: `0x${string}`;
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
  const hasCustomConfig = Boolean(
    input.unlockTimestamp || input.expirationTimestamp || input.requiredSigner
  );
  const unlockTs = BigInt(input.unlockTimestamp || 0);
  const expTs = BigInt(input.expirationTimestamp || 0);
  const reqSigner = (input.requiredSigner || "0x0000000000000000000000000000000000000000") as `0x${string}`;

  if (asset === "ETH") {
    if (hasCustomConfig) {
      calls.push(
        encodeContractCall(
          VOUCHER_CONTRACT as `0x${string}`,
          VOUCHER_ABI,
          "createEthBatchCustom",
          [BigInt(cards), secretHashes, trimmedMessage, unlockTs, expTs, reqSigner],
          split.total
        )
      );
    } else {
      calls.push(
        encodeContractCall(
          VOUCHER_CONTRACT as `0x${string}`,
          VOUCHER_ABI,
          "createEthBatch",
          [BigInt(cards), secretHashes, trimmedMessage],
          split.total
        )
      );
    }
  } else if (asset === "USDC") {
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
    if (hasCustomConfig) {
      calls.push(
        encodeContractCall(
          VOUCHER_CONTRACT as `0x${string}`,
          VOUCHER_ABI,
          "createTokenBatchCustom",
          [USDC_BASE as `0x${string}`, BigInt(cards), secretHashes, trimmedMessage, split.total, unlockTs, expTs, reqSigner]
        )
      );
    } else {
      calls.push(
        encodeContractCall(
          VOUCHER_CONTRACT as `0x${string}`,
          VOUCHER_ABI,
          "createUsdcBatch",
          [BigInt(cards), secretHashes, trimmedMessage, split.total]
        )
      );
    }
  } else {
    // Tokenized Stock (RWA)
    const tokenAddr = assetToToken(asset);
    const needsApproval =
      !creator || (await readTokenAllowance(tokenAddr, creator)) < split.total;
    if (needsApproval) {
      calls.push(
        encodeContractCall(tokenAddr, ERC20_ABI, "approve", [
          VOUCHER_CONTRACT as `0x${string}`,
          split.total,
        ])
      );
    }
    if (hasCustomConfig) {
      calls.push(
        encodeContractCall(
          VOUCHER_CONTRACT as `0x${string}`,
          VOUCHER_ABI,
          "createTokenBatchCustom",
          [tokenAddr, BigInt(cards), secretHashes, trimmedMessage, split.total, unlockTs, expTs, reqSigner]
        )
      );
    } else {
      calls.push(
        encodeContractCall(
          VOUCHER_CONTRACT as `0x${string}`,
          VOUCHER_ABI,
          "createTokenBatch",
          [tokenAddr, BigInt(cards), secretHashes, trimmedMessage, split.total]
        )
      );
    }
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
    unlockTimestamp: input.unlockTimestamp,
    expirationTimestamp: input.expirationTimestamp,
    requiredSigner: input.requiredSigner,
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

  let isTimeLocked = false;
  let isExpired = false;
  let unlockDateStr = "";
  try {
    const config = await client.readContract({
      address: VOUCHER_CONTRACT as `0x${string}`,
      abi: VOUCHER_ABI,
      functionName: "getBatchConfig",
      args: [BigInt(batchId)],
    });
    const unlockTs = Number(config[0]);
    const expTs = Number(config[1]);
    const nowSec = Math.floor(Date.now() / 1000);
    if (unlockTs > 0 && nowSec < unlockTs) {
      isTimeLocked = true;
      unlockDateStr = new Date(unlockTs * 1000).toLocaleString();
    }
    if (expTs > 0 && nowSec >= expTs) {
      isExpired = true;
    }
  } catch {
    // Legacy deployment fallback
  }

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

  if (isTimeLocked) {
    return {
      protocol: "Base Voucher",
      chain: "base",
      valid: false,
      cardId,
      batchId,
      cardIndex,
      error: `This voucher is time-locked until ${unlockDateStr}.`,
      calls: [],
      preview: {
        asset,
        amountFormatted: formatVoucherAmount(asset, amountPerCard),
        message: batch[5] as string,
        alreadyRedeemed: false,
      },
    };
  }

  if (isExpired) {
    return {
      protocol: "Base Voucher",
      chain: "base",
      valid: false,
      cardId,
      batchId,
      cardIndex,
      error: "This voucher has expired.",
      calls: [],
      preview: {
        asset,
        amountFormatted: formatVoucherAmount(asset, amountPerCard),
        message: batch[5] as string,
        alreadyRedeemed: false,
      },
    };
  }

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
