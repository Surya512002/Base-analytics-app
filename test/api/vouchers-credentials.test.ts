import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.fn();
const verify = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/auth/siwe-session", () => ({ requireSiweSession: (a: string) => session(a) }));
vi.mock("@/lib/voucher/verify-credentials", () => ({ verifyBatchCredentials: (...a: unknown[]) => verify(...a) }));
vi.mock("@/lib/voucher/credentials-store", () => ({
  readCreatorCredentials: vi.fn(async () => []),
  upsertCreatorBatch: (...a: unknown[]) => upsert(...a),
}));
vi.mock("@/lib/voucher/batch-read", () => ({ readOnchainBatches: vi.fn(async () => []) }));
const vault = vi.fn(async () => null);
vi.mock("@/lib/voucher/vault-store", () => ({ readVault: () => vault() }));
vi.mock("@/lib/api/rate-limit", () => ({
  checkRateLimitAsync: vi.fn(async () => ({ ok: true })),
  getClientIp: () => "1.2.3.4",
  rateLimitResponse: () => new Response(null, { status: 429 }),
}));

import { POST } from "@/app/api/vouchers/credentials/route";

const CREATOR = "0x00000000000000000000000000000000000a11ce";
const V1 = "0xe425b060d888dd54c57160f4c3b0d3fb76eccf25";
const body = {
  creator: CREATOR,
  batch: { batchId: 1, creator: CREATOR, cards: [{ batchId: 1, cardIndex: 0, cardId: "c", secret: "AAAA" }] },
};
const post = (b: unknown) =>
  POST(new Request("http://localhost/api/vouchers/credentials", { method: "POST", body: JSON.stringify(b) }));

beforeEach(() => {
  session.mockReset();
  verify.mockReset();
  upsert.mockReset();
});

describe("POST /api/vouchers/credentials", () => {
  it("refuses to save without a wallet sign-in for the creator", async () => {
    session.mockResolvedValue({ ok: false, status: 401, error: "Sign in" });
    const res = await post(body);
    expect(res.status).toBe(401);
    expect(verify).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses when signed in as a different wallet", async () => {
    session.mockResolvedValue({ ok: false, status: 403, error: "Session does not match" });
    expect((await post(body)).status).toBe(403);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("refuses secrets that don't match the onchain hashes", async () => {
    session.mockResolvedValue({ ok: true, address: CREATOR });
    verify.mockResolvedValue({ ok: false, reason: "Card secrets don't match this batch onchain" });
    expect((await post(body)).status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("saves verified secrets tagged with the contract they were verified on", async () => {
    session.mockResolvedValue({ ok: true, address: CREATOR });
    verify.mockResolvedValue({ ok: true, contract: V1, live: {} });
    const res = await post(body);
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledWith(CREATOR, expect.objectContaining({ batchId: 1, contractAddress: V1 }));
  });

  it("won't store readable secrets for a creator who turned on the private vault", async () => {
    session.mockResolvedValue({ ok: true, address: CREATOR });
    vault.mockResolvedValueOnce({ version: 1 } as never);
    const res = await post(body);
    expect(res.status).toBe(409);
    expect(verify).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("rejects malformed input before touching the session", async () => {
    expect((await post({ creator: "nope", batch: body.batch })).status).toBe(400);
    expect((await post({ creator: CREATOR })).status).toBe(400);
    expect(session).not.toHaveBeenCalled();
  });
});
