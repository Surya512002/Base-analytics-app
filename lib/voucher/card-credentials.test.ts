import { beforeEach, describe, expect, it, vi } from "vitest";

const multicall = vi.fn();
vi.mock("@/lib/utils/base-rpc", () => ({
  createBasePublicClient: vi.fn(() => ({ multicall, readContract: vi.fn() })),
}));

import { hashVoucherSecret, type StoredVoucherBatch } from "@/lib/utils/voucher";
import { readOnchainBatches } from "./batch-read";
import { findStoredBatchIndex } from "./credentials-store";
import { mergeServerSecrets } from "./credentials-client";
import { verifyBatchCredentials } from "./verify-credentials";
import { VOUCHER_V1_CONTRACT, VOUCHER_V2_CONTRACT, batchRefKey, candidateContracts } from "./voucher-contracts";

const ALICE = "0x00000000000000000000000000000000000a11ce";
const BOB = "0x0000000000000000000000000000000000000b0b";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const v1 = VOUCHER_V1_CONTRACT.toLowerCase();
const v2 = VOUCHER_V2_CONTRACT.toLowerCase();

type Call = { address: string; functionName: string; args?: readonly bigint[] };
type Entry = { status: "success"; result: unknown } | { status: "failure"; error: Error };
const ok = (result: unknown): Entry => ({ status: "success", result });
const fail: Entry = { status: "failure", error: new Error("revert") };

/** Fake chain: batches per `contract:id`, and card hashes per `contract:id:index`. */
function fakeChain(opts: {
  batches: Record<string, { creator: string; cardCount: number; expiresAt?: number }>;
  hashes?: Record<string, string>;
}) {
  multicall.mockImplementation(async (arg: { contracts: Call[] }) => {
    return (arg?.contracts ?? []).map((c): Entry => {
      const id = Number(c.args?.[0] ?? 0);
      const key = `${c.address.toLowerCase()}:${id}`;
      const b = opts.batches[key];
      if (c.functionName === "getBatch") {
        return ok(b ? [b.creator, USDC, BigInt(1_000_000), BigInt(b.cardCount), BigInt(0), "hi"] : [ZERO, USDC, BigInt(0), BigInt(0), BigInt(0), ""]);
      }
      if (c.functionName === "getBatchConfig") {
        // v1 has no getBatchConfig
        if (c.address.toLowerCase() === v1) return fail;
        return ok([BigInt(0), BigInt(b?.expiresAt ?? 0), ZERO]);
      }
      if (c.functionName === "cardSecretHashes") {
        const h = opts.hashes?.[`${key}:${Number(c.args?.[1])}`];
        return ok(h ?? "0x" + "0".repeat(64));
      }
      return fail;
    });
  });
}
const ZERO = "0x0000000000000000000000000000000000000000";

function batch(over: Partial<StoredVoucherBatch> = {}): StoredVoucherBatch {
  return {
    batchId: 1,
    asset: "USDC",
    totalAmount: "2000000",
    amountPerCard: "1000000",
    cardCount: 2,
    message: "",
    creator: ALICE,
    createdAt: 0,
    cards: [
      { batchId: 1, cardIndex: 0, cardId: "c0", secret: "AAAA-BBBB" },
      { batchId: 1, cardIndex: 1, cardId: "c1", secret: "CCCC-DDDD" },
    ],
    ...over,
  };
}

beforeEach(() => multicall.mockReset());

describe("voucher contract registry", () => {
  it("lists every known contract when a batch has no contract, else only its own", () => {
    expect(candidateContracts().map((a) => a.toLowerCase())).toEqual(expect.arrayContaining([v1, v2]));
    expect(candidateContracts(VOUCHER_V1_CONTRACT)).toEqual([VOUCHER_V1_CONTRACT]);
    // Unknown contracts are never trusted as a hint.
    expect(candidateContracts("0x1111111111111111111111111111111111111111").length).toBeGreaterThan(1);
    expect(batchRefKey(VOUCHER_V1_CONTRACT, 7)).toBe(`${v1}:7`);
  });
});

