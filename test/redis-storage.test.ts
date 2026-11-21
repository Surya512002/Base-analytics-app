import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeRedis } from "./helpers/fake-redis";

let redis: FakeRedis;
vi.mock("@/lib/redis-cache", () => ({ getReadyRedis: async () => redis }));
vi.mock("@/lib/utils/disk-store", () => ({ readDiskJson: (_f: string, d: unknown) => d, writeDiskJson: () => {} }));

const A = "0x" + "a".repeat(40);
const B = "0x" + "b".repeat(40);
const C = "0x" + "c".repeat(40);
const TOKEN = "0x" + "1".repeat(40);
const hash = (n: number) => "0x" + n.toString(16).padStart(64, "0");

beforeEach(() => {
  redis = new FakeRedis();
  vi.resetModules();
});

describe("fee ledger", () => {
  const ev = (n: number, share: string, extra = {}) => ({
    txHash: hash(n),
    tokenAddress: TOKEN,
    tokenSymbol: "TKN",
    trader: B,
    creator: A,
    referrer: null,
    direction: "buy" as const,
    feeAsset: "eth" as const,
    feeAmount: share,
    creatorShare: share,
    platformShare: "0",
    referrerShare: "0",
    ...extra,
  });

  it("adds up concurrent events without losing any, and counts a repeated tx once", async () => {
    const { recordFeeEvent, getCreatorRevenue } = await import("@/lib/launchpad/fee-ledger");
    const big = "9000000000000000000"; // 9 ETH in wei: two of these overflow a plain int64 counter
    await Promise.all([1, 2, 3, 4].map((n) => recordFeeEvent(ev(n, big))));
    await recordFeeEvent(ev(1, big)); // same tx again
    const s = await getCreatorRevenue(A);
    expect(s.eventCount).toBe(4);
    expect(s.totalShare).toBe("36000000000000000000");
    expect(s.byToken[0].tokenSymbol).toBe("TKN");
  });

  it("keeps only the latest events in the recent list but counts everything", async () => {
    const { recordFeeEvent, getCreatorRevenue } = await import("@/lib/launchpad/fee-ledger");
    for (let n = 1; n <= 60; n++) await recordFeeEvent(ev(n, "1"));
    const s = await getCreatorRevenue(A);
    expect(s.eventCount).toBe(60);
    expect(s.recent).toHaveLength(20);
    expect(s.recent[0].txHash).toBe(hash(60));
  });

  it("credits referrers and moves the old blob over once", async () => {
    await redis.set("launchpad:fee-events:v1", JSON.stringify([ev(1, "5", { referrer: C, referrerShare: "2" })]));
    const { getReferrerRevenue, getCreatorRevenue } = await import("@/lib/launchpad/fee-ledger");
    expect((await getReferrerRevenue(C)).totalShare).toBe("2");
    expect((await getCreatorRevenue(A)).eventCount).toBe(1);
    expect((await getCreatorRevenue(A)).eventCount).toBe(1);
  });
});

describe("voucher batches", () => {
  const batch = (id: number, creator: string, contract?: string) => ({
    batchId: id,
    creator,
    asset: "usdc" as never,
    totalAmount: "1",
    amountPerCard: "1",
    cardCount: 1,
    message: "",
    redeemedCount: 0,
    createdAt: id,
    contractAddress: contract,
  });

  it("keeps both batches when two creators save at the same time", async () => {
    const { upsertStoredBatch, readStoredBatches } = await import("@/lib/voucher/batch-store");
    await Promise.all([upsertStoredBatch(batch(1, A, TOKEN)), upsertStoredBatch(batch(1, B, C))]);
    expect((await readStoredBatches()).map((b) => b.creator).sort()).toEqual([A, B]);
  });

  it("moves the old list over, and a re-save under a real contract replaces the legacy row", async () => {
    await redis.set("base_voucher_batches", JSON.stringify([batch(7, A), batch(8, B)]));
    const { upsertStoredBatch, readStoredBatches } = await import("@/lib/voucher/batch-store");
    expect(await readStoredBatches()).toHaveLength(2);
    await upsertStoredBatch(batch(7, A, TOKEN), batch(7, A));
    const all = await readStoredBatches();
    expect(all).toHaveLength(2);
    expect(all.find((b) => b.batchId === 7)?.contractAddress).toBe(TOKEN);
  });
});

describe("referrals", () => {
  it("pays once per joiner, even when the same join arrives twice at once", async () => {
    const { joinReferral, getReferral, referralCode } = await import("@/lib/referral/store");
    await Promise.all([joinReferral(redis as never, B, A), joinReferral(redis as never, B, A)]);
    const joiner = await getReferral(redis as never, B);
    expect(joiner.bonusXp).toBe(50);
    expect(joiner.referredBy).toBe(referralCode(A));
    const ref = await getReferral(redis as never, A);
    expect(ref.invites).toBe(1);
    expect(ref.bonusXp).toBe(25);
  });

  it("resolves an 8-char code and ignores self-referral", async () => {
    const { joinReferral, getReferral, referralCode } = await import("@/lib/referral/store");
    await getReferral(redis as never, A); // registers A's code
    expect((await joinReferral(redis as never, C, referralCode(A))).referredBy).toBe(referralCode(A));
    expect((await joinReferral(redis as never, A, A)).referredBy).toBeNull();
  });

  it("moves the old blobs over, including a code-keyed bucket", async () => {
    const { referralCode, getReferral } = await import("@/lib/referral/store");
    await redis.set("base_referrals_v1", JSON.stringify({ [referralCode(A)]: { invites: [B], bonusXp: 25 } }));
    await redis.set("base_ref_code_index_v1", JSON.stringify({ [referralCode(A)]: A }));
    const r = await getReferral(redis as never, A);
    expect(r.invites).toBe(1);
    expect(r.bonusXp).toBe(25);
  });
});
