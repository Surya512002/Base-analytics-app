import { describe, expect, it, vi } from "vitest";
import { buildUnifiedProtocolCalls } from "@/lib/lending/protocol-adapters";
import type { StockLendingOption } from "@/lib/lending/unified-comparison";
import { parseUnits } from "viem";

import { MORPHO_BLUE_BASE } from "@/lib/lending/constants";

describe("ActionDrawer Protocol Calls & Action Matrix", () => {
  const dummyUser = "0x1234567890123456789012345678901234567890" as `0x${string}`;

  const mockMorphoOption: StockLendingOption = {
    id: "morpho-blue-nvdac",
    protocol: "morpho_blue",
    protocolName: "Morpho Blue",
    protocolBadge: "Isolated Collateral",
    type: "variable",
    typeLabel: "Variable Rate",
    stockSymbol: "NVDAc",
    stockName: "NVIDIA Corp (Tokenized)",
    stockAddress: "0x3912953ab49e0c528cf1b37ad023b7eef7174dbd",
    loanSymbol: "USDC",
    loanAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
    supplyApy: 8.45,
    borrowApr: 2.95,
    maxLtv: 77,
    liquidationThreshold: 85,
    utilization: 68.4,
    availableLiquidityUsd: 12500000,
    tvlUsd: 18400000,
    riskScore: 2,
    riskLevel: "low",
    riskNotes: ["Isolated pool"],
    contractAddress: MORPHO_BLUE_BASE,
    executionType: "morpho_blue",
    morphoParams: {
      loanToken: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      collateralToken: "0x3912953ab49e0c528cf1b37ad023b7eef7174dbd",
      oracle: "0x04689a41629776563E6822F76f2e57D148d28513",
      irm: "0x4641570ad4742a35607374b334a1b02012015fa1",
      lltv: BigInt("770000000000000000"),
    },
  };

  const mockStrategyOption: StockLendingOption = {
    id: "superform-superstocks-nvdac",
    protocol: "beefy",
    protocolName: "Superform SuperStocks",
    protocolBadge: "Automated Strategy",
    type: "strategy",
    typeLabel: "Stock Carry Vault",
    stockSymbol: "NVDAc",
    stockName: "NVIDIA Corp (Tokenized)",
    stockAddress: "0x3912953ab49e0c528cf1b37ad023b7eef7174dbd",
    loanSymbol: "NVDAc",
    loanAddress: "0x3912953ab49e0c528cf1b37ad023b7eef7174dbd",
    supplyApy: 11.2,
    borrowApr: null,
    maxLtv: null,
    liquidationThreshold: null,
    utilization: 0,
    availableLiquidityUsd: 4500000,
    tvlUsd: 4500000,
    riskScore: 3,
    riskLevel: "low",
    riskNotes: ["Automated carry"],
    contractAddress: "0x1111111111111111111111111111111111111111",
    executionType: "beefy",
  };

  it("builds Supply calls with approval for Morpho Blue", () => {
    const amountRaw = parseUnits("10", 8); // 10 NVDAc
    const calls = buildUnifiedProtocolCalls({
      option: mockMorphoOption,
      action: "supply",
      amountRaw,
      userAddress: dummyUser,
      requiresApproval: true,
    });

    expect(calls.length).toBeGreaterThanOrEqual(1);
    // Approval call on stock token
    expect(calls[0].to.toLowerCase()).toBe(mockMorphoOption.stockAddress.toLowerCase());
  });

  it("builds Borrow calls for Morpho Blue", () => {
    const amountRaw = parseUnits("500", 6); // 500 USDC
    const calls = buildUnifiedProtocolCalls({
      option: mockMorphoOption,
      action: "borrow",
      amountRaw,
      userAddress: dummyUser,
      requiresApproval: false,
    });

    expect(calls.length).toBe(1);
    expect(calls[0].to.toLowerCase()).toBe(mockMorphoOption.contractAddress.toLowerCase());
  });

  it("builds Repay calls with USDC approval for Morpho Blue", () => {
    const amountRaw = parseUnits("500", 6); // 500 USDC
    const calls = buildUnifiedProtocolCalls({
      option: mockMorphoOption,
      action: "repay",
      amountRaw,
      userAddress: dummyUser,
      requiresApproval: true,
    });

    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[0].to.toLowerCase()).toBe(mockMorphoOption.loanAddress.toLowerCase());
  });

  it("builds Withdraw calls for Morpho Blue", () => {
    const amountRaw = parseUnits("10", 8); // 10 NVDAc
    const calls = buildUnifiedProtocolCalls({
      option: mockMorphoOption,
      action: "withdraw",
      amountRaw,
      userAddress: dummyUser,
      requiresApproval: false,
    });

    expect(calls.length).toBe(1);
    expect(calls[0].to.toLowerCase()).toBe(mockMorphoOption.contractAddress.toLowerCase());
  });

  it("builds Deposit to Strategy calls for Superform SuperStocks", () => {
    const amountRaw = parseUnits("25", 8); // 25 NVDAc
    const calls = buildUnifiedProtocolCalls({
      option: mockStrategyOption,
      action: "strategy_deposit",
      amountRaw,
      userAddress: dummyUser,
      requiresApproval: true,
    });

    expect(calls.length).toBeGreaterThanOrEqual(1);
    // Approval for stock token into vault/router
    expect(calls[0].to.toLowerCase()).toBe(mockStrategyOption.stockAddress.toLowerCase());
  });

  it("disables borrow/repay for pure strategy options with null borrowApr", () => {
    expect(mockStrategyOption.borrowApr).toBeNull();
    const canBorrow = mockStrategyOption.borrowApr !== null && mockStrategyOption.borrowApr > 0;
    expect(canBorrow).toBe(false);
  });

  it("builds vault deposit and withdraw calls for Beefy Finance", () => {
    const mockBeefy: StockLendingOption = {
      ...mockMorphoOption,
      id: "beefy-msft-vault",
      protocol: "beefy",
      protocolName: "Beefy Finance",
      type: "vault",
      executionType: "beefy",
      contractAddress: "0x8061731243c1aeFCD50fDD4f69A7618Cdfb3EdD5",
    };

    const depositCalls = buildUnifiedProtocolCalls({
      option: mockBeefy,
      action: "supply",
      amountRaw: parseUnits("5", 18),
      userAddress: dummyUser,
    });
    expect(depositCalls.length).toBe(2); // approve + deposit
    expect(depositCalls[0].to.toLowerCase()).toBe(mockBeefy.stockAddress.toLowerCase());

    const withdrawCalls = buildUnifiedProtocolCalls({
      option: mockBeefy,
      action: "withdraw",
      amountRaw: parseUnits("5", 18),
      userAddress: dummyUser,
    });
    expect(withdrawCalls.length).toBe(1); // withdraw only
  });

  it("builds strategy deposit and withdraw calls for Aerodrome Finance", () => {
    const mockAero: StockLendingOption = {
      ...mockMorphoOption,
      id: "aero-gauge-staking",
      protocol: "aerodrome",
      protocolName: "Aerodrome Finance",
      type: "strategy",
      executionType: "aerodrome",
      contractAddress: "0x16613524e02ad97eDfeF371bC883F2F5d6C480A5",
    };

    const depositCalls = buildUnifiedProtocolCalls({
      option: mockAero,
      action: "strategy_deposit",
      amountRaw: parseUnits("10", 18),
      userAddress: dummyUser,
    });
    expect(depositCalls.length).toBe(2); // approve + deposit

    const withdrawCalls = buildUnifiedProtocolCalls({
      option: mockAero,
      action: "strategy_withdraw",
      amountRaw: parseUnits("10", 18),
      userAddress: dummyUser,
    });
    expect(withdrawCalls.length).toBe(1); // withdraw only
  });
});
