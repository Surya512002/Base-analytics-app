import { beforeEach, describe, expect, it, vi } from "vitest";

const WALLET = "0x00000000000000000000000000000000000a11ce";
const OTHER = "0x0000000000000000000000000000000000000b0b";
const TOKEN = "0x2222222222222222222222222222222222222222";

const store = vi.hoisted(() => ({ listPriceAlerts: vi.fn(async () => []), upsertPriceAlert: vi.fn(async (a: unknown) => a), removePriceAlert: vi.fn(async () => undefined) }));
const session = vi.hoisted(() => ({ current: null as string | null }));

vi.mock("@/lib/price-alerts/store", () => store);
vi.mock("@/lib/api/rate-limit", () => ({ checkRateLimitAsync: async () => ({ ok: true }), getClientIp: () => "1.1.1.1", rateLimitResponse: () => new Response("slow down", { status: 429 }) }));
vi.mock("@/lib/auth/siwe-session", () => ({
  requireSiweSession: async (expected?: string) =>
    !session.current
      ? { ok: false, status: 401, error: "Sign in with your wallet to continue" }
      : expected && session.current !== expected.toLowerCase()
        ? { ok: false, status: 403, error: "Session does not match this wallet" }
        : { ok: true, address: session.current },
}));

import { DELETE, GET, POST } from "@/app/api/price-alerts/route";

const post = () => new Request("http://x/api/price-alerts", { method: "POST", body: JSON.stringify({ wallet: WALLET, address: TOKEN, symbol: "ABC", direction: "above", priceUsd: 2 }) });

beforeEach(() => {
  session.current = null;
  vi.clearAllMocks();
});

describe("price alerts need the wallet's own sign-in", () => {
  it("refuses everything when nobody is signed in, and never touches the store", async () => {
    expect((await GET(new Request(`http://x/api/price-alerts?wallet=${WALLET}`))).status).toBe(401);
    expect((await POST(post())).status).toBe(401);
    expect((await DELETE(new Request(`http://x/api/price-alerts?wallet=${WALLET}&address=${TOKEN}`))).status).toBe(401);
    expect(store.listPriceAlerts).not.toHaveBeenCalled();
    expect(store.upsertPriceAlert).not.toHaveBeenCalled();
    expect(store.removePriceAlert).not.toHaveBeenCalled();
  });

  it("refuses someone else's wallet", async () => {
    session.current = OTHER;
    expect((await GET(new Request(`http://x/api/price-alerts?wallet=${WALLET}`))).status).toBe(403);
    expect((await POST(post())).status).toBe(403);
    expect((await DELETE(new Request(`http://x/api/price-alerts?wallet=${WALLET}&address=${TOKEN}`))).status).toBe(403);
    expect(store.upsertPriceAlert).not.toHaveBeenCalled();
    expect(store.removePriceAlert).not.toHaveBeenCalled();
  });

  it("lets the signed-in wallet list, set and remove its own alerts", async () => {
    session.current = WALLET;
    expect((await GET(new Request(`http://x/api/price-alerts?wallet=${WALLET}`))).status).toBe(200);
    expect((await POST(post())).status).toBe(200);
    expect((await DELETE(new Request(`http://x/api/price-alerts?wallet=${WALLET}&address=${TOKEN}`))).status).toBe(200);
    expect(store.upsertPriceAlert).toHaveBeenCalledTimes(1);
    expect(store.removePriceAlert).toHaveBeenCalledTimes(1);
  });
});
