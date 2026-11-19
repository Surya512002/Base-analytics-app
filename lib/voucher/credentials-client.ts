import type { StoredVoucherBatch } from "@/lib/utils/voucher";

/**
 * Saving secrets needs a wallet sign-in (SIWE) for the creator. Saves made before the creator
 * signs in are kept here (this browser already holds the same secrets in its local batch store)
 * and sent once a signed-in load of the creator's credentials succeeds.
 */
const pendingKey = (creator: string) => `base_voucher_cred_sync_v1_${creator.toLowerCase()}`;
const MAX_PENDING = 50;

function readPending(creator: string): StoredVoucherBatch[] {
  try {
    const raw = localStorage.getItem(pendingKey(creator));
    const parsed = raw ? (JSON.parse(raw) as StoredVoucherBatch[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePending(creator: string, batches: StoredVoucherBatch[]): void {
  try {
    if (batches.length === 0) localStorage.removeItem(pendingKey(creator));
    else localStorage.setItem(pendingKey(creator), JSON.stringify(batches.slice(0, MAX_PENDING)));
  } catch {
    /* private mode: secrets are still in the local batch store */
  }
}

const sameBatch = (a: StoredVoucherBatch, b: StoredVoucherBatch) =>
  a.batchId === b.batchId &&
  (!a.contractAddress || !b.contractAddress || a.contractAddress.toLowerCase() === b.contractAddress.toLowerCase());

function queuePending(creator: string, batch: StoredVoucherBatch): void {
  writePending(creator, [batch, ...readPending(creator).filter((b) => !sameBatch(b, batch))]);
}

async function postCredentials(creator: string, batch: StoredVoucherBatch): Promise<number> {
  const res = await fetch("/api/vouchers/credentials", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      creator: creator.toLowerCase(),
      batch: { ...batch, creator: creator.toLowerCase() },
    }),
  });
  return res.status;
}

/** Persist card secrets on the server keyed by wallet address (not browser). */
export async function saveWalletCredentials(
  creator: string,
  batch: StoredVoucherBatch
): Promise<boolean> {
  if (!creator?.startsWith("0x") || !batch.cards.some((c) => c.secret?.trim())) {
    return false;
  }

  try {
    const status = await postCredentials(creator, batch);
    if (status === 401 || status === 403) {
      queuePending(creator, batch);
      return false;
    }
    return status >= 200 && status < 300;
  } catch {
    queuePending(creator, batch);
    return false;
  }
}

/** Send saves queued while the creator wasn't signed in. Keeps any that still fail to auth. */
async function flushPending(creator: string): Promise<void> {
  const pending = readPending(creator);
  if (pending.length === 0) return;
  const keep: StoredVoucherBatch[] = [];
  for (const batch of pending) {
    try {
      const status = await postCredentials(creator, batch);
      // 400 = not onchain yet or secrets don't match: retrying won't help, drop it.
      if (status === 401 || status === 403 || status === 429 || status >= 500) keep.push(batch);
    } catch {
      keep.push(batch);
    }
  }
  writePending(creator, keep);
}

/** Load all batches with card secrets for a connected wallet address. */
export async function loadWalletCredentials(
  creator: string
): Promise<StoredVoucherBatch[]> {
  if (!creator?.startsWith("0x")) return [];

  try {
    const url = `/api/vouchers/credentials?creator=${encodeURIComponent(creator.toLowerCase())}`;
    let res = await fetch(url, { cache: "no-store", credentials: "include" });
    if (!res.ok) return [];
    // Signed in: send any saves queued before sign-in, then re-read so they show up.
    if (readPending(creator).length > 0) {
      await flushPending(creator);
      res = await fetch(url, { cache: "no-store", credentials: "include" });
      if (!res.ok) return [];
    }
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
  // Batch ids repeat across contracts: match the contract too when both sides know it.
  const server = serverBatches.find((b) => sameBatch(b, batch));
  if (!server) return batch;

  const serverSecret = (cardIndex: number) =>
    server.cards.find((c) => c.cardIndex === cardIndex)?.secret?.trim() || "";

  return {
    ...batch,
    contractAddress: batch.contractAddress ?? server.contractAddress,
    txHash: batch.txHash ?? server.txHash,
    cards: batch.cards.map((c) => ({
      ...c,
      secret: c.secret?.trim() || serverSecret(c.cardIndex),
      cardId: c.cardId || server.cards.find((x) => x.cardIndex === c.cardIndex)?.cardId || c.cardId,
    })),
  };
}
