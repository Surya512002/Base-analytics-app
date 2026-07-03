import type { StoredVoucherBatch } from "@/lib/utils/voucher";

/** Persist card secrets on the server keyed by wallet address (not browser). */
export async function saveWalletCredentials(
  creator: string,
  batch: StoredVoucherBatch
): Promise<boolean> {
  if (!creator?.startsWith("0x") || !batch.cards.some((c) => c.secret?.trim())) {
    return false;
  }

  try {
    const res = await fetch("/api/vouchers/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creator: creator.toLowerCase(),
        batch: { ...batch, creator: creator.toLowerCase() },
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Load all batches with card secrets for a connected wallet address. */
export async function loadWalletCredentials(
  creator: string
): Promise<StoredVoucherBatch[]> {
  if (!creator?.startsWith("0x")) return [];

  try {
    const res = await fetch(
      `/api/vouchers/credentials?creator=${encodeURIComponent(creator.toLowerCase())}`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { batches?: StoredVoucherBatch[] };
    return data.batches ?? [];
  } catch {
    return [];
  }
}

/** Merge server-stored secrets into a batch (server wins when local secret is empty). */
export function mergeServerSecrets(
  batch: StoredVoucherBatch,
  serverBatches: StoredVoucherBatch[]
): StoredVoucherBatch {
  const server = serverBatches.find((b) => b.batchId === batch.batchId);
  if (!server) return batch;

  return {
    ...batch,
    txHash: batch.txHash ?? server.txHash,
    cards: batch.cards.map((c, i) => ({
      ...c,
      secret: c.secret?.trim() || server.cards[i]?.secret || "",
      cardId: c.cardId || server.cards[i]?.cardId || c.cardId,
    })),
  };
}
