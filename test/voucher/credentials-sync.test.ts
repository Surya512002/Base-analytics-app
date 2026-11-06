import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  readCreatorCredentials,
  upsertCreatorBatch,
} from "@/lib/voucher/credentials-store";
import type { StoredVoucherBatch } from "@/lib/utils/voucher";

describe("Voucher Credentials Cross-Device Store", () => {
  const creator = "0x1234567890123456789012345678901234567890";
  const mockBatch: StoredVoucherBatch = {
    batchId: 999,
    creator,
    asset: "USDC",
    totalAmount: "10000000",
    amountPerCard: "2000000",
    cardCount: 5,
    message: "Test gift card",
    createdAt: Date.now(),
    cards: [
      {
        batchId: 999,
        cardIndex: 0,
        cardId: "999-0",
        secret: "SECRET123456",
      },
      {
        batchId: 999,
        cardIndex: 1,
        cardId: "999-1",
        secret: "SECRET654321",
      },
    ],
  };

  it("persists and reads back credentials across devices without relying on Redis", async () => {
    const saved = await upsertCreatorBatch(creator, mockBatch);
    expect(saved).toBe(true);

    const loaded = await readCreatorCredentials(creator);
    expect(loaded.length).toBeGreaterThanOrEqual(1);

    const found = loaded.find((b) => b.batchId === 999);
    expect(found).toBeDefined();
    expect(found?.cards[0]?.secret).toBe("SECRET123456");
    expect(found?.cards[1]?.secret).toBe("SECRET654321");
  });

  it("isolates credentials so different creators cannot access each other's secrets", async () => {
    const otherCreator = "0x9999999999999999999999999999999999999999";
    const otherBatches = await readCreatorCredentials(otherCreator);
    const leaked = otherBatches.find((b) => b.batchId === 999);
    expect(leaked).toBeUndefined();
  });
});
