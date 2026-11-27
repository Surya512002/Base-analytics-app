import { beforeEach, describe, expect, it, vi } from "vitest";

const upsert = vi.fn(async () => true);
vi.mock("@/lib/voucher/credentials-store", () => ({ upsertCreatorBatch: upsert }));
vi.mock("@/lib/utils/base-rpc", () => ({ createBasePublicClient: () => ({ readContract: async () => BigInt(7) }) }));

const input = { asset: "ETH" as const, total: "0.002", cards: 2, creator: "0x1111111111111111111111111111111111111111" as const };

describe("preparing a gift batch only stores card codes for a signed-in creator", () => {
  beforeEach(() => upsert.mockClear());

  it("never writes to a wallet's card store just because someone named that wallet", async () => {
    const { prepareCreateBatch } = await import("@/lib/voucher/agent-api");
    const result = await prepareCreateBatch(input);
    expect(result.valid).toBe(true);
    expect(result.credentialsSaved).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("stores them when the caller has proved the wallet is theirs", async () => {
    const { prepareCreateBatch } = await import("@/lib/voucher/agent-api");
    const result = await prepareCreateBatch({ ...input, creatorSignedIn: true });
    expect(result.credentialsSaved).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
