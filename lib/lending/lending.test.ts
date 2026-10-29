import { describe, expect, it } from "vitest";
import {
  LAUNCHPAD_PLATFORM_FEE_BPS,
  formatPlatformFeeLabel,
} from "@/lib/constants/launchpad";
import {
  splitPlatformFee,
  splitGrossAmount,
  computePlatformFee,
  FEE_SHARE_CREATOR_BPS,
  FEE_SHARE_PLATFORM_BPS,
  FEE_SHARE_REFERRER_BPS,
} from "@/lib/launchpad/fees";
import {
  buildAttributedVaultDepositCall,
  buildAttributedGaugeDepositCall,
  buildAttributedMoonwellMintCall,
  buildAttributedAaveSupplyCall,
  buildAttributedMorphoSupplyCollateralCall,
  buildAttributedApproveCall,
} from "./builder-attribution";
import { hasBuilderSuffix } from "@/lib/utils/tx";
import { BASE_LENDING_MARKETS, filterMarkets } from "./markets";
import { getBaseStockBySymbol, isBaseStockAddress } from "@/lib/stocks/base-stocks";
import { parseUnits } from "viem";

describe("Platform Fee & 50/50 Split (0.5% total, 0.25% creator, 0.25% platform)", () => {
  it("platform fee defaults to 50 bps (0.5%)", () => {
    expect(LAUNCHPAD_PLATFORM_FEE_BPS).toBe(50);
    expect(formatPlatformFeeLabel()).toBe("0.5%");
  });

  it("fee split allocates 50% to creator and 50% to platform with 0% referral", () => {
    expect(FEE_SHARE_CREATOR_BPS).toBe(5000);
    expect(FEE_SHARE_PLATFORM_BPS).toBe(5000);
    expect(FEE_SHARE_REFERRER_BPS).toBe(0);

    const gross = parseUnits("100", 18); // 100 ETH trade
    const fee = computePlatformFee(gross, 50); // 0.5 ETH fee (0.5%)
    expect(fee).toBe(parseUnits("0.5", 18));

    const creator = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const referrer = "0x2222222222222222222222222222222222222222" as `0x${string}`;
    const split = splitPlatformFee(fee, { creator, referrer });

    // 0.25 ETH to creator (0.25% of gross trade)
    expect(split.creator).toBe(parseUnits("0.25", 18));
    // 0.25 ETH to platform (0.25% of gross trade)
    expect(split.platform).toBe(parseUnits("0.25", 18));
    // 0 ETH to referrer (referrals removed)
    expect(split.referrer).toBe(BigInt(0));
  });
});

describe("Base Builder Code Attribution on Lending, Borrowing & Staking", () => {
  const dummyUser = "0x3333333333333333333333333333333333333333" as `0x${string}`;
  const dummyVault = "0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A" as `0x${string}`;
  const dummyToken = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;

  it("MetaMorpho vault deposit carries Base builder suffix", () => {
    const call = buildAttributedVaultDepositCall(dummyVault, parseUnits("100", 6), dummyUser);
    expect(hasBuilderSuffix(call.data)).toBe(true);
    expect(call.to.toLowerCase()).toBe(dummyVault.toLowerCase());
  });

  it("Aerodrome gauge deposit carries Base builder suffix", () => {
    const gauge = "0x0f7015a99920364d9c490a6f44d18fa9db95c65a" as `0x${string}`;
    const call = buildAttributedGaugeDepositCall(gauge, parseUnits("50", 18));
    expect(hasBuilderSuffix(call.data)).toBe(true);
    expect(call.to.toLowerCase()).toBe(gauge.toLowerCase());
  });

  it("Moonwell mint call carries Base builder suffix", () => {
    const mToken = "0xeDc817A28E8B93Ca689afb215a5552c41326118B" as `0x${string}`;
    const call = buildAttributedMoonwellMintCall(mToken, parseUnits("200", 6));
    expect(hasBuilderSuffix(call.data)).toBe(true);
    expect(call.to.toLowerCase()).toBe(mToken.toLowerCase());
  });

  it("Aave v3 supply call carries Base builder suffix", () => {
    const call = buildAttributedAaveSupplyCall(dummyToken, parseUnits("300", 6), dummyUser);
    expect(hasBuilderSuffix(call.data)).toBe(true);
  });

  it("Morpho Blue supplyCollateral carries Base builder suffix", () => {
    const params = {
      loanToken: dummyToken,
      collateralToken: "0xb20000000000000000000078ee7ce2fe4908108c" as `0x${string}`, // NVDAc
      oracle: "0x04689a41629776563E6822F76f2e57D148d28513" as `0x${string}`,
      irm: "0x46415998764C29aB2a25CbeA6254146D50D22687" as `0x${string}`,
      lltv: BigInt("770000000000000000"), // 77%
    };
    const call = buildAttributedMorphoSupplyCollateralCall(params, parseUnits("5", 8), dummyUser);
    expect(hasBuilderSuffix(call.data)).toBe(true);
  });

  it("ERC-20 approvals carry Base builder suffix", () => {
    const call = buildAttributedApproveCall(dummyToken, dummyVault, parseUnits("1000", 6));
    expect(hasBuilderSuffix(call.data)).toBe(true);
  });
});

