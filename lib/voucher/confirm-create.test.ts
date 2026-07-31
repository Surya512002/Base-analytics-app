import { beforeEach, describe, expect, it, vi } from "vitest";

const CREATOR = "0x2222222222222222222222222222222222222222";
const TX_HASH = `0x${"ab".repeat(32)}`;

// vi.mock factories are hoisted — keep the address literal inline.
vi.mock("@/lib/constants/env", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/constants/env")>()),
  VOUCHER_CONTRACT: "0x1111111111111111111111111111111111111111",
}));

vi.mock("@/lib/voucher/tx-recovery", () => ({
  batchCreatedInTx: vi.fn(),
}));

import { finalizePendingBatchFromTx } from "@/lib/voucher/confirm-create";
import { batchCreatedInTx } from "@/lib/voucher/tx-recovery";
import { hashVoucherSecret, type StoredVoucherBatch } from "@/lib/utils/voucher";

const SECRET = "ABCDE-FGHIJ";

/** Batch id guessed at prepare time — the real one is only known after the deposit. */
function pendingBatch(): StoredVoucherBatch {
  return {
    batchId: 41,
    asset: "ETH",
    totalAmount: "1000",
    amountPerCard: "1000",
    cardCount: 1,
    message: "gm",
    creator: CREATOR,
    createdAt: 0,
    cards: [{ batchId: 41, cardIndex: 0, cardId: "41-0", secret: SECRET }],
  };
}

function makeClient(readContract: (args: { functionName: string; args: readonly unknown[] }) => Promise<unknown>) {
  return {
    waitForTransactionReceipt: async () => ({ status: "success" }),
    readContract,
    getTransactionReceipt: async () => ({ status: "success", logs: [] }),
    getTransaction: async () => ({ from: CREATOR }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("finalizePendingBatchFromTx", () => {
  beforeEach(() => vi.mocked(batchCreatedInTx).mockReset());

  it("returns the batch from the receipt when secret-hash reads fail", async () => {
    vi.mocked(batchCreatedInTx).mockResolvedValue({
      batchId: 42,
      onChainCreator: CREATOR,
    });

    const client = makeClient(async () => {
      throw new Error("rate limited");
    });

    const out = await finalizePendingBatchFromTx(client, pendingBatch(), TX_HASH);

    expect(out).not.toBeNull();
    expect(out?.batchId).toBe(42);
    expect(out?.cards[0].cardId).toBe("42-0");
    expect(out?.cards[0].secret).toBe(SECRET);
    expect(out?.txHash).toBe(TX_HASH);
  });

  it("prefers the batch id whose on-chain secret hashes match", async () => {
    vi.mocked(batchCreatedInTx).mockResolvedValue(null);

    const client = makeClient(async ({ functionName, args }) => {
      if (functionName === "nextBatchId") return BigInt(43);
      if (functionName === "cardSecretHashes") {
        return Number(args[0]) === 42
          ? hashVoucherSecret(SECRET)
          : `0x${"0".repeat(64)}`;
      }
      throw new Error(`unexpected ${functionName}`);
    });

    const out = await finalizePendingBatchFromTx(client, pendingBatch(), TX_HASH);

    expect(out?.batchId).toBe(42);
    expect(out?.cards[0].secret).toBe(SECRET);
  });
});
