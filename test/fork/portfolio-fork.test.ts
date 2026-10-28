import { describe, expect, it } from "vitest";
import { createPublicClient, http, parseAbi, getAddress } from "viem";
import { base } from "viem/chains";
import { getWalletPortfolio } from "@/lib/portfolio/portfolio-service";

const FORK_RPC_URL =
  process.env.BASE_RPC_URL ||
  process.env.ANVIL_RPC_URL ||
  "https://mainnet.base.org";

const ERC20_ABI = parseAbi([
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

describe("Base Mainnet Fork — Real Portfolio Verification (Chain ID 8453)", () => {
  const client = createPublicClient({
    chain: base,
    transport: http(FORK_RPC_URL),
  });

  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
  const NVDAC_STOCK_ADDRESS = "0xb20000000000000000000078ee7ce2fe4908108c" as const;
  const AERO_ADDRESS = "0x940181a94A35A4569E4529A3CDfB74e38FD98631" as const;

  it("verifies Base chain connection and decimals for USDC (6) and NVDAc (8)", async () => {
    const chainId = await client.getChainId();
    expect(chainId).toBe(8453);

    const [usdcDec, nvdacDec] = await Promise.all([
      client.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "decimals",
      }),
      client.readContract({
        address: NVDAC_STOCK_ADDRESS,
        abi: ERC20_ABI,
        functionName: "decimals",
      }),
    ]);

    expect(usdcDec).toBe(6);
    expect(nvdacDec).toBe(8);
  });

  it("scans a funded wallet on Base mainnet and detects ETH and ERC-20 balances accurately", async () => {
    // Platform Treasury on Base with live mainnet balances
    const testAddress = getAddress("0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F");

    const portfolio = await getWalletPortfolio(testAddress, [AERO_ADDRESS], false);

    expect(portfolio.chainId).toBe(8453);
    expect(portfolio.chainName).toBe("Base");
    expect(portfolio.tokens.length).toBeGreaterThanOrEqual(1);

    // Verify token structure
    for (const token of portfolio.tokens) {
      expect(typeof token.balanceFormatted).toBe("string");
      expect(typeof token.balanceNumber).toBe("number");
      expect(token.balanceNumber).toBeGreaterThan(0);
      expect(typeof token.balanceRaw).toBe("string");

      if (token.priceUsd != null) {
        expect(token.priceUsd).toBeGreaterThan(0);
        expect(token.usdValue).toBeGreaterThan(0);
        expect(token.priceSource).not.toBe("none");
      } else {
        expect(token.usdValue).toBe(0);
        expect(token.priceSource).toBe("none");
      }
    }
  });

  it("properly handles unpriced tokens without skewing total USD", async () => {
    // Fresh test wallet with custom unpriced address
    const testAddress = getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
    const unlistedAddress = getAddress("0x0000000000000000000000000000000000000001");

    const portfolio = await getWalletPortfolio(testAddress, [unlistedAddress], false);

    expect(portfolio.chainId).toBe(8453);
    expect(typeof portfolio.totalUsd).toBe("number");
    expect(Number.isFinite(portfolio.totalUsd)).toBe(true);
  });
});
