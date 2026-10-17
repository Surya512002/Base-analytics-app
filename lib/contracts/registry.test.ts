import { describe, expect, it } from "vitest";
import { getAddress, isAddress } from "viem";
import { BASE_MAINNET_REGISTRY, getRegisteredAddress } from "./registry";
import { BASE_STOCKS } from "@/lib/stocks/base-stocks";
import { COMMON_BASE_TOKENS } from "@/lib/launchpad/common-tokens";
import {
  BOOSTER_CONTRACT,
  GM_GN_CONTRACT,
  ACHIEVEMENTS_CONTRACT,
  CHECKIN_CONTRACT,
  ENTRYPOINT_V06,
  ENTRYPOINT_V07,
  BASE_BRIDGE,
  USDC_BASE,
} from "@/lib/constants/contracts";
import {
  MORPHO_BLUE_BASE,
  MOONWELL_COMPTROLLER_BASE,
  MOONWELL_MUSDC_BASE,
  MOONWELL_MWETH_BASE,
  MOONWELL_MCBBTC_BASE,
  AAVE_V3_POOL_BASE,
  AERODROME_ROUTER_BASE,
  AERO_TOKEN_BASE,
  USDC_BASE_ADDRESS,
  WETH_BASE_ADDRESS,
  CBBTC_BASE_ADDRESS,
} from "@/lib/lending/constants";

describe("Master Contract Address Registry Audit (Base Mainnet)", () => {
  it("verifies every entry in the master registry is valid, checksummed, and has documentation", () => {
    const entries = Object.entries(BASE_MAINNET_REGISTRY);
    expect(entries.length).toBeGreaterThan(15);

    for (const [key, entry] of entries) {
      expect(isAddress(entry.address)).toBe(true);
      // Fails if not properly EIP-55 checksummed
      expect(entry.address).toBe(getAddress(entry.address));
      expect(entry.name).toBeTruthy();
      expect(entry.officialDocsUrl).toMatch(/^https?:\/\//);
      expect(entry.verifiedOnBasescan).toBe(true);
      expect(entry.matchesDocs).toBe(true);
    }
  });

  it("verifies all core app contracts are in registry and properly checksummed", () => {
    const coreAddrs = [
      BOOSTER_CONTRACT,
      GM_GN_CONTRACT,
      ACHIEVEMENTS_CONTRACT,
      CHECKIN_CONTRACT,
      ENTRYPOINT_V06,
      ENTRYPOINT_V07,
      BASE_BRIDGE,
      USDC_BASE,
    ];

    for (const addr of coreAddrs) {
      expect(isAddress(addr)).toBe(true);
      expect(addr).toBe(getAddress(addr));
      const registered = Object.values(BASE_MAINNET_REGISTRY).some(
        (e) => e.address.toLowerCase() === addr.toLowerCase()
      );
      expect(registered).toBe(true);
    }
  });

  it("verifies all lending and DeFi protocol contracts are in registry and properly checksummed", () => {
    const protocolAddrs = [
      MORPHO_BLUE_BASE,
      MOONWELL_COMPTROLLER_BASE,
      MOONWELL_MUSDC_BASE,
      MOONWELL_MWETH_BASE,
      MOONWELL_MCBBTC_BASE,
      AAVE_V3_POOL_BASE,
      AERODROME_ROUTER_BASE,
      AERO_TOKEN_BASE,
      USDC_BASE_ADDRESS,
      WETH_BASE_ADDRESS,
      CBBTC_BASE_ADDRESS,
    ];

    for (const addr of protocolAddrs) {
      expect(isAddress(addr)).toBe(true);
      expect(addr).toBe(getAddress(addr));
      const registered = Object.values(BASE_MAINNET_REGISTRY).some(
        (e) => e.address.toLowerCase() === addr.toLowerCase()
      );
      expect(registered).toBe(true);
    }
  });

  it("verifies all tokenized stock addresses and Chainlink feeds are valid and checksummed", () => {
    for (const stock of BASE_STOCKS) {
      expect(isAddress(stock.address)).toBe(true);
      expect(stock.address).toBe(getAddress(stock.address));
      if (stock.feed) {
        expect(isAddress(stock.feed)).toBe(true);
        expect(stock.feed).toBe(getAddress(stock.feed));
      }
    }
  });

  it("verifies all common swap tokens are valid and checksummed", () => {
    for (const token of COMMON_BASE_TOKENS) {
      expect(isAddress(token.address)).toBe(true);
      expect(token.address).toBe(getAddress(token.address));
    }
  });

  it("throws descriptive error when querying an unregistered contract key", () => {
    expect(() => getRegisteredAddress("NON_EXISTENT_KEY" as any)).toThrow(
      /not found in master Base registry/
    );
  });
});
