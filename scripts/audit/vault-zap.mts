/**
 * Simulate the atomic zap-router Smart Deposit / Withdraw against live Base state.
 * Prints the user's call count, approvals, and the round trip's net result.
 */
import { erc20Abi, decodeFunctionData, type Address } from "viem";
import { readClmVault, type PayAsset } from "../../lib/lending/zap/clm-zap";
import { planClmDepositZap, BEEFY_TOKEN_MANAGER } from "../../lib/lending/zap/zap-router";
import { pub, simulate, TEST_USER } from "./sim-harness.mts";

const vault = (process.argv[2] || "0xD317fDf7e7E3BA9dc9A73CAe2E54732646866025") as Address;
const info = await readClmVault(pub as never, vault);
console.log(`vault ${info.token0.symbol}/${info.token1.symbol} token0Share=${info.token0ValueShare.toFixed(3)}`);

const approvalsIn = (calls: { data: `0x${string}`; to: Address }[]) =>
  calls.filter((c) => {
    try {
      return decodeFunctionData({ abi: erc20Abi, data: c.data }).functionName === "approve";
    } catch {
      return false;
    }
  }).map((c) => {
    const d = decodeFunctionData({ abi: erc20Abi, data: c.data });
    return `${c.to.slice(0, 8)}→${String(d.args?.[0]).slice(0, 8)}${String(d.args?.[0]).toLowerCase() === BEEFY_TOKEN_MANAGER.toLowerCase() ? "(TokenManager)" : ""}`;
  });

const cases: Array<[PayAsset, number]> = [["token0", 5], ["token0", 100], ["token0", 500], ["token1", 0.01], ["eth", 0.003], ["eth", 0.05]];
for (const [pay, size] of cases) {
  const amount =
    pay === "eth" ? BigInt(Math.round(size * 1e18)) : pay === "token0" ? BigInt(Math.round(size * 10 ** info.token0.decimals)) : BigInt(Math.round(size * 10 ** info.token1.decimals));
  const label = `${size} ${pay === "eth" ? "ETH" : pay === "token0" ? info.token0.symbol : info.token1.symbol}`;
  try {
    const plan = await planClmDepositZap({ client: pub as never, info, user: TEST_USER, pay, amount });
    if (pay === "token1") {
      console.log(`${label}: ${plan.calls.length} calls, approvals ${JSON.stringify(approvalsIn(plan.calls))} (stock balance override not wired: plan only)`);
      continue;
    }
    const res = await simulate(plan.calls, pay === "eth" ? { eth: amount * BigInt(2) } : { usdc: amount });
    const bad = res.find((r) => r.status !== "success");
    console.log(`${label}: ${plan.calls.length} user calls, approvals ${JSON.stringify(approvalsIn(plan.calls))} →`, bad ? `FAIL at ${bad.i}: ${bad.error}` : `OK (gas ${res.reduce((a, r) => a + r.gas, BigInt(0))})`);
  } catch (e) {
    console.log(`${label}: plan error ${(e as Error).message.slice(0, 160)}`);
  }
}

// Withdrawals: see vault-zap-withdraw.mts (Beefy locks withdrawing in the deposit's own block,
// so a same-block round trip always reverts with ActionLocked by design).
