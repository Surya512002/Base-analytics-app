import { BASE_LENDING_MARKETS } from "@/lib/lending/markets";
import { describe, expect, it } from "vitest";
import { encodeFunctionData, erc20Abi, maxUint256, parseAbi } from "viem";
import { assertTrustedApprovals, isTrustedSpender, isUnlimitedApprovalAllowed } from "@/lib/security/trusted-spenders";
import { isTrustedSwapTarget } from "@/lib/launchpad/router-guard";
import { SWAP_ROUTER_02 } from "@/lib/launchpad/uniswap";
import { ZEROX_ALLOWANCE_HOLDER } from "@/lib/utils/tx";
import { MORPHO_BLUE_BASE } from "@/lib/lending/constants";

const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const ATTACKER = "0x00000000000000000000000000000000badbad00" as const;
const BEEFY_VAULT = "0xD317fDf7e7E3BA9dc9A73CAe2E54732646866025" as const; // reviewed Beefy NVDAc-USDC vault

const approve = (spender: `0x${string}`, amount: bigint) => ({
  to: USDC,
  data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] }),
});

describe("approval guard", () => {
  it("lets exact approvals to known contracts through", () => {
    expect(() => assertTrustedApprovals([approve(SWAP_ROUTER_02, BigInt(1_000_000))])).not.toThrow();
    expect(() => assertTrustedApprovals([approve(ZEROX_ALLOWANCE_HOLDER, BigInt(5))])).not.toThrow();
    expect(() => assertTrustedApprovals([approve(BEEFY_VAULT, BigInt(5))])).not.toThrow();
  });

  it("blocks an approval to an unknown contract, wherever it sits in the batch", () => {
    const swap = { to: SWAP_ROUTER_02, data: "0x12345678" as const };
    expect(() => assertTrustedApprovals([swap, approve(ATTACKER, BigInt(1))])).toThrow(/unrecognised/);
  });

  it("allows unlimited approval only for core lending, never for a vault or router", () => {
    expect(() => assertTrustedApprovals([approve(MORPHO_BLUE_BASE, maxUint256)])).not.toThrow();
    expect(() => assertTrustedApprovals([approve(BEEFY_VAULT, maxUint256)])).toThrow(/unlimited/);
    // No catalogue entry earns it either: pool and vault contracts only ever get exact amounts.
    for (const m of BASE_LENDING_MARKETS) expect(isUnlimitedApprovalAllowed(m.contractAddress), m.id).toBe(false);
    expect(() => assertTrustedApprovals([approve(SWAP_ROUTER_02, maxUint256)])).toThrow(/unlimited/);
  });

  it("blocks approve-all for NFTs and malformed approvals", () => {
    const nft = parseAbi(["function setApprovalForAll(address operator, bool approved)"]);
    const all = { to: USDC, data: encodeFunctionData({ abi: nft, functionName: "setApprovalForAll", args: [SWAP_ROUTER_02, true] }) };
    expect(() => assertTrustedApprovals([all])).toThrow(/NFTs/);
    expect(() => assertTrustedApprovals([{ to: USDC, data: "0x095ea7b3" }])).toThrow(/malformed/);
  });

  it("ignores calls that are not approvals", () => {
    const transfer = { to: USDC, data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [ATTACKER, BigInt(1)] }) };
    expect(() => assertTrustedApprovals([transfer])).not.toThrow();
  });

  it("swap targets: only known routers", () => {
    expect(isTrustedSwapTarget(SWAP_ROUTER_02)).toBe(true);
    expect(isTrustedSwapTarget(ZEROX_ALLOWANCE_HOLDER.toLowerCase())).toBe(true);
    expect(isTrustedSwapTarget(ATTACKER)).toBe(false);
    expect(isTrustedSwapTarget(null)).toBe(false);
    expect(isTrustedSpender(ATTACKER)).toBe(false);
  });
});