describe("Tokenized Stocks Registry & Base Markets", () => {
  it("NVDAc, AAPLc, TSLAc, COINc are registered B20 tokenized stocks", () => {
    const nvda = getBaseStockBySymbol("NVDAc");
    expect(nvda).toBeDefined();
    expect(nvda?.name).toContain("NVIDIA");
    expect(nvda?.decimals).toBe(8);
    expect(isBaseStockAddress(nvda!.address)).toBe(true);

    const tsla = getBaseStockBySymbol("TSLAc");
    expect(tsla).toBeDefined();
    expect(tsla?.name).toContain("Tesla");

    const aapl = getBaseStockBySymbol("AAPLc");
    expect(aapl).toBeDefined();
    expect(aapl?.name).toContain("Apple");

    const coin = getBaseStockBySymbol("COINc");
    expect(coin).toBeDefined();
    expect(coin?.name).toContain("Coinbase");
  });

  it("Lending markets include tokenized stock auto-compounding and DEX liquidity pools", () => {
    const stockMarkets = filterMarkets({ onlyStocks: true });
    expect(stockMarkets.length).toBeGreaterThanOrEqual(5);

    const nvdaLend = stockMarkets.find((m) => m.id === "stock-lend-nvda");
    expect(nvdaLend).toBeDefined();
    expect(nvdaLend?.protocol).toBe("beefy");
    expect(nvdaLend?.supplyApy).toBeGreaterThan(5);

    const msftVault = stockMarkets.find((m) => m.id === "beefy-msftc-usdc");
    expect(msftVault).toBeDefined();
    expect(msftVault?.contractAddress).toBe("0x8061731243c1aeFCD50fDD4f69A7618Cdfb3EdD5");
  });
});

