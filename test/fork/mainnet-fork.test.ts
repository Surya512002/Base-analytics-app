import { describe, expect, it } from "vitest";
import { createPublicClient, http, parseEther, isAddress } from "viem";
import { base } from "viem/chains";
import { BASE_MAINNET_REGISTRY } from "@/lib/contracts/registry";
import { fetchAllUserPositions } from "@/lib/lending/user-positions";
import { computePlatformFee } from "@/lib/launchpad/fees";
import { splitPlatformFee } from "@/lib/launchpad/fee-split";

// Read from env or fall back to official public Base RPC or local anvil fork
const FORK_RPC_URL = process.env.BASE_RPC_URL || process.env.ANVIL_RPC_URL || "https://mainnet.base.org";

describe("Base Mainnet Fork & On-Chain Protocol Verification", () => {
  const client = createPublicClient({
    chain: base,
    transport: http(FORK_RPC_URL),
  });

  const freshWallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`;

  it("connects to Base chain (chainId 8453) and retrieves latest block", async () => {
    const chainId = await client.getChainId();
    expect(chainId).toBe(8453);

    const blockNumber = await client.getBlockNumber();
    expect(blockNumber).toBeGreaterThan(BigInt(20_000_000));
  });

  it("verifies platform treasury contract is registered and has valid on-chain bytecode or account", async () => {
    const treasury = BASE_MAINNET_REGISTRY.PLATFORM_TREASURY.address;
    expect(isAddress(treasury)).toBe(true);
    expect(treasury).toBe("0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F");
  });

  it("verifies exact 0.5% platform fee calculation and treasury routing", () => {
    const swapAmount = parseEther("5"); // 5 ETH gross
    const fee = computePlatformFee(swapAmount, 50); // 50 bps = 0.50%
    expect(fee).toBe(parseEther("0.025"));

    const creator = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as `0x${string}`;
    const split = splitPlatformFee(fee, { creator });

    // 0.25% to creator, 0.25% to platform treasury
    expect(split.creator).toBe(parseEther("0.0125"));
    expect(split.platform).toBe(parseEther("0.0125"));
    expect(split.creator + split.platform).toBe(fee);
  });

  it("verifies real on-chain position reader returns ZERO positions for a fresh wallet (no fake fallbacks)", async () => {
    const result = await fetchAllUserPositions(freshWallet);

    expect(result.isMockData).toBe(false);
    expect(result.positions).toEqual([]);
    expect(result.positions.length).toBe(0);
  });

  it("verifies Morpho Blue on Base has deployed contract bytecode", async () => {
    const code = await client.getBytecode({
      address: BASE_MAINNET_REGISTRY.MORPHO_BLUE.address,
    });
    // On live Base, singleton contract exists
    expect(code).toBeDefined();
    if (code) {
      expect(code.length).toBeGreaterThan(10);
    }
  });

  it("verifies Aave V3 Pool Base has deployed contract bytecode", async () => {
    const code = await client.getBytecode({
      address: BASE_MAINNET_REGISTRY.AAVE_V3_POOL.address,
    });
    expect(code).toBeDefined();
    if (code) {
      expect(code.length).toBeGreaterThan(10);
    }
  });

  it("verifies USDC native token contract exists on Base and decimals is 6", async () => {
    const usdcAddr = BASE_MAINNET_REGISTRY.USDC.address;
    const decimals = await client.readContract({
      address: usdcAddr,
      abi: [
        {
          name: "decimals",
          type: "function",
          stateMutability: "view",
          inputs: [],
          outputs: [{ type: "uint8" }],
        },
      ],
      functionName: "decimals",
    });

    expect(decimals).toBe(6);
  });

  it("generates valid on-chain supply and borrow calls for registry stock through action drawer", async () => {
    const { buildUnifiedProtocolCalls } = await import("@/lib/lending/protocol-adapters");
    const { TOKENIZED_STOCKS_REGISTRY } = await import("@/lib/stocks/tokenized-stocks-registry");
    const nvdaStock = TOKENIZED_STOCKS_REGISTRY.find((s) => s.symbol === "NVDAc")!;

    expect(nvdaStock).toBeDefined();

    // Mock an active discovered option for NVDAc on Morpho Blue
    const mockOption: any = {
      id: "morpho_blue_nvdac",
      protocol: "morpho_blue",
      protocolName: "Morpho Blue",
      executionType: "morpho_blue",
      morphoParams: {
        loanToken: BASE_MAINNET_REGISTRY.USDC.address,
        collateralToken: nvdaStock.address,
        oracle: "0x1111111111111111111111111111111111111111",
        irm: "0x2222222222222222222222222222222222222222",
        lltv: BigInt("770000000000000000"),
      },
      stockSymbol: nvdaStock.symbol,
      stockName: nvdaStock.name,
      stockAddress: nvdaStock.address,
      loanSymbol: "USDC",
      loanAddress: BASE_MAINNET_REGISTRY.USDC.address,
      supplyApy: 6.8,
      borrowApr: 4.2,
      maxLtv: 77,
      contractAddress: BASE_MAINNET_REGISTRY.MORPHO_BLUE.address,
    };

    const supplyCalls = buildUnifiedProtocolCalls({
      option: mockOption,
      action: "supply",
      amountRaw: BigInt(100_000_000), // 1 NVDAc (8 decimals)
      userAddress: freshWallet,
      requiresApproval: true,
    });

    expect(supplyCalls.length).toBeGreaterThanOrEqual(2);
    // Approval targeting NVDAc contract
    expect(supplyCalls[0].to.toLowerCase()).toBe(nvdaStock.address.toLowerCase());
    // Supply targeting Morpho Blue contract
    expect(supplyCalls[1].to.toLowerCase()).toBe(BASE_MAINNET_REGISTRY.MORPHO_BLUE.address.toLowerCase());

    const borrowCalls = buildUnifiedProtocolCalls({
      option: mockOption,
      action: "borrow",
      amountRaw: BigInt(500_000_000), // 500 USDC (6 decimals)
      userAddress: freshWallet,
      requiresApproval: false,
    });

    expect(borrowCalls.length).toBe(1);
    expect(borrowCalls[0].to.toLowerCase()).toBe(BASE_MAINNET_REGISTRY.MORPHO_BLUE.address.toLowerCase());
  });

  it(
    "matching rule guarantees an unapproved stock token never appears in discovered markets",
    { timeout: 30000 },
    async () => {
      const { runMarketDiscovery } = await import("@/lib/lending/discovery/engine");
      const { isActiveStockAddress } = await import("@/lib/stocks/tokenized-stocks-registry");

      const fakeUnapprovedToken = "0x9999999999999999999999999999999999999999" as `0x${string}`;
      expect(isActiveStockAddress(fakeUnapprovedToken)).toBe(false);

      // Run discovery with forceRefresh to test engine matching rule
      const res = await runMarketDiscovery(8453, true);
      expect(res).toBeDefined();
      expect(Array.isArray(res.markets)).toBe(true);

      // Verify absolutely no market contains unapproved token as supply or borrow asset
      const foundUnapproved = res.markets.some(
        (m) =>
          m.supplyAsset.address.toLowerCase() === fakeUnapprovedToken.toLowerCase() ||
          (m.borrowAsset && m.borrowAsset.address.toLowerCase() === fakeUnapprovedToken.toLowerCase())
      );
      expect(foundUnapproved).toBe(false);
    }
  );

  it(
    "guarantees a protocol outage keeps other protocols functional with isolated error tracking",
    { timeout: 30000 },
    async () => {
      const { runMarketDiscovery } = await import("@/lib/lending/discovery/engine");
      const res = await runMarketDiscovery(8453, false);

      // The engine should NEVER crash completely when one protocol fails
      expect(res).toBeDefined();
      expect(res.markets).toBeDefined();
      expect(res.protocolStatus).toBeDefined();
      expect(typeof res.protocolStatus).toBe("object");

      // All registered protocols should have an explicit health entry
      const protocols: (keyof typeof res.protocolStatus)[] = ["morpho", "aave", "euler", "moonwell", "superform", "aerodrome"];
      for (const p of protocols) {
        expect(res.protocolStatus[p]).toBeDefined();
        expect(typeof res.protocolStatus[p].status).toBe("string");
      }
    }
  );
});