describe("readOnchainBatches", () => {
  it("reads every contract for an id in one multicall and keeps same-id batches apart", async () => {
    fakeChain({ batches: { [`${v1}:1`]: { creator: ALICE, cardCount: 2 }, [`${v2}:1`]: { creator: BOB, cardCount: 5 } } });
    const found = await readOnchainBatches([{ batchId: 1 }]);
    expect(multicall).toHaveBeenCalledTimes(1);
    expect(found.map((b) => [b.contractAddress, b.creator, b.cardCount]).sort()).toEqual(
      [
        [v1, ALICE, 2],
        [v2, BOB, 5],
      ].sort()
    );
    // v1 has no getBatchConfig: no expiry is reported, not an error.
    expect(found.find((b) => b.contractAddress === v1)?.expirationTimestamp).toBeUndefined();
  });
});

describe("verifyBatchCredentials", () => {
  const hashes = {
    [`${v1}:1:0`]: hashVoucherSecret("AAAA-BBBB"),
    [`${v1}:1:1`]: hashVoucherSecret("CCCC-DDDD"),
  };

  it("accepts secrets that match the onchain hashes, on the creator's own contract", async () => {
    // Same id on v2 belongs to someone else; v1 #1 is Alice's.
    fakeChain({
      batches: { [`${v1}:1`]: { creator: ALICE, cardCount: 2 }, [`${v2}:1`]: { creator: BOB, cardCount: 2 } },
      hashes,
    });
    const res = await verifyBatchCredentials(batch(), ALICE);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.contract.toLowerCase()).toBe(v1);
  });

  it("rejects a wrong secret (stops overwriting saved links with junk)", async () => {
    fakeChain({ batches: { [`${v1}:1`]: { creator: ALICE, cardCount: 2 } }, hashes });
    const tampered = batch({
      cards: [{ batchId: 1, cardIndex: 0, cardId: "c0", secret: "EVIL-EVIL" }],
    });
    expect((await verifyBatchCredentials(tampered, ALICE)).ok).toBe(false);
  });

  it("rejects a batch that belongs to another creator", async () => {
    fakeChain({ batches: { [`${v1}:1`]: { creator: BOB, cardCount: 2 } }, hashes });
    expect((await verifyBatchCredentials(batch(), ALICE)).ok).toBe(false);
    expect((await verifyBatchCredentials(batch({ creator: BOB }), ALICE)).ok).toBe(false);
  });

  it("rejects unknown contracts, out-of-range cards and empty payloads", async () => {
    fakeChain({ batches: { [`${v1}:1`]: { creator: ALICE, cardCount: 2 } }, hashes });
    expect((await verifyBatchCredentials(batch({ contractAddress: "0x1111111111111111111111111111111111111111" }), ALICE)).ok).toBe(false);
    expect(
      (await verifyBatchCredentials(batch({ cards: [{ batchId: 1, cardIndex: 9, cardId: "x", secret: "AAAA-BBBB" }] }), ALICE)).ok
    ).toBe(false);
    expect((await verifyBatchCredentials(batch({ cards: [{ batchId: 1, cardIndex: 0, cardId: "x", secret: "" }] }), ALICE)).ok).toBe(false);
  });
});

describe("stored record matching", () => {
  const rec = (batchId: number, contractAddress?: string) => batch({ batchId, contractAddress });

  it("matches on contract + id, and upgrades a legacy record saved without a contract", () => {
    const stored = [rec(1, v2), rec(1)];
    expect(findStoredBatchIndex(stored, { batchId: 1, contractAddress: v2 })).toBe(0);
    expect(findStoredBatchIndex(stored, { batchId: 1, contractAddress: v1 })).toBe(1);
    expect(findStoredBatchIndex([rec(1, v2)], { batchId: 1, contractAddress: v1 })).toBe(-1);
  });

  it("never merges secrets from the same id on a different contract", () => {
    const local = batch({ contractAddress: v1, cards: [{ batchId: 1, cardIndex: 0, cardId: "c0", secret: "" }] });
    const other = batch({ contractAddress: v2 });
    expect(mergeServerSecrets(local, [other]).cards[0]!.secret).toBe("");
    expect(mergeServerSecrets(local, [batch({ contractAddress: v1 })]).cards[0]!.secret).toBe("AAAA-BBBB");
  });
});
