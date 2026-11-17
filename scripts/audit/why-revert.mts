/** Show the raw revert data for a zap deposit and whether the CLM is "calm" right now. */
import { pad, toHex, type Address } from "viem";
import { readClmVault, readClmCalm, NOT_CALM_SELECTOR } from "../../lib/lending/zap/clm-zap";
import { planClmDepositZap } from "../../lib/lending/zap/zap-router";
import { finalizeAppTransactionBatch } from "../../lib/utils/tx";
import { pub, TEST_USER, USDC, usdcBalanceSlot } from "./sim-harness.mts";

const vault = (process.argv[2] || "0xD317fDf7e7E3BA9dc9A73CAe2E54732646866025") as Address;
const info = await readClmVault(pub as never, vault);
for (let i = 0; i < 3; i++) {
  const calm = await readClmCalm(pub as never, info);
  const eth = BigInt(3) * BigInt(10) ** BigInt(15);
  const plan = await planClmDepositZap({ client: pub as never, info, user: TEST_USER, pay: "eth", amount: eth });
  const usdc = BigInt(25_000_000);
  const planU = await planClmDepositZap({ client: pub as never, info, user: TEST_USER, pay: "token0", amount: usdc });
  const sim = await pub.simulateCalls({
    account: TEST_USER,
    calls: [...finalizeAppTransactionBatch(plan.calls), ...finalizeAppTransactionBatch(planU.calls)].map((c) => ({ to: c.to, data: c.data, value: c.value })),
    stateOverrides: [
      { address: TEST_USER, balance: eth * BigInt(4) },
      { address: USDC, stateDiff: [{ slot: usdcBalanceSlot(TEST_USER), value: pad(toHex(usdc), { size: 32 }) }] },
    ],
  });
  const rows = sim.results.map((r) => (r.status === "success" ? "ok" : String(r.data).slice(0, 10)));
  const notCalm = sim.results.some((r) => String(r.data ?? "").includes(NOT_CALM_SELECTOR.slice(2)));
  console.log(`isCalm()=${calm}  [ETH deposit | USDC approve, USDC deposit] → ${rows.join(" | ")}${notCalm ? "  (revert payload contains NotCalm 0x26c87876)" : ""}`);
  await new Promise((r) => setTimeout(r, 4000));
}
