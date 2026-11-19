import { afterEach, describe, expect, it, vi } from "vitest";

const load = async (chain?: string) => {
  vi.resetModules();
  if (chain === undefined) delete process.env.NEXT_PUBLIC_DROPS_CHAIN_ID;
  else process.env.NEXT_PUBLIC_DROPS_CHAIN_ID = chain;
  return {
    net: await import("./network"),
    chain: await import("./chain"),
  };
};

afterEach(() => {
  delete process.env.NEXT_PUBLIC_DROPS_CHAIN_ID;
  vi.resetModules();
});

describe("drops network", () => {
  it("defaults to Base mainnet (production behaviour)", async () => {
    const { net, chain } = await load();
    expect(net.DROPS_CHAIN_ID).toBe(8453);
    expect(net.IS_DROPS_TESTNET).toBe(false);
    expect(net.DROPS_USDC).toBe("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    expect(chain.BASE_CHAIN_ID).toBe(8453);
  });

  it("switches only on exactly 84532, and tickets then sign for Sepolia", async () => {
    expect((await load("1")).net.DROPS_CHAIN_ID).toBe(8453);
    const { net, chain } = await load("84532");
    expect(net.IS_DROPS_TESTNET).toBe(true);
    expect(net.DROPS_USDC).toBe("0x036CbD53842c5426634e7929541eC2318f3dCF7e");
    expect(net.DROPS_EXPLORER).toBe("https://sepolia.basescan.org");
    expect(chain.BASE_CHAIN_ID).toBe(84532);
    const args = {
      contract: "0x1111111111111111111111111111111111111111" as const,
      dropId: BigInt(2_000_000_001),
      claimer: "0x2222222222222222222222222222222222222222" as const,
      claimIndex: 0,
      amount: BigInt(0),
      deadline: BigInt(1),
    };
    // Same inputs, different chain → different digest (a Sepolia ticket can't be replayed on mainnet).
    expect(chain.ticketInnerHash({ ...args, chainId: 84532 })).not.toBe(chain.ticketInnerHash({ ...args, chainId: 8453 }));
  });
});
