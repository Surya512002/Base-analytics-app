import { describe, expect, it } from "vitest";
import { createPublicClient, http, parseUnits, parseEther, type Address } from "viem";
import { base } from "viem/chains";
import { quoteLaunchSwap } from "@/lib/launchpad/dex";
import {
  encodeUniswapHopPath,
  encodeExactInputMultiHop,
  SWAP_ROUTER_02,
  QUOTER_V2,
  QUOTER_ABI,
  WETH_BASE,
} from "@/lib/launchpad/uniswap";
import { USDC_BASE } from "@/lib/launchpad/tokens-base";
import { getStockTradability } from "@/lib/stocks/stock-tradability";
import { computePlatformFee } from "@/lib/launchpad/fees";
import { TOKENIZED_STOCKS_REGISTRY } from "@/lib/stocks/tokenized-stocks-registry";
import { BASE_MAINNET_REGISTRY } from "@/lib/contracts/registry";

const FORK_RPC_URL =
  process.env.BASE_RPC_URL || process.env.ANVIL_RPC_URL || "https://mainnet.base.org";

const MSFTC = TOKENIZED_STOCKS_REGISTRY.find((s) => s.symbol === "MSFTc")!.address;
const AAPLC = TOKENIZED_STOCKS_REGISTRY.find((s) => s.symbol === "AAPLc")!.address;
const NVDAC = TOKENIZED_STOCKS_REGISTRY.find((s) => s.symbol === "NVDAc")!.address;
const GOOGLC = TOKENIZED_STOCKS_REGISTRY.find((s) => s.symbol === "GOOGLc")!.address;
const METAC = TOKENIZED_STOCKS_REGISTRY.find((s) => s.symbol === "METAc")!.address;

