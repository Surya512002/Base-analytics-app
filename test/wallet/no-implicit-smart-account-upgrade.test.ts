import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  sendAppTransactions,
  prefersWalletSendCalls,
  getProviderCapabilities,
} from "@/lib/utils/send-app-tx";
import type { ContractCall } from "@/lib/utils/tx";

// Mock public client so tests do not make real network calls
vi.mock("@/lib/utils/base-rpc", () => ({
  createPublicOnlyBaseClient: () => ({
    waitForTransactionReceipt: vi.fn(async () => ({ status: "success" })),
    getTransaction: vi.fn(async () => ({ hash: "0xmocked" })),
  }),
  withRpcRetry: (fn: any) => fn(),
}));

describe("No Implicit Smart Account Upgrade (EIP-7702 Guard) Suite", () => {
  const userAddress = "0x1111111111111111111111111111111111111111";
  const tokenAddress = "0x2222222222222222222222222222222222222222";
  const routerAddress = "0x3333333333333333333333333333333333333333";

  // Calls: ERC20 approve + swap action
  const sampleCalls: ContractCall[] = [
    {
      to: tokenAddress,
      data: "0x095ea7b30000000000000000000000003333333333333333333333333333333333333333ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      value: BigInt(0),
    },
    {
      to: routerAddress,
      data: "0x38ed17390000000000000000000000000000000000000000000000000000000000000001",
      value: BigInt(0),
    },
  ];

  function createStubProvider(capabilities: Record<string, unknown>) {
    const recordedCalls: { method: string; params: any }[] = [];
    let txCount = 0;

    const provider = {
      request: vi.fn(async ({ method, params }: { method: string; params: any }) => {
        recordedCalls.push({ method, params });
        if (method === "wallet_getCapabilities") {
          return capabilities;
        }
        if (method === "eth_chainId") {
          return "0x2105"; // Base Mainnet (8453)
        }
        if (method === "eth_accounts") {
          return [userAddress];
        }
        if (method === "eth_requestAccounts") {
          return [userAddress];
        }
        if (method === "wallet_sendCalls") {
          return "0xbatchid1234567890abcdef";
        }
        if (method === "wallet_getCallsStatus") {
          return {
            status: "CONFIRMED",
            receipts: [{ transactionHash: "0x1111111111111111111111111111111111111111111111111111111111111111" }],
          };
        }
        if (method === "eth_sendTransaction") {
          txCount++;
          return `0x${txCount.toString(16).padStart(64, "0")}`;
        }
        return null;
      }),
      recordedCalls,
    };
    return provider;
  }

  it("proves stub provider reports atomicBatch capability status 'ready' or 'supported'", async () => {
    const stub = createStubProvider({
      "0x2105": {
        atomicBatch: {
          supported: true,
          status: "ready",
        },
      },
    });

    const caps = await getProviderCapabilities(stub as any, userAddress);
    expect(caps).toBeDefined();
    expect((caps as any).atomicBatch.supported).toBe(true);
    expect((caps as any).atomicBatch.status).toBe("ready");
  });

  it("ensures injected EOAs (MetaMask) NEVER receive wallet_sendCalls and use sequential eth_sendTransaction", async () => {
    // Stub provider mimicking MetaMask on Base with EIP-5792 atomicBatch support
    const stub = createStubProvider({
      "0x2105": {
        atomicBatch: {
          supported: true,
          status: "ready",
        },
      },
    });

    const hash = await sendAppTransactions("metamask", userAddress, sampleCalls, {
      provider: stub as any,
      atomicBatch: true,
    });

    // 1. Assert wallet_sendCalls was NEVER invoked (prevents EIP-7702 account upgrade prompt)
    const sendCallsInvocations = stub.recordedCalls.filter((c) => c.method === "wallet_sendCalls");
    expect(sendCallsInvocations).toHaveLength(0);

    // 2. Assert sequential eth_sendTransaction was used instead
    const ethSendTxInvocations = stub.recordedCalls.filter((c) => c.method === "eth_sendTransaction");
    expect(ethSendTxInvocations).toHaveLength(2);

    // Call 1 is approve
    expect(ethSendTxInvocations[0].params[0].to.toLowerCase()).toBe(tokenAddress.toLowerCase());
    // Call 2 is swap
    expect(ethSendTxInvocations[1].params[0].to.toLowerCase()).toBe(routerAddress.toLowerCase());

    expect(hash).toMatch(/^0x[0-9a-fA-F]{64}$/);
  });

  it("ensures generic injected EOAs (Rabby, window.ethereum) NEVER receive wallet_sendCalls even with supported capability", async () => {
    const stub = createStubProvider({
      "0x2105": {
        atomicBatch: {
          supported: true,
          status: "supported",
        },
      },
    });

    const hash = await sendAppTransactions("injected", userAddress, sampleCalls, {
      provider: stub as any,
      atomicBatch: true,
    });

    const sendCallsInvocations = stub.recordedCalls.filter((c) => c.method === "wallet_sendCalls");
    expect(sendCallsInvocations).toHaveLength(0);

    const ethSendTxInvocations = stub.recordedCalls.filter((c) => c.method === "eth_sendTransaction");
    expect(ethSendTxInvocations).toHaveLength(2);
  });

  it("allows Coinbase Smart Wallet to keep batching via wallet_sendCalls", async () => {
    const stub = createStubProvider({
      "0x2105": {
        atomicBatch: {
          supported: true,
          status: "ready",
        },
      },
    });

    await sendAppTransactions("coinbase", userAddress, sampleCalls, {
      provider: stub as any,
      atomicBatch: true,
    });

    const sendCallsInvocations = stub.recordedCalls.filter((c) => c.method === "wallet_sendCalls");
    expect(sendCallsInvocations.length).toBeGreaterThanOrEqual(1);

    // Legacy eth_sendTransaction should not have been used
    const ethSendTxInvocations = stub.recordedCalls.filter((c) => c.method === "eth_sendTransaction");
    expect(ethSendTxInvocations).toHaveLength(0);
  });

  it("allows Base Account and Farcaster to keep batching via wallet_sendCalls", async () => {
    for (const smartConn of ["baseAccount", "farcaster"] as const) {
      const stub = createStubProvider({
        "0x2105": {
          atomicBatch: {
            supported: true,
            status: "ready",
          },
        },
      });

      await sendAppTransactions(smartConn, userAddress, sampleCalls, {
        provider: stub as any,
        atomicBatch: true,
      });

      const sendCallsInvocations = stub.recordedCalls.filter((c) => c.method === "wallet_sendCalls");
      expect(sendCallsInvocations.length).toBeGreaterThanOrEqual(1);

      const ethSendTxInvocations = stub.recordedCalls.filter((c) => c.method === "eth_sendTransaction");
      expect(ethSendTxInvocations).toHaveLength(0);
    }
  });

  it("unit-level check: prefersWalletSendCalls returns false for EOAs and true for smart accounts", () => {
    expect(prefersWalletSendCalls("metamask", false)).toBe(false);
    expect(prefersWalletSendCalls("metamask", true)).toBe(false);
    expect(prefersWalletSendCalls("injected", false)).toBe(false);
    expect(prefersWalletSendCalls("injected", true)).toBe(false);

    expect(prefersWalletSendCalls("coinbase", false)).toBe(true);
    expect(prefersWalletSendCalls("baseAccount", false)).toBe(true);
    expect(prefersWalletSendCalls("farcaster", false)).toBe(true);
  });
});