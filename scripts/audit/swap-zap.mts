/**
 * Swap batches as a browser wallet would send them, before and after wrapping in one
 * zap-router order. Buy NVDAc with USDC / ETH, then sell it back, checking the user's
 * received amounts, the treasury fee and leftover allowances.
 */
import { erc20Abi, encodeFunctionData, getAddress, type Address } from "viem";
import { quoteSlipstreamExactIn, encodeSlipstreamExactInput, encodeSlipstreamBuy } from "../../lib/launchpad/slipstream";
import { buildContractCall, buildNativeTransferCall, type ContractCall } from "../../lib/utils/tx";
import { encodeB20ApproveCalldata, encodeErc20TransferCalldata } from "../../lib/b20/encode";
import { LAUNCHPAD_TREASURY } from "../../lib/constants/launchpad";
import { WETH_BASE } from "../../lib/launchpad/uniswap";
import { wrapSwapBatchForBrowserWallet } from "../../lib/swap/zap-batch";
import { BEEFY_TOKEN_MANAGER } from "../../lib/lending/zap/zap-router";
import { finalizeAppTransactionBatch } from "../../lib/utils/tx";
import { pub, TEST_USER, USDC, usdcBalanceSlot } from "./sim-harness.mts";
import { pad, toHex } from "viem";

const NVDA = getAddress("0xb20000000000000000000078ee7ce2fE4908108C");
const TREASURY = LAUNCHPAD_TREASURY as Address;
const user = TEST_USER;
const minus = (x: bigint, bps: number) => (x * BigInt(10_000 - bps)) / BigInt(10_000);
const read = (token: Address, who: Address) => ({ to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: "balanceOf", args: [who] }) });
const allowance = (token: Address) => ({ to: token, data: encodeFunctionData({ abi: erc20Abi, functionName: "allowance", args: [user, BEEFY_TOKEN_MANAGER] }) });

async function run(name: string, calls: ContractCall[], extra: { usdc?: bigint; eth?: bigint }, checks: Array<{ to: Address; data: `0x${string}` }>) {
  const batch = finalizeAppTransactionBatch(calls);
  const sim = await pub.simulateCalls({
    account: user,
    calls: [...batch.map((c) => ({ to: c.to, data: c.data, value: c.value })), ...checks],
    stateOverrides: [
      { address: user, balance: extra.eth ?? BigInt(10) ** BigInt(17) },
      ...(extra.usdc ? [{ address: USDC, stateDiff: [{ slot: usdcBalanceSlot(user), value: pad(toHex(extra.usdc), { size: 32 }) }] }] : []),
    ],
  });
  const bad = sim.results.slice(0, batch.length).findIndex((r) => r.status !== "success");
  if (bad >= 0) return console.log(`${name.padEnd(40)} FAIL at ${bad}: ${String((sim.results[bad] as { data?: string }).data).slice(0, 74)}`), null;
  const vals = sim.results.slice(batch.length).map((r) => BigInt((r.data as string) || "0x0"));
  console.log(`${name.padEnd(40)} ${String(batch.length).padStart(2)} wallet prompt(s) → ${vals.map(String).join(" | ")}`);
  return vals;
}

// ── Buy NVDAc with 20 USDC (router path: approve, swap net, fee transfer) ──
const gross = BigInt(20_000_000);
const fee = (gross * BigInt(25)) / BigInt(10_000);
const net = gross - fee;
const q = await quoteSlipstreamExactIn(USDC, NVDA, net);
const minOut = minus(q.amountOut, 100);
const buy: ContractCall[] = [
  buildContractCall(USDC, encodeB20ApproveCalldata(q.router, net)),
  buildContractCall(q.router, encodeSlipstreamExactInput({ tokenIn: USDC, tokenOut: NVDA, recipient: user, amountIn: net, amountOutMinimum: minOut, tickSpacing: q.tickSpacing })),
  buildContractCall(USDC, encodeErc20TransferCalldata(TREASURY, fee)),
];
const checksBuy = [read(NVDA, user), read(USDC, user), read(USDC, TREASURY), allowance(USDC)];
console.log("columns: user NVDAc | user USDC | treasury USDC | USDC allowance to TokenManager");
await run("buy 20 USDC → NVDAc, as today", buy, { usdc: gross }, checksBuy);
const wrappedBuy = await wrapSwapBatchForBrowserWallet(pub as never, user, buy);
await run("buy 20 USDC → NVDAc, wrapped", wrappedBuy!.calls, { usdc: gross }, checksBuy);

// ── Buy NVDAc with 0.01 ETH ──
const ethGross = BigInt(10) ** BigInt(16);
const ethFee = (ethGross * BigInt(25)) / BigInt(10_000);
const ethNet = ethGross - ethFee;
const qe = await quoteSlipstreamExactIn(WETH_BASE as Address, NVDA, ethNet);
console.log("ETH→NVDAc direct pool:", qe.hasLiquidity ? "yes" : "no (the app routes ETH via USDC/aggregator)");
if (qe.hasLiquidity) {
  const ethBuy: ContractCall[] = [
    buildContractCall(qe.router, encodeSlipstreamBuy({ tokenOut: NVDA, recipient: user, amountIn: ethNet, amountOutMinimum: minus(qe.amountOut, 100), tickSpacing: qe.tickSpacing }), ethNet),
    buildNativeTransferCall(TREASURY, ethFee),
  ];
  await run("buy 0.01 ETH → NVDAc, as today", ethBuy, {}, [read(NVDA, user)]);
  const w = await wrapSwapBatchForBrowserWallet(pub as never, user, ethBuy);
  await run("buy 0.01 ETH → NVDAc, wrapped", w!.calls, {}, [read(NVDA, user)]);
}

// ── Sell: buy first (same simulation), then sell the NVDAc back for USDC ──
const sellAmt = minOut;
const sellFee = (sellAmt * BigInt(25)) / BigInt(10_000);
const sellNet = sellAmt - sellFee;
const qs = await quoteSlipstreamExactIn(NVDA, USDC, sellNet);
const sell: ContractCall[] = [
  buildContractCall(NVDA, encodeB20ApproveCalldata(qs.router, sellNet)),
  buildContractCall(qs.router, encodeSlipstreamExactInput({ tokenIn: NVDA, tokenOut: USDC, recipient: user, amountIn: sellNet, amountOutMinimum: minus(qs.amountOut, 100), tickSpacing: qs.tickSpacing })),
  buildContractCall(NVDA, encodeErc20TransferCalldata(TREASURY, sellFee)),
];
const wrappedSell = await wrapSwapBatchForBrowserWallet(pub as never, user, sell);
const checksSell = [read(NVDA, user), read(USDC, user), read(NVDA, TREASURY), allowance(NVDA)];
console.log("columns: user NVDAc | user USDC | treasury NVDAc | NVDAc allowance to TokenManager");
await run("buy then sell NVDAc → USDC, as today", [...buy, ...sell], { usdc: gross }, checksSell);
await run("buy then sell NVDAc → USDC, wrapped", [...wrappedBuy!.calls, ...wrappedSell!.calls], { usdc: gross }, checksSell);
