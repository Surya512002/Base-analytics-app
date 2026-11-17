/** Simulate "Get {stock}": ETH via the zap router (1 tx) and USDC direct (approve + swap). */
import { erc20Abi, encodeFunctionData, getAddress, type Address } from "viem";
import { planGetToken } from "../../lib/lending/zap/get-token";
import { planGetTokenWithEthZap } from "../../lib/lending/zap/zap-router";
import { finalizeAppTransactionBatch } from "../../lib/utils/tx";
import { pub, simulate, TEST_USER, USDC, usdcBalanceSlot } from "./sim-harness.mts";

const NVDA = getAddress("0xb20000000000000000000078ee7ce2fE4908108C");
const bal = (t: Address) => ({ to: t, data: encodeFunctionData({ abi: erc20Abi, functionName: "balanceOf", args: [TEST_USER] }) });

const eth = BigInt(10) ** BigInt(16); // 0.01 ETH
const z = await planGetTokenWithEthZap({ user: TEST_USER, amount: eth, tokenOut: NVDA, tokenOutSymbol: "NVDAc" });
const r1 = await simulate(z.calls, { eth: eth * BigInt(2) });
console.log(`ETH → NVDAc via router: ${z.calls.length} tx →`, r1.every((r) => r.status === "success") ? "OK" : r1.find((r) => r.status !== "success")?.error);
const sim = await pub.simulateCalls({
  account: TEST_USER,
  calls: [...finalizeAppTransactionBatch(z.calls).map((c) => ({ to: c.to, data: c.data, value: c.value })), bal(NVDA), bal(USDC)],
  stateOverrides: [{ address: TEST_USER, balance: eth * BigInt(2) }],
});
const [nv, us] = sim.results.slice(-2).map((r) => BigInt((r.data as string) || "0x0"));
console.log(`  received ${Number(nv) / 1e8} NVDAc (min ${Number(z.minOut) / 1e8}), USDC dust ${us}`);

const usdc = BigInt(20_000_000);
const d = await planGetToken({ user: TEST_USER, pay: "usdc", amount: usdc, tokenOut: NVDA, tokenOutSymbol: "NVDAc" });
const r2 = await simulate(d.calls, { usdc });
console.log(`USDC → NVDAc direct: ${d.calls.length} calls →`, r2.every((r) => r.status === "success") ? "OK" : r2.find((r) => r.status !== "success")?.error);
void usdcBalanceSlot;
