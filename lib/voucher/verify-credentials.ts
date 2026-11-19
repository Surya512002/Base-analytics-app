import type { Address } from "viem";
import { VOUCHER_ABI } from "@/lib/constants/contracts";
import {
  MAX_VOUCHER_CARDS,
  hashVoucherSecret,
  type StoredVoucherBatch,
} from "@/lib/utils/voucher";
import { readOnchainBatches, type BatchLiveStatus } from "@/lib/voucher/batch-read";
import { isKnownVoucherContract } from "@/lib/voucher/voucher-contracts";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

/** Longest secret we accept (card secrets are ~20 chars; this only stops junk payloads). */
const MAX_SECRET_LENGTH = 128;

export type CredentialCheck =
  | { ok: true; contract: Address; live: BatchLiveStatus }
  | { ok: false; reason: string };

type MulticallEntry = { status: "success"; result: unknown } | { status: "failure"; error?: unknown };

/**
 * Accept card secrets only when every submitted secret hashes to the hash stored onchain for
 * that card, on a batch created by `creator`. That way nobody — not even a signed-in creator
 * with a buggy client — can overwrite saved secrets with wrong ones.
 *
 * Batch ids repeat across contracts (v1 and v2 both start at 1). When the batch doesn't say
 * which contract it's on, every known contract is tried, and the one whose hashes match wins.
 */
export async function verifyBatchCredentials(
  batch: StoredVoucherBatch,
  creator: string
): Promise<CredentialCheck> {
  const owner = creator.toLowerCase();
  if (batch.creator?.toLowerCase() !== owner) return { ok: false, reason: "Batch creator mismatch" };
  if (!Number.isInteger(batch.batchId) || batch.batchId < 1) return { ok: false, reason: "Invalid batch" };
  if (!Array.isArray(batch.cards) || batch.cards.length === 0 || batch.cards.length > MAX_VOUCHER_CARDS) {
    return { ok: false, reason: "Invalid cards" };
  }
  if (batch.contractAddress && !isKnownVoucherContract(batch.contractAddress)) {
    return { ok: false, reason: "Unknown voucher contract" };
  }

  const withSecrets: Array<{ cardIndex: number; secret: string }> = [];
  for (const card of batch.cards) {
    if (!Number.isInteger(card?.cardIndex) || card.cardIndex < 0) return { ok: false, reason: "Invalid card index" };
    const secret = typeof card.secret === "string" ? card.secret.trim() : "";
    if (secret.length > MAX_SECRET_LENGTH) return { ok: false, reason: "Invalid secret" };
    if (secret) withSecrets.push({ cardIndex: card.cardIndex, secret });
  }
  if (withSecrets.length === 0) return { ok: false, reason: "No card secrets" };

  const candidates = (
    await readOnchainBatches([{ batchId: batch.batchId, contract: batch.contractAddress }])
  ).filter((live) => live.creator === owner && live.contractAddress);
  if (candidates.length === 0) return { ok: false, reason: "Batch not confirmed onchain for this creator" };

  const client = createBasePublicClient();
  for (const live of candidates) {
    if (withSecrets.some((c) => c.cardIndex >= live.cardCount)) continue;
    const contract = live.contractAddress as Address;
    try {
      const results = (await client.multicall({
        contracts: withSecrets.map((c) => ({
          address: contract,
          abi: VOUCHER_ABI,
          functionName: "cardSecretHashes" as const,
          args: [BigInt(batch.batchId), BigInt(c.cardIndex)] as const,
        })),
        allowFailure: true,
      })) as MulticallEntry[];
      const allMatch = withSecrets.every((c, i) => {
        const r = results[i];
        return (
          r?.status === "success" &&
          typeof r.result === "string" &&
          r.result.toLowerCase() === hashVoucherSecret(c.secret).toLowerCase()
        );
      });
      if (allMatch) return { ok: true, contract, live };
    } catch {
      /* RPC failure on this contract: try the next one, else fail closed below */
    }
  }

  return { ok: false, reason: "Card secrets don't match this batch onchain" };
}
