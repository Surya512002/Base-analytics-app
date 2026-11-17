/** Simulate Smart Deposit (pay USDC / ETH) into a Beefy CLM vault at several sizes. */
import { erc20Abi, type Address } from "viem";
import { readClmVault, planClmDeposit, type PayAsset } from "../../lib/lending/zap/clm-zap";
import { pub, simulate, TEST_USER, USDC } from "./sim-harness.mts";

const vault = (process.argv[2] || "0xD317fDf7e7E3BA9dc9A73CAe2E54732646866025") as Address;
const info = await readClmVault(pub as never, vault);
console.log(`vault ${info.token0.symbol}/${info.token1.symbol} token0Share=${info.token0ValueShare.toFixed(3)}`);
const sanity = await pub.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [TEST_USER] });
console.log("test user's real USDC balance (should be 0):", sanity);

const cases: Array<[PayAsset, number]> = [
  ["token0", 5],
  ["token0", 25],
  ["token0", 100],
  ["token0", 500],
  ["eth", 0.003],
  ["eth", 0.03],
];
for (const [pay, size] of cases) {
  const amount = pay === "eth" ? BigInt(Math.round(size * 1e18)) : BigInt(size) * BigInt(1_000_000);
  const label = pay === "eth" ? `${size} ETH` : `$${size} USDC`;
  try {
    const plan = await planClmDeposit({ client: pub as never, info, user: TEST_USER, pay, amount });
    const res = await simulate(plan.calls, pay === "eth" ? { eth: amount * BigInt(2) } : { usdc: amount });
    const bad = res.find((r) => r.status !== "success");
    console.log(
      `${label}: ${plan.calls.length} calls [${plan.steps.map((s) => s.kind).join(",")}] →`,
      bad ? `FAIL at call ${bad.i}: ${bad.error}` : "OK"
    );
  } catch (e) {
    console.log(`${label}: plan error ${(e as Error).message.slice(0, 140)}`);
  }
}