describe("Unified Stock Lending Comparison Matrix", () => {
  it("generates side-by-side comparison for NVDAc with verified Base protocols", async () => {
    const { getUnifiedStockLendingComparison } = await import("./unified-comparison");
    const comparison = await getUnifiedStockLendingComparison("NVDAc");

    expect(comparison.stockSymbol).toBe("NVDAc");
    expect(comparison.options.length).toBeGreaterThanOrEqual(2);

    const protocols = comparison.options.map((o) => o.protocol);
    expect(protocols).toContain("beefy");
    expect(protocols).toContain("aerodrome");

    // Validates that every option has a valid onchain contract address on Base
    for (const opt of comparison.options) {
      expect(opt.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    }

    // Validates best options highlighting
    expect(comparison.bestSupplyOption).toBeDefined();
    expect(comparison.bestBorrowOption).toBeDefined();
    expect(comparison.highestLiquidityOption).toBeDefined();
    expect(comparison.lowestRiskOption).toBeDefined();
    expect(comparison.lowestRiskOption?.riskLevel).toBe("low");
  });

  it("builds 1-click execution calls with approval and builder attribution", async () => {
    const { getUnifiedStockLendingComparison } = await import("./unified-comparison");
    const { buildUnifiedProtocolCalls } = await import("./protocol-adapters");
    const comparison = await getUnifiedStockLendingComparison("NVDAc");
    const beefyOpt = comparison.options.find((o) => o.protocol === "beefy")!;

    const calls = buildUnifiedProtocolCalls({
      option: beefyOpt,
      action: "supply",
      amountRaw: BigInt("100000000"), // 1 NVDAc (8 decimals)
      userAddress: "0x3333333333333333333333333333333333333333",
      requiresApproval: true,
    });

    // Approval + Supply/Deposit = 2 calls
    expect(calls.length).toBe(2);
    expect(hasBuilderSuffix(calls[0].data)).toBe(false);
    expect(hasBuilderSuffix(calls[1].data)).toBe(true);
  });

  it("builds correct action calls across Beefy and Aerodrome live venues", async () => {
    const { getUnifiedStockLendingComparison } = await import("./unified-comparison");
    const { buildUnifiedProtocolCalls } = await import("./protocol-adapters");
    const comparison = await getUnifiedStockLendingComparison("NVDAc");
    const dummyUser = "0x3333333333333333333333333333333333333333" as const;

    // 1. Beefy Finance Vault Deposit & Withdraw
    const beefyOpt = comparison.options.find((o) => o.protocol === "beefy")!;
    const beefyDepositCalls = buildUnifiedProtocolCalls({
      option: beefyOpt,
      action: "supply",
      amountRaw: BigInt("100000000"),
      userAddress: dummyUser,
    });
    expect(beefyDepositCalls.length).toBe(2); // approve + deposit

    const beefyWithdrawCalls = buildUnifiedProtocolCalls({
      option: beefyOpt,
      action: "withdraw",
      amountRaw: BigInt("100000000"),
      userAddress: dummyUser,
    });
    expect(beefyWithdrawCalls.length).toBe(1); // withdraw only

    // 2. Aerodrome Finance Strategy Deposit
    const aeroOpt = comparison.options.find((o) => o.protocol === "aerodrome")!;
    const aeroDepositCalls = buildUnifiedProtocolCalls({
      option: aeroOpt,
      action: "strategy_deposit",
      amountRaw: BigInt("100000000"),
      userAddress: dummyUser,
    });
    expect(aeroDepositCalls.length).toBe(2); // approve + deposit
  });

  it("o1 Trading API produces price improvement quote over benchmark", async () => {
    const { fetchO1TradingQuote } = await import("@/lib/trading/o1-api");
    const benchmarkOut = BigInt("1000000000"); // 1000 USDC
    const quote = await fetchO1TradingQuote(
      {
        sellToken: "0x4200000000000000000000000000000000000006",
        buyToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        sellAmount: BigInt("1000000000000000000"),
        slippageBps: 50,
      },
      benchmarkOut
    );

    expect(quote).not.toBeNull();
    expect(quote!.hasLiquidity).toBe(true);
    expect(quote!.amountOut).toBeGreaterThan(benchmarkOut);
    expect(quote!.priceImprovementBps).toBeGreaterThan(0);
  });

  it("calculates real-time user stock portfolio summary with LTV and health factor", async () => {
    const { fetchUserStockPortfolioSummary } = await import("./unified-comparison");
    const summary = await fetchUserStockPortfolioSummary("0x3333333333333333333333333333333333333333");

    expect(summary).toBeDefined();
    expect(summary.totalStockHoldingsUsd ?? summary.stockHoldingUsd).toBeGreaterThan(0);
    expect(summary.totalStockDebtUsd ?? summary.totalBorrowedUsd).toBeGreaterThan(0);
    expect(summary.healthFactor).toBeGreaterThan(1.0);
    expect((summary.positions?.length ?? 1)).toBeGreaterThan(0);
  });
});

describe("Coinbase Tokenized Stocks Discovery & Pagination", () => {
  it("fetches tokenized stocks with page_token pagination and liquidity health", async () => {
    const { fetchCoinbaseTokenizedStocks } = await import("@/lib/stocks/coinbase-api");
    const page1 = await fetchCoinbaseTokenizedStocks({ page_token: undefined });

    expect(page1.stocks.length).toBeGreaterThanOrEqual(4);
    expect(page1.has_more).toBe(true);
    expect(page1.next_page_token).toBeDefined();

    const sample = page1.stocks[0];
    expect(sample.symbol).toBeDefined();
    expect(sample.nav).toBeGreaterThan(0);
    expect(sample.multiplier).toBe(1);
    expect(["deep", "moderate", "low", "paused"]).toContain(sample.liquidityHealth);

    // Fetch page 2 using page_token
    const page2 = await fetchCoinbaseTokenizedStocks({ page_token: page1.next_page_token });
    expect(page2.stocks.length).toBeGreaterThanOrEqual(1);
    expect(page2.stocks[0].symbol).not.toBe(page1.stocks[0].symbol);
  });
});

describe("Stocks & Yield-Bearing Vault Shares in Vouchers", () => {
  it("supports tokenized stocks and Morpho/SuperStocks vault shares in BaseVouchers", async () => {
    const {
      isVaultShareAsset,
      isStockAsset,
      getVaultShareBySymbol,
      formatVoucherAmount,
      assetToToken,
      tokenToAsset,
    } = await import("@/lib/utils/voucher");

    // Vault share detection
    expect(isVaultShareAsset("bvMSFTc")).toBe(true);
    expect(isVaultShareAsset("bvTSLAc")).toBe(true);
    expect(isVaultShareAsset("ETH")).toBe(false);

    // Stock detection
    expect(isStockAsset("NVDAc")).toBe(true);
    expect(isStockAsset("USDC")).toBe(false);

    // Metadata resolution
    const vault = getVaultShareBySymbol("bvMSFTc");
    expect(vault).toBeDefined();
    expect(vault?.apy).toBeGreaterThan(5);
    expect(vault?.underlyingSymbol).toBe("MSFTc");

    // Formatting with compounding yield badge (5 NVDAc shares = 500_000_000 raw)
    const formatted = formatVoucherAmount("bvMSFTc", BigInt("5000000000000000000"));
    expect(formatted).toContain("5 bvMSFTc");
    expect(formatted).toContain("APY");

    // Asset to token and token to asset two-way mapping
    const tokenAddr = assetToToken("bvMSFTc");
    expect(tokenAddr).toBe(vault?.address);
    expect(tokenToAsset(tokenAddr)).toBe("bvMSFTc");
  });
});


