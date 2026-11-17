/**
 * Realistic withdraw simulation: the test address is given existing vault (or CoW) shares by
 * a storage override, as a long-time depositor would hold, then the withdraw batches run at
 * the live block. Compares the atomic zap route with the call-by-call wallet route.
 */
import { erc20Abi, encodeFunctionData, pad, toHex, type Address } from "viem";
import { readClmVault, planClmWithdraw, BEEFY_VAULT_ABI } from "../../lib/lending/zap/clm-zap";
import { planClmWithdrawZap, BEEFY_TOKEN_MANAGER } from "../../lib/lending/zap/zap-router";
import { finalizeAppTransactionBatch, type ContractCall } from "../../lib/utils/tx";
import { pub, TEST_USER, USDC } from "./sim-harness.mts";
import { findBalanceSlot } from "./find-balance-slot.mts";

const vault = (process.argv[2] || "0xD317fDf7e7E3BA9dc9A73CAe2E54732646866025") as Address;
const info = await readClmVault(pub as never, vault);
const vaultSupply = await pub.readContract({ address: vault, abi: erc20Abi, functionName: "totalSupply" });
const clmSupply = await pub.readContract({ address: info.clm, abi: erc20Abi, functionName: "totalSupply" });
const vaultShares = vaultSupply / BigInt(5000); // 0.02% of the vault
const clmShares = clmSupply / BigInt(5000);
const vSlot = (await findBalanceSlot(vault))!;
const cSlot = (await findBalanceSlot(info.clm))!;
const read = (token: Address, fn: "balanceOf" | "allowance", spender?: Address) => ({
  to: token,
  data: encodeFunctionData({ abi: erc20Abi, functionName: fn, args: (fn === "balanceOf" ? [TEST_USER] : [TEST_USER, spender!]) as never }),
});

async function run(name: string, calls: ContractCall[], source: "vault" | "clm") {
  const batch = finalizeAppTransactionBatch(calls);
  const sim = await pub.simulateCalls({
    account: TEST_USER,
    calls: [
      ...batch.map((c) => ({ to: c.to, data: c.data, value: c.value })),
      read(USDC, "balanceOf"),
      read(info.token1.address, "balanceOf"),
      read(source === "vault" ? vault : info.clm, "balanceOf"),
      read(source === "vault" ? vault : info.clm, "allowance", BEEFY_TOKEN_MANAGER),
    ],
    stateOverrides: [
      { address: TEST_USER, balance: BigInt(10) ** BigInt(18) },
      source === "vault"
        ? { address: vault, stateDiff: [{ slot: vSlot, value: pad(toHex(vaultShares), { size: 32 }) }] }
        : { address: info.clm, stateDiff: [{ slot: cSlot, value: pad(toHex(clmShares), { size: 32 }) }] },
    ],
  });
  const res = sim.results;
  const bad = res.slice(0, batch.length).findIndex((r) => r.status !== "success");
  if (bad >= 0) return console.log(`${name.padEnd(36)} FAIL at call ${bad}: ${String((res[bad] as { error?: Error }).error?.message).split("\n")[0].slice(0, 90)}`);
  const [usdc, stock, left, allowance] = res.slice(-4).map((r) => BigInt((r.data as string) || "0x0"));
  console.log(
    `${name.padEnd(36)} ${String(batch.length).padStart(2)} tx(s) OK → ${(Number(usdc) / 1e6).toFixed(4)} USDC + ${(Number(stock) / 10 ** info.token1.decimals).toFixed(6)} ${info.token1.symbol}; shares left ${left}; TokenManager allowance left ${allowance}`
  );
}

console.log(`vault ${info.token0.symbol}/${info.token1.symbol}; withdrawing 0.02% of the vault / CLM`);
for (const toToken0 of [false, true]) {
  const tag = toToken0 ? "→ all USDC" : "→ both tokens";
  await run(`zap   vault ${tag}`, (await planClmWithdrawZap({ client: pub as never, info, user: TEST_USER, vaultShares, toToken0 })).calls, "vault");
  await run(`wallet vault ${tag}`, (await planClmWithdraw({ client: pub as never, info, user: TEST_USER, vaultShares, toToken0 })).calls, "vault");
  await run(`zap   CoW ${tag}`, (await planClmWithdrawZap({ client: pub as never, info, user: TEST_USER, clmShares, toToken0 })).calls, "clm");
  await run(`wallet CoW ${tag}`, (await planClmWithdraw({ client: pub as never, info, user: TEST_USER, clmShares, toToken0 })).calls, "clm");
}
void BEEFY_VAULT_ABI;
