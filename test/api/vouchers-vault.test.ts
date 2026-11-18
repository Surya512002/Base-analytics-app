import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.fn();
const store = { vault: null as null | { envelope: unknown; version: number; updatedAt: number } };
const deleteCreds = vi.fn(async () => {});

vi.mock("@/lib/auth/siwe-session", () => ({ requireSiweSession: (a: string) => session(a) }));
vi.mock("@/lib/api/rate-limit", () => ({
  checkRateLimitAsync: vi.fn(async () => ({ ok: true })),
  getClientIp: () => "1.2.3.4",
  rateLimitResponse: () => new Response(null, { status: 429 }),
}));
vi.mock("@/lib/voucher/credentials-store", () => ({ deleteCreatorCredentials: () => deleteCreds() }));
vi.mock("@/lib/voucher/vault-store", () => ({
  MAX_VAULT_BYTES: 1024,
  readVault: async () => store.vault,
  writeVault: async (_c: string, envelope: unknown, baseVersion: number) => {
    const cur = store.vault?.version ?? 0;
    if (cur !== baseVersion) return { ok: false, conflict: true, current: store.vault };
    store.vault = { envelope, version: cur + 1, updatedAt: 1 };
    return { ok: true, vault: store.vault };
  },
  deleteVault: async () => {
    store.vault = null;
  },
}));

import { DELETE, GET, PUT } from "@/app/api/vouchers/vault/route";

const CREATOR = "0x00000000000000000000000000000000000a11ce";
const envelope = { v: 1, phraseWrap: { iv: "aa", ct: "bb", salt: "cc" }, data: { iv: "dd", ct: "ee" }, updatedAt: 1 };
const url = `http://localhost/api/vouchers/vault?creator=${CREATOR}`;
const put = (body: unknown) =>
  PUT(new Request("http://localhost/api/vouchers/vault", { method: "PUT", body: JSON.stringify(body) }));

beforeEach(() => {
  session.mockReset();
  deleteCreds.mockClear();
  store.vault = null;
});

describe("/api/vouchers/vault", () => {
  it("needs a wallet sign-in for that creator on every method", async () => {
    session.mockResolvedValue({ ok: false, status: 401, error: "Sign in" });
    expect((await GET(new Request(url))).status).toBe(401);
    expect((await put({ creator: CREATOR, envelope, baseVersion: 0 })).status).toBe(401);
    expect((await DELETE(new Request(url, { method: "DELETE" }))).status).toBe(401);
    expect(store.vault).toBeNull();
  });

  it("creates a vault, then deletes the server's readable copy of the secrets", async () => {
    session.mockResolvedValue({ ok: true, address: CREATOR });
    const res = await put({ creator: CREATOR, envelope, baseVersion: 0 });
    expect(res.status).toBe(200);
    expect(store.vault?.version).toBe(1);
    expect(deleteCreds).toHaveBeenCalledTimes(1);
    const got = (await (await GET(new Request(url))).json()) as { vault: { version: number } };
    expect(got.vault.version).toBe(1);
  });

  it("returns 409 with the current vault when another device wrote first", async () => {
    session.mockResolvedValue({ ok: true, address: CREATOR });
    await put({ creator: CREATOR, envelope, baseVersion: 0 });
    const stale = await put({ creator: CREATOR, envelope, baseVersion: 0 });
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as { vault: { version: number } }).vault.version).toBe(1);
  });

  it("rejects malformed and oversized envelopes", async () => {
    session.mockResolvedValue({ ok: true, address: CREATOR });
    expect((await put({ creator: CREATOR, envelope: { v: 1 }, baseVersion: 0 })).status).toBe(400);
    expect((await put({ creator: CREATOR, envelope, baseVersion: -1 })).status).toBe(400);
    const huge = { ...envelope, data: { iv: "dd", ct: "x".repeat(10_000) } };
    expect((await put({ creator: CREATOR, envelope: huge, baseVersion: 0 })).status).toBe(413);
    expect(store.vault).toBeNull();
  });

  it("can reset (delete) the vault", async () => {
    session.mockResolvedValue({ ok: true, address: CREATOR });
    await put({ creator: CREATOR, envelope, baseVersion: 0 });
    expect((await DELETE(new Request(url, { method: "DELETE" }))).status).toBe(200);
    expect(store.vault).toBeNull();
  });
});