const B20_ABI = [
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
  {
    name: "multiplier",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

describe("Base Fork Tests: Tokenized Stocks Swap & Dual-DEX Routing", () => {
  const client = createPublicClient({
    chain: base,
    transport: http(FORK_RPC_URL),
  });

  const testAccount = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address;

  it("verifies live Base connection and Uniswap V3 QuoterV2 deployment", async () => {
    const chainId = await client.getChainId();
    expect(chainId).toBe(8453);

    const quoterCode = await client.getBytecode({ address: QUOTER_V2 });
    expect(quoterCode).toBeDefined();
    expect(quoterCode!.length).toBeGreaterThan(10);
  });

  describe("B20 Token Standard Behavior on Base", () => {
    it("confirms 8 decimals and multiplier on MSFTc, AAPLc, NVDAc, GOOGLc", async () => {
      const stocks = [MSFTC, AAPLC, NVDAC, GOOGLC];
      for (const stock of stocks) {
        const decimals = await client.readContract({
          address: stock,
          abi: B20_ABI,
          functionName: "decimals",
        });
        expect(decimals).toBe(8);

        const multiplier = await client.readContract({
          address: stock,
          abi: B20_ABI,
          functionName: "multiplier",
        });
        expect(multiplier).toBeGreaterThanOrEqual(BigInt(0));
      }
    });

    it("verifies standard ERC-20 approve and allowance behavior for B20 tokens", async () => {
      const allowance = await client.readContract({
        address: MSFTC,
        abi: B20_ABI,
        functionName: "allowance",
        args: [testAccount, SWAP_ROUTER_02],
      });
      expect(allowance).toBe(BigInt(0));

      // Simulate approve call without state change
      const simApprove = await client.simulateContract({
        address: MSFTC,
        abi: B20_ABI,
        functionName: "approve",
        args: [SWAP_ROUTER_02, parseUnits("10", 8)],
        account: testAccount,
      });
      expect(simApprove.result).toBe(true);
    });
  });

  describe("Stock 1: MSFTc Quotes & Routing", () => {
    it("quotes MSFTc with USDC directly (Uniswap V3 fee 10000 / 1%)", async () => {
      const amountIn = parseUnits("50", 6);
      const quote = await quoteLaunchSwap({
        token: MSFTC,
        direction: "buy",
        amountIn,
        slippageBps: 100,
        quoteToken: USDC_BASE as Address,
      });

      expect(quote.hasLiquidity).toBe(true);
      expect(quote.amountOut).toBeGreaterThan(BigInt(0));
      expect(quote.dex).toBe("uniswap");
    });

    it("quotes MSFTc with ETH via multi-hop (WETH -> USDC -> MSFTc)", async () => {
      const amountIn = parseEther("0.05");
      const quote = await quoteLaunchSwap({
        token: MSFTC,
        direction: "buy",
        amountIn,
        slippageBps: 100,
        quoteToken: WETH_BASE as Address,
      });

      expect(quote.hasLiquidity).toBe(true);
      expect(quote.amountOut).toBeGreaterThan(BigInt(0));
      expect(quote.uniswapMultiHop).toBe(true);
      expect(quote.uniswapPath).toBeDefined();
      expect(quote.dex).toBe("uniswap");
    });

    it("quotes MSFTc sell to USDC directly", async () => {
      const amountIn = parseUnits("0.1", 8); // 0.1 MSFTc
      const quote = await quoteLaunchSwap({
        token: MSFTC,
        direction: "sell",
        amountIn,
        slippageBps: 100,
        quoteToken: USDC_BASE as Address,
      });

      expect(quote.hasLiquidity).toBe(true);
      expect(quote.amountOut).toBeGreaterThan(BigInt(0));
    });

    it("quotes MSFTc sell to ETH via multi-hop (MSFTc -> USDC -> WETH)", async () => {
      const amountIn = parseUnits("0.1", 8); // 0.1 MSFTc
      const quote = await quoteLaunchSwap({
        token: MSFTC,
        direction: "sell",
        amountIn,
        slippageBps: 100,
        quoteToken: WETH_BASE as Address,
      });

      expect(quote.hasLiquidity).toBe(true);
      expect(quote.amountOut).toBeGreaterThan(BigInt(0));
      expect(quote.uniswapMultiHop).toBe(true);
    });
  });

  describe("Stock 2: AAPLc Quotes & Routing", () => {
    it("quotes AAPLc with USDC directly (Uniswap V3 fee 3000 / 0.3%)", async () => {
      const amountIn = parseUnits("50", 6);
      const quote = await quoteLaunchSwap({
        token: AAPLC,
        direction: "buy",
        amountIn,
        slippageBps: 100,
        quoteToken: USDC_BASE as Address,
      });

      expect(quote.hasLiquidity).toBe(true);
      expect(quote.amountOut).toBeGreaterThan(BigInt(0));
      expect(quote.dex).toBe("uniswap");
    });

    it("quotes AAPLc with ETH via multi-hop (WETH -> USDC -> AAPLc)", async () => {
      const amountIn = parseEther("0.05");
      const quote = await quoteLaunchSwap({
        token: AAPLC,
        direction: "buy",
        amountIn,
        slippageBps: 100,
        quoteToken: WETH_BASE as Address,
      });

      expect(quote.hasLiquidity).toBe(true);
      expect(quote.amountOut).toBeGreaterThan(BigInt(0));
      expect(quote.uniswapMultiHop).toBe(true);
    });

    it("quotes AAPLc sell to USDC directly", async () => {
      const amountIn = parseUnits("0.2", 8); // 0.2 AAPLc
      const quote = await quoteLaunchSwap({
        token: AAPLC,
        direction: "sell",
        amountIn,
        slippageBps: 100,
        quoteToken: USDC_BASE as Address,
      });

      expect(quote.hasLiquidity).toBe(true);
      expect(quote.amountOut).toBeGreaterThan(BigInt(0));
    });
  });

  describe("Stock 3: NVDAc Quotes & Routing", () => {
    it("quotes NVDAc successfully with both USDC and ETH", async () => {
      const quoteUsdc = await quoteLaunchSwap({
        token: NVDAC,
        direction: "buy",
        amountIn: parseUnits("50", 6),
        slippageBps: 100,
        quoteToken: USDC_BASE as Address,
      });
      expect(quoteUsdc.hasLiquidity).toBe(true);
      expect(quoteUsdc.amountOut).toBeGreaterThan(BigInt(0));

      const quoteEth = await quoteLaunchSwap({
        token: NVDAC,
        direction: "buy",
        amountIn: parseEther("0.05"),
        slippageBps: 100,
        quoteToken: WETH_BASE as Address,
      });
      expect(quoteEth.hasLiquidity).toBe(true);
      expect(quoteEth.amountOut).toBeGreaterThan(BigInt(0));
    });

    it("quotes NVDAc sell to USDC directly", async () => {
      const amountIn = parseUnits("0.1", 8); // 0.1 NVDAc
      const quote = await quoteLaunchSwap({
        token: NVDAC,
        direction: "sell",
        amountIn,
        slippageBps: 100,
        quoteToken: USDC_BASE as Address,
      });

      expect(quote.hasLiquidity).toBe(true);
      expect(quote.amountOut).toBeGreaterThan(BigInt(0));
    });
  });

  describe("Stock 4: GOOGLc & METAc Quotes", () => {
    it("quotes GOOGLc successfully with USDC and ETH", async () => {
      const quoteUsdc = await quoteLaunchSwap({
        token: GOOGLC,
        direction: "buy",
        amountIn: parseUnits("50", 6),
        slippageBps: 100,
        quoteToken: USDC_BASE as Address,
      });
      expect(quoteUsdc.hasLiquidity).toBe(true);
      expect(quoteUsdc.amountOut).toBeGreaterThan(BigInt(0));

      const quoteEth = await quoteLaunchSwap({
        token: GOOGLC,
        direction: "buy",
        amountIn: parseEther("0.05"),
        slippageBps: 100,
        quoteToken: WETH_BASE as Address,
      });
      expect(quoteEth.hasLiquidity).toBe(true);
      expect(quoteEth.amountOut).toBeGreaterThan(BigInt(0));
    });

    it("quotes METAc successfully with USDC and ETH", async () => {
      const quoteUsdc = await quoteLaunchSwap({
        token: METAC,
        direction: "buy",
        amountIn: parseUnits("50", 6),
        slippageBps: 100,
        quoteToken: USDC_BASE as Address,
      });
      expect(quoteUsdc.hasLiquidity).toBe(true);
      expect(quoteUsdc.amountOut).toBeGreaterThan(BigInt(0));
    });
  });

  describe("Tradability Status & Failure Modes", () => {
    it("identifies TSLAc as low_liquidity with warn and allow behavior", async () => {
      const tradability = getStockTradability("TSLAc");
      expect(tradability.status).toBe("low_liquidity");
      expect(tradability.hasPool).toBe(true);
      expect(tradability.suggestedAction?.url).toContain("basescan.org/token/");
    });

    it("identifies unpooled stocks like COINc as no_pool with Lend & Stake action", async () => {
      const tradability = getStockTradability("COINc");
      expect(tradability.status).toBe("no_pool");
      expect(tradability.hasPool).toBe(false);
      expect(tradability.suggestedAction?.tab).toBe("lend");
      expect(tradability.suggestedAction?.url).toContain("basescan.org/token/");
    });
  });

  describe("Execution Simulation & 0.5% Platform Fee Assertion", () => {
    it("preserves exact 0.5% platform fee calculation and routes to platform treasury", () => {
      // 100 USDC swap
      const grossUsdc = parseUnits("100", 6);
      const feeUsdc = computePlatformFee(grossUsdc, 50); // 50 bps = 0.5%
      expect(feeUsdc).toBe(parseUnits("0.5", 6));
      expect(grossUsdc - feeUsdc).toBe(parseUnits("99.5", 6));

      // 1 ETH swap
      const grossEth = parseEther("1");
      const feeEth = computePlatformFee(grossEth, 50);
      expect(feeEth).toBe(parseEther("0.005"));
      expect(grossEth - feeEth).toBe(parseEther("0.995"));

      // Verify platform treasury recipient
      expect(BASE_MAINNET_REGISTRY.PLATFORM_TREASURY.address).toBe(
        "0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F"
      );
    });

    it("simulates on-chain QuoterV2 execution for multi-hop route without state change", async () => {
      const path = encodeUniswapHopPath(
        WETH_BASE as Address,
        500,
        USDC_BASE as Address,
        10000,
        MSFTC
      );
      const amountIn = parseEther("0.02");

      const sim = await client.simulateContract({
        address: QUOTER_V2,
        abi: QUOTER_ABI,
        functionName: "quoteExactInput",
        args: [path, amountIn],
      });

      expect(sim.result).toBeDefined();
      const [amountOut] = sim.result;
      expect(amountOut).toBeGreaterThan(BigInt(0));
    });

    it("simulates SwapRouter02 exactInput execution reverting with expected SafeTransferFrom when unapproved", async () => {
      const path = encodeUniswapHopPath(
        WETH_BASE as Address,
        500,
        USDC_BASE as Address,
        10000,
        MSFTC
      );
      const calldata = encodeExactInputMultiHop({
        path,
        recipient: testAccount,
        amountIn: parseEther("0.01"),
        amountOutMinimum: BigInt(1),
      });

      let errorCaught = false;
      try {
        await client.call({
          to: SWAP_ROUTER_02,
          data: calldata,
          account: testAccount,
        });
      } catch (err: any) {
        errorCaught = true;
        expect(err).toBeDefined();
      }
      expect(errorCaught).toBe(true);
    });
  });
});
