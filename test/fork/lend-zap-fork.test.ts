/**
 * Smart Deposit / Withdraw on real Base, in simulation only (eth_simulateV1 — calls run in
 * order with state carried between them; nothing is signed or sent). The wallet gets a
 * temporary USDC balance via state override.
 */
import { describe, expect, it } from "vitest";
import { createPublicClient, encodeAbiParameters, http, keccak256, pad, parseUnits, toHex, type Address } from "viem";
import { base } from "viem/chains";
import { BEEFY_VAULT_ABI, planClmDeposit, planClmWithdraw, readClmCalm, readClmVault, type ClmVault } from "@/lib/lending/zap/clm-zap";
import { finalizeAppTransactionBatch, hasBuilderSuffix } from "@/lib/utils/tx";
import { planGetToken } from "@/lib/lending/zap/get-token";
import { erc20Abi } from "viem";

const RPC = process.env.ZAP_RPC_URL || "https://base-rpc.publicnode.com";
const client = createPublicClient({ chain: base, transport: http(RPC, { timeout: 60_000 }) });
const WALLET = (process.env.CHECKUP_WALLET || "0xbCDDd1bc8F3c0c24BEDEE41720287ff50a7B7148") as Address;
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
const AMDC_VAULT = "0xf258dcE970F53CAC991311156958102676dCb339" as Address; // Beefy aero-cow USDC/AMDc

/** Beefy CLMs refuse deposits while the pool is off its 2-min TWAP; wait like the UI does. */
async function waitForCalm(info: ClmVault) {
  for (let i = 0; i < 16; i++) {
    if ((await readClmCalm(client, info)) !== false) return;
    await new Promise((r) => setTimeout(r, 15_000));
  }
  throw new Error(`${info.token1.symbol}/${info.token0.symbol} pool stayed not-calm for 4 minutes`);
}

const usdcBalanceSlot = keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [WALLET, BigInt(9)]));

