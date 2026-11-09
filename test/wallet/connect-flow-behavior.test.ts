import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { connectAppWallet } from "@/lib/utils/mini-app-connect";
import { ensureBaseNetwork } from "@/lib/utils/wallet-connection";
import { signInWithSiwe } from "@/lib/auth/siwe-client";

vi.mock("@farcaster/miniapp-sdk", () => ({
  sdk: {
    isInMiniApp: vi.fn(async () => false),
  },
}));

describe("K6: Connect Flow Hardening & Provider Call Invariants", () => {
  let origWindow: unknown;
  let origFetch: unknown;
  let origLocalStorage: unknown;

  beforeEach(() => {
    origWindow = (globalThis as unknown as Record<string, unknown>).window;
    origFetch = (globalThis as unknown as Record<string, unknown>).fetch;
    origLocalStorage = (globalThis as unknown as Record<string, unknown>).localStorage;

    const storage = new Map<string, string>();
    (globalThis as unknown as Record<string, unknown>).localStorage = {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, String(v)),
      removeItem: (k: string) => storage.delete(k),
      clear: () => storage.clear(),
    };

    const mockWin: Record<string, unknown> = {
      ...globalThis,
      location: { hostname: "localhost" },
      localStorage: (globalThis as unknown as Record<string, unknown>).localStorage,
    };
    mockWin.window = mockWin;
    (globalThis as unknown as Record<string, unknown>).window = mockWin;
  });

  afterEach(() => {
    (globalThis as unknown as Record<string, unknown>).window = origWindow;
    (globalThis as unknown as Record<string, unknown>).fetch = origFetch;
    (globalThis as unknown as Record<string, unknown>).localStorage = origLocalStorage;
  });

  it("connectAppWallet does NOT issue personal_sign or wallet_switchEthereumChain on connect", async () => {
    const methodCalls: string[] = [];

    const mockProvider = {
      request: vi.fn(async ({ method }: { method: string; params?: unknown[] }) => {
        methodCalls.push(method);
        if (method === "eth_requestAccounts" || method === "eth_accounts") {
          return ["0x1111111111111111111111111111111111111111"];
        }
        if (method === "eth_chainId") {
          return "0x1"; // Ethereum Mainnet (wrong chain)
        }
        return null;
      }),
    };

    (globalThis as unknown as { window: { ethereum?: unknown } }).window.ethereum = mockProvider;

    const res = await connectAppWallet("injected");
    expect(res.address).toBe("0x1111111111111111111111111111111111111111");

    // Invariant 1: Zero signature requests on connect
    expect(methodCalls).not.toContain("personal_sign");
    expect(methodCalls).not.toContain("eth_sign");
    expect(methodCalls).not.toContain("eth_signTypedData_v4");

    // Invariant 2: Zero chain switch/add requests on connect
    expect(methodCalls).not.toContain("wallet_switchEthereumChain");
    expect(methodCalls).not.toContain("wallet_addEthereumChain");
  });

  it("ensureBaseNetwork only prompts wallet_switchEthereumChain when explicitly invoked", async () => {
    const methodCalls: Array<{ method: string; params?: unknown[] }> = [];

    const wrongChainProvider = {
      request: vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
        methodCalls.push({ method, params });
        if (method === "eth_chainId") {
          return "0x1"; // Ethereum Mainnet (1)
        }
        if (method === "wallet_switchEthereumChain") {
          return null;
        }
        return null;
      }),
    };

    // Explicitly run ensureBaseNetwork for Base Mainnet (8453 / 0x2105)
    await ensureBaseNetwork(wrongChainProvider);

    expect(methodCalls.map((c) => c.method)).toEqual([
      "eth_chainId",
      "wallet_switchEthereumChain",
    ]);
    expect(methodCalls[1].params).toEqual([{ chainId: "0x2105" }]);
  });

  it("ensureBaseNetwork is a no-op when already on the requested chain", async () => {
    const methodCalls: Array<{ method: string; params?: unknown[] }> = [];

    const matchedProvider = {
      request: vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
        methodCalls.push({ method, params });
        if (method === "eth_chainId") {
          return "0x2105"; // Already on Base Mainnet
        }
        return null;
      }),
    };

    await ensureBaseNetwork(matchedProvider);

    // Only eth_chainId read, no switch or add called
    expect(methodCalls.map((c) => c.method)).toEqual(["eth_chainId"]);
  });

  it("personal_sign fires exactly once when explicit signInWithSiwe is executed", async () => {
    const methodCalls: Array<{ method: string; params?: unknown[] }> = [];

    const mockProvider = {
      request: vi.fn(async ({ method, params }: { method: string; params?: unknown[] }) => {
        methodCalls.push({ method, params });
        if (method === "personal_sign") {
          return "0xmocksignature123";
        }
        return null;
      }),
    };

    (globalThis as unknown as { window: { ethereum?: unknown } }).window.ethereum = mockProvider;

    (globalThis as unknown as Record<string, unknown>).fetch = vi.fn(async (url: string) => {
      if (url.includes("/api/auth/nonce")) {
        return {
          ok: true,
          json: async () => ({ nonce: "abcdef12", message: "Sign in to Base Terminal" }),
        };
      }
      if (url.includes("/api/auth/verify")) {
        return {
          ok: true,
          json: async () => ({ ok: true, address: "0x1111111111111111111111111111111111111111" }),
        };
      }
      return { ok: false };
    });

    const res = await signInWithSiwe("0x1111111111111111111111111111111111111111", "injected");

    expect(res.ok).toBe(true);
    const signCalls = methodCalls.filter((c) => c.method === "personal_sign");
    expect(signCalls.length).toBe(1);
    const hexMsg = signCalls[0].params?.[0] as string;
    expect(Buffer.from(hexMsg.slice(2), "hex").toString()).toBe("Sign in to Base Terminal");
  });
});
