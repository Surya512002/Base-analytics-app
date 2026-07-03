import { VOUCHER_ABI } from "@/lib/constants/contracts";
import { VOUCHER_CONTRACT } from "@/lib/constants/env";
import {
  hashVoucherSecret,
  type StoredVoucherBatch,
} from "@/lib/utils/voucher";
import { readOnchainBatch } from "@/lib/voucher/batch-read";
import {
  recoverBatchFromTx,
  type VoucherChainReader,
} from "@/lib/voucher/tx-recovery";
import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import { BASE_RPC } from "@/lib/constants/env";

function getClient(): VoucherChainReader | null {
  if (!VOUCHER_CONTRACT || !BASE_RPC) return null;
  return createPublicClient({ chain: base, transport: http(BASE_RPC) });
}

/** True when submitted secrets match on-chain hashes (or batch not created yet). */
export async function verifyBatchCredentials(
  batch: StoredVoucherBatch,
  creator: string
): Promise<boolean> {
  const cardsWithSecrets = batch.cards.filter((c) => c.secret?.trim());
  if (cardsWithSecrets.length === 0) return true;

  const live = await readOnchainBatch(batch.batchId);
  if (!live) {
    // Pending batch — allow save before deposit confirms.
    return true;
  }

  const client = getClient();
  if (!client || !VOUCHER_CONTRACT) return false;

  const normalized = creator.toLowerCase();
  const creatorOk =
    live.creator === normalized ||
    Boolean(
      batch.txHash &&
        (await recoverBatchFromTx(
          client,
          batch.txHash as `0x${string}`,
          normalized
        ))
    );

  if (!creatorOk) return false;

  try {
    const checks = await Promise.all(
      cardsWithSecrets.map(async (card) => {
        const onChainHash = await (
          client as ReturnType<typeof createPublicClient>
        ).readContract({
          address: VOUCHER_CONTRACT as Address,
          abi: VOUCHER_ABI,
          functionName: "cardSecretHashes",
          args: [BigInt(batch.batchId), BigInt(card.cardIndex)],
        });
        return hashVoucherSecret(card.secret) === onChainHash;
      })
    );
    return checks.every(Boolean);
  } catch {
    return false;
  }
}