describe("Lend: Smart Deposit into a Beefy CLM pair vault (real Base)", { timeout: 900_000 }, () => {
  it("USDC → AMDc-USDC vault: every step succeeds in order and carries the builder code", async () => {
    const info = await readClmVault(client, AMDC_VAULT);
    expect(info.token0.address.toLowerCase()).toBe(USDC.toLowerCase());
    expect(info.priceToken1InToken0).toBeGreaterThan(1);

    await waitForCalm(info);
    const plan = await planClmDeposit({ client, info, user: WALLET, pay: "token0", amount: parseUnits("50", 6) });
    const batch = finalizeAppTransactionBatch(plan.calls);
    for (const c of batch) expect(hasBuilderSuffix(c.data)).toBe(true);

    const sim = await client.simulateCalls({
      account: WALLET,
      calls: batch.map((c) => ({ to: c.to, data: c.data, value: c.value })),
      stateOverrides: [{ address: USDC, stateDiff: [{ slot: usdcBalanceSlot, value: pad(toHex(parseUnits("1000", 6))) }] }],
    });
    sim.results.forEach((r, i) => expect(r.status, `step ${i}: ${String((r as { error?: Error }).error?.message ?? "").slice(0, 300)}`).toBe("success"));

    // The vault share balance after the batch must be > 0.
    const sharesSim = await client.simulateCalls({
      account: WALLET,
      calls: [
        ...batch.map((c) => ({ to: c.to, data: c.data, value: c.value })),
        { to: AMDC_VAULT, abi: BEEFY_VAULT_ABI, functionName: "balanceOf", args: [WALLET] },
      ],
      stateOverrides: [{ address: USDC, stateDiff: [{ slot: usdcBalanceSlot, value: pad(toHex(parseUnits("1000", 6))) }] }],
    });
    const last = sharesSim.results[sharesSim.results.length - 1];
    expect(last.status).toBe("success");
    const vaultShares = last.result as unknown as bigint;
    expect(vaultShares).toBeGreaterThan(BigInt(0));
    console.info(
      `[zap] ${plan.steps.map((s) => s.label).join(" → ")} | value ~$${plan.expected.valueInToken0.toFixed(2)} | vault shares ${vaultShares}` +
        (plan.warnings.length ? ` | ${plan.warnings.join(" ")}` : "")
    );

    // Withdraw plan (everything back to USDC) builds against the same vault.
    const wplan = await planClmWithdraw({ client, info, user: WALLET, vaultShares, toToken0: true });
    expect(wplan.calls.length).toBeGreaterThanOrEqual(2);
    expect(wplan.expected.clmShares).toBeGreaterThan(BigInt(0));
  });

  it("pay with ETH: ETH → USDC → (stock if needed) → vault, all steps succeed", async () => {
    const info = await readClmVault(client, AMDC_VAULT);
    await waitForCalm(info);
    const plan = await planClmDeposit({ client, info, user: WALLET, pay: "eth", amount: parseUnits("0.02", 18) });
    expect(plan.steps[0].kind).toBe("swap");
    const batch = finalizeAppTransactionBatch(plan.calls);
    for (const c of batch) expect(hasBuilderSuffix(c.data)).toBe(true);
    const sim = await client.simulateCalls({
      account: WALLET,
      calls: [
        ...batch.map((c) => ({ to: c.to, data: c.data, value: c.value })),
        { to: AMDC_VAULT, abi: BEEFY_VAULT_ABI, functionName: "balanceOf", args: [WALLET] },
      ],
      stateOverrides: [{ address: WALLET, balance: parseUnits("1", 18) }],
    });
    sim.results.forEach((r, i) => expect(r.status, `step ${i}`).toBe("success"));
    const shares = sim.results[sim.results.length - 1].result as unknown as bigint;
    expect(shares).toBeGreaterThan(BigInt(0));
    console.info(`[zap eth] ${plan.steps.map((s) => s.label).join(" → ")} | ~$${plan.expected.valueInToken0.toFixed(2)} | shares ${shares}`);
  });

  it("WETH pair (METAc-WETH): pay with ETH wraps instead of swapping, then deposits", async () => {
    const vault = "0x5D3456585FD2cB90014f34A02EC00F3409772eA9" as Address;
    const info = await readClmVault(client, vault);
    await waitForCalm(info);
    const plan = await planClmDeposit({ client, info, user: WALLET, pay: "eth", amount: parseUnits("0.01", 18) });
    expect(plan.steps[0].label).toBe("Wrap ETH → WETH");
    const batch = finalizeAppTransactionBatch(plan.calls);
    const sim = await client.simulateCalls({
      account: WALLET,
      calls: [
        ...batch.map((c) => ({ to: c.to, data: c.data, value: c.value })),
        { to: vault, abi: BEEFY_VAULT_ABI, functionName: "balanceOf", args: [WALLET] },
      ],
      stateOverrides: [{ address: WALLET, balance: parseUnits("1", 18) }],
    });
    sim.results.forEach((r, i) => expect(r.status, `step ${i}: ${String((r as { error?: Error }).error?.message ?? "").slice(0, 300)}`).toBe("success"));
    expect(sim.results[sim.results.length - 1].result as unknown as bigint).toBeGreaterThan(BigInt(0));
  });

  it("Get stock first: USDC → AMDc and ETH → USDC → AMDc both deliver at least the minimum", async () => {
    const info = await readClmVault(client, AMDC_VAULT);
    const stock = info.token1;
    for (const pay of ["usdc", "eth"] as const) {
      const plan = await planGetToken({
        user: WALLET,
        pay,
        amount: pay === "usdc" ? parseUnits("25", 6) : parseUnits("0.01", 18),
        tokenOut: stock.address,
        tokenOutSymbol: stock.symbol,
      });
      const batch = finalizeAppTransactionBatch(plan.calls);
      for (const c of batch) expect(hasBuilderSuffix(c.data)).toBe(true);
      const sim = await client.simulateCalls({
        account: WALLET,
        calls: [
          ...batch.map((c) => ({ to: c.to, data: c.data, value: c.value })),
          { to: stock.address, abi: erc20Abi, functionName: "balanceOf", args: [WALLET] },
        ],
        stateOverrides: [
          { address: WALLET, balance: parseUnits("1", 18) },
          { address: USDC, stateDiff: [{ slot: usdcBalanceSlot, value: pad(toHex(parseUnits("1000", 6))) }] },
        ],
      });
      sim.results.forEach((r, i) => expect(r.status, `${pay} step ${i}`).toBe("success"));
      const got = sim.results[sim.results.length - 1].result as unknown as bigint;
      expect(got).toBeGreaterThanOrEqual(plan.minOut);
      console.info(`[get ${pay}] ${plan.steps.join(" → ")} | got ${got} (min ${plan.minOut})`);
    }
  });
});
