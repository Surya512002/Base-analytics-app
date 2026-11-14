/**
 * Smart deposit / withdraw for Beefy CoW (CLM) pair vaults, e.g. AMDc-USDC on Aerodrome.
 *
 * Users rarely hold both tokens in the ratio a concentrated-liquidity pool wants, so this
 * plans the whole route from what they DO hold (USDC, the stock, or ETH):
 *   swap only the part that's needed  →  deposit both tokens into the CLM (min-shares guard)
 *   →  stake the CLM shares in Beefy's auto-compounding vault.
 * Every number comes from the chain: the CLM's own previewDeposit says which mix it accepts
 * right now, and SimQuoter prices swaps on the CLM's own pool. Approvals are exact (never
 * unlimited) and every call goes through buildContractCall → builder code.
 */
import { encodeFunctionData, erc20Abi, parseAbi, type Address, type PublicClient } from "viem";

const WETH_ABI = parseAbi(["function deposit() payable"]);
import { buildContractCall, encodeContractCall, type ContractCall } from "@/lib/utils/tx";
import { simQuoteExactIn } from "@/lib/onchain/sim-quoter";
import {
  encodeSlipstreamBuy,
  encodeSlipstreamExactInput,
  quoteSlipstreamExactIn,
} from "@/lib/launchpad/slipstream";
import { WETH_BASE } from "@/lib/launchpad/uniswap";
import { USDC_ADDRESS } from "@/lib/lending/zap/get-token";

export const CLM_ABI = parseAbi([
  "function wants() view returns (address token0, address token1)",
  "function balances() view returns (uint256 amount0, uint256 amount1)",
  "function totalSupply() view returns (uint256)",
  "function strategy() view returns (address)",
  "function previewDeposit(uint256 _amount0, uint256 _amount1) view returns (uint256 shares, uint256 amount0, uint256 amount1, uint256 fee0, uint256 fee1)",
  "function previewWithdraw(uint256 _shares) view returns (uint256 amount0, uint256 amount1)",
  "function deposit(uint256 _amount0, uint256 _amount1, uint256 _minShares)",
  "function withdraw(uint256 _shares, uint256 _minAmount0, uint256 _minAmount1)",
]);
export const BEEFY_VAULT_ABI = parseAbi([
  "function want() view returns (address)",
  "function getPricePerFullShare() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function depositAll()",
  "function withdraw(uint256 _shares)",
]);
const STRATEGY_ABI = parseAbi(["function pool() view returns (address)", "function isCalm() view returns (bool)"]);
const POOL_ABI = parseAbi(["function tickSpacing() view returns (int24)", "function factory() view returns (address)"]);

export type ClmVault = {
  vault: Address;
  clm: Address;
  strategy: Address;
  pool: Address;
  tickSpacing: number;
  token0: { address: Address; symbol: string; decimals: number };
  token1: { address: Address; symbol: string; decimals: number };
  /** Share of each new deposit's VALUE the CLM takes as token0 right now (0..1). */
  token0ValueShare: number;
  /** token0 units per 1 whole token1 (spot, from the pool). */
  priceToken1InToken0: number;
};

/** The two reads the planner needs; any Base public client satisfies it. */
export type ZapClient = Pick<PublicClient, "readContract" | "call">;

export type PayAsset = "token0" | "token1" | "eth";

const BPS = BigInt(10_000);
/** Largest price impact a rebalancing swap may have (3%). */
const MAX_IMPACT = 0.03;
const minus = (x: bigint, bps: number) => (x * (BPS - BigInt(bps))) / BPS;
const toNum = (x: bigint, decimals: number) => Number(x) / 10 ** decimals;
const fromNum = (x: number, decimals: number) => BigInt(Math.max(0, Math.floor(x * 10 ** decimals)));

/** Everything needed to plan, read from the vault, its CLM and the CLM's pool. */
export async function readClmVault(client: ZapClient, vault: Address): Promise<ClmVault> {
  const clm = (await client.readContract({ address: vault, abi: BEEFY_VAULT_ABI, functionName: "want" })) as Address;
  const [wants, balances, strategy] = await Promise.all([
    client.readContract({ address: clm, abi: CLM_ABI, functionName: "wants" }) as Promise<readonly [Address, Address]>,
    client.readContract({ address: clm, abi: CLM_ABI, functionName: "balances" }) as Promise<readonly [bigint, bigint]>,
    client.readContract({ address: clm, abi: CLM_ABI, functionName: "strategy" }) as Promise<Address>,
  ]);
  const pool = (await client.readContract({ address: strategy, abi: STRATEGY_ABI, functionName: "pool" })) as Address;
  const [tickSpacing, d0, d1, s0, s1] = await Promise.all([
    client.readContract({ address: pool, abi: POOL_ABI, functionName: "tickSpacing" }) as Promise<number>,
    client.readContract({ address: wants[0], abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address: wants[1], abi: erc20Abi, functionName: "decimals" }),
    client.readContract({ address: wants[0], abi: erc20Abi, functionName: "symbol" }),
    client.readContract({ address: wants[1], abi: erc20Abi, functionName: "symbol" }),
  ]);

  // Spot price from the pool itself (tiny probe = no meaningful price impact).
  const probe1 = BigInt(10) ** BigInt(Math.max(0, Number(d1) - 3)); // 0.001 token1
  const out0 = await simQuoteExactIn(client, pool, false, probe1); // token1 -> token0
  const priceToken1InToken0 = toNum(out0, Number(d0)) / toNum(probe1, Number(d1));

  // Which mix does the CLM accept right now? Offer its own balance ratio (scaled down).
  const scale = (x: bigint) => (x > BigInt(0) ? x / BigInt(1000) + BigInt(1) : BigInt(0));
  const [, used0, used1] = (await client.readContract({
    address: clm,
    abi: CLM_ABI,
    functionName: "previewDeposit",
    args: [scale(balances[0]) || BigInt(10) ** BigInt(Number(d0)), scale(balances[1]) || BigInt(10) ** BigInt(Number(d1))],
  })) as readonly [bigint, bigint, bigint, bigint, bigint];
  const v0 = toNum(used0, Number(d0));
  const v1 = toNum(used1, Number(d1)) * priceToken1InToken0;
  const token0ValueShare = v0 + v1 > 0 ? v0 / (v0 + v1) : 0.5;

  return {
    vault,
    clm,
    strategy,
    pool,
    tickSpacing: Number(tickSpacing),
    token0: { address: wants[0], symbol: String(s0), decimals: Number(d0) },
    token1: { address: wants[1], symbol: String(s1), decimals: Number(d1) },
    token0ValueShare,
    priceToken1InToken0,
  };
}

/** Beefy CLM error when the pool price is off its 2-minute TWAP (anti-manipulation). */
export const NOT_CALM_SELECTOR = "0x26c87876";
export const NOT_CALM_MESSAGE =
  "The pool's price moved in the last couple of minutes, so the vault pauses deposits until it settles (an anti-manipulation guard). This usually clears within 2 minutes.";

/**
 * Whether the CLM accepts deposits right now (price within maxTickDeviation of the TWAP).
 * Returns null when the strategy doesn't expose the check.
 */
export async function readClmCalm(client: ZapClient, info: Pick<ClmVault, "strategy">): Promise<boolean | null> {
  try {
    return (await client.readContract({ address: info.strategy, abi: STRATEGY_ABI, functionName: "isCalm" })) as boolean;
  } catch {
    return null;
  }
}

export type ClmDepositPlan = {
  steps: Array<{ kind: "swap" | "approve" | "deposit" | "stake"; label: string }>;
  calls: ContractCall[];
  expected: {
    deposit0: bigint;
    deposit1: bigint;
    minClmShares: bigint;
    /** Value of what goes in, in token0 units (e.g. USDC). */
    valueInToken0: number;
  };
  warnings: string[];
};

/**
 * Plan a deposit of `amount` of the pay asset. `slippageBps` guards swaps and the CLM deposit.
 */
export async function planClmDeposit(params: {
  client: ZapClient;
  info: ClmVault;
  user: Address;
  pay: PayAsset;
  amount: bigint;
  slippageBps?: number;
}): Promise<ClmDepositPlan> {
  const { client, info, user, pay } = params;
  const slip = params.slippageBps ?? 100;
  const steps: ClmDepositPlan["steps"] = [];
  const calls: ContractCall[] = [];
  const warnings: string[] = [];
  const t0 = info.token0;
  const t1 = info.token1;

  // 1. ETH in: swap it to token0 first (deep WETH pools), then continue as token0.
  let have0 = BigInt(0);
  let have1 = BigInt(0);
  const isWeth = (a: Address) => a.toLowerCase() === (WETH_BASE as string).toLowerCase();
  if (pay === "eth" && (isWeth(t0.address) || isWeth(t1.address))) {
    // A WETH pair: wrap the ETH (1:1, no swap), then rebalance like any other token.
    calls.push(buildContractCall(WETH_BASE as Address, encodeFunctionData({ abi: WETH_ABI, functionName: "deposit" }), params.amount));
    steps.push({ kind: "swap", label: "Wrap ETH → WETH" });
    if (isWeth(t0.address)) have0 = params.amount;
    else have1 = params.amount;
  } else if (pay === "eth") {
    const q = await quoteSlipstreamExactIn(WETH_BASE as Address, t0.address, params.amount);
    if (!q.hasLiquidity) throw new Error(`No route from ETH to ${t0.symbol}`);
    const min = minus(q.amountOut, slip);
    calls.push(
      buildContractCall(
        q.router,
        encodeSlipstreamBuy({ tokenOut: t0.address, recipient: user, amountIn: params.amount, amountOutMinimum: min, tickSpacing: q.tickSpacing }),
        params.amount
      )
    );
    steps.push({ kind: "swap", label: `Swap ETH → ${t0.symbol}` });
    have0 = min;
  } else if (pay === "token0") {
    have0 = params.amount;
  } else {
    have1 = params.amount;
  }

  // 2. Rebalance to the CLM's current mix, swapping only the needed part on the CLM's own pool.
  const price = info.priceToken1InToken0;
  const totalValue0 = toNum(have0, t0.decimals) + toNum(have1, t1.decimals) * price;
  const want0Value = totalValue0 * info.token0ValueShare;
  const approveRouter = (token: Address, amount: bigint, router: Address) =>
    calls.push(encodeContractCall(token, erc20Abi, "approve", [router, amount]));
  // Price impact vs the pool's spot price. Thin pools get refused instead of filling badly, and
  // the impact bounds how far the CLM's share price can move between preview and deposit.
  let impactBps = 0;
  const checkImpact = (impact: number) => {
    if (impact > MAX_IMPACT) {
      throw new Error(`Price impact ${(impact * 100).toFixed(1)}% is too high for this pool. Try a smaller amount.`);
    }
    impactBps = Math.max(0, Math.ceil(impact * 10_000));
  };
  // Swap tIn → tOut, keeping clear of the CLM's own pool where possible: the CLM refuses deposits
  // right after its pool's price moves (NotCalm). Non-USDC pairs (e.g. METAc-WETH) hop through
  // USDC, whose pools are separate; USDC pairs only have the CLM pool, so they swap directly.
  const addSwap = async (tIn: ClmVault["token0"], tOut: ClmVault["token0"], amountIn: bigint, direct: boolean) => {
    const hops: Array<ClmVault["token0"]> = [tIn];
    const isUsdc = (a: Address) => a.toLowerCase() === USDC_ADDRESS.toLowerCase();
    if (!direct && !isUsdc(tIn.address) && !isUsdc(tOut.address)) hops.push({ address: USDC_ADDRESS, symbol: "USDC", decimals: 6 });
    hops.push(tOut);
    const planned: Array<{ router: Address; data: `0x${string}`; approve: [Address, bigint, Address] }> = [];
    let amt = amountIn;
    let quoted = BigInt(0);
    for (let i = 0; i < hops.length - 1; i++) {
      const q = await quoteSlipstreamExactIn(hops[i].address, hops[i + 1].address, amt);
      if (!q.hasLiquidity) {
        if (hops.length > 2) return null; // caller falls back to the direct pool
        throw new Error(`No route ${tIn.symbol} → ${tOut.symbol}`);
      }
      const min = minus(q.amountOut, slip);
      planned.push({
        router: q.router,
        approve: [hops[i].address, amt, q.router],
        data: encodeSlipstreamExactInput({ tokenIn: hops[i].address, tokenOut: hops[i + 1].address, recipient: user, amountIn: amt, amountOutMinimum: min, tickSpacing: q.tickSpacing }),
      });
      quoted = q.amountOut;
      amt = min;
    }
    for (const h of planned) {
      approveRouter(...h.approve);
      calls.push(buildContractCall(h.router, h.data));
    }
    steps.push({ kind: "swap", label: `Swap ${hops.map((h) => h.symbol).join(" → ")}` });
    return { quoted, min: amt };
  };
  const swapVia = async (tIn: ClmVault["token0"], tOut: ClmVault["token0"], amountIn: bigint) =>
    (await addSwap(tIn, tOut, amountIn, false)) ?? (await addSwap(tIn, tOut, amountIn, true))!;

  if (toNum(have0, t0.decimals) > want0Value * 1.0001) {
    // too much token0 → swap the excess to token1
    const swap0 = fromNum(toNum(have0, t0.decimals) - want0Value, t0.decimals);
    const { quoted, min } = await swapVia(t0, t1, swap0);
    checkImpact(toNum(swap0, t0.decimals) / toNum(quoted, t1.decimals) / price - 1);
    have0 -= swap0;
    have1 += min;
  } else if (toNum(have1, t1.decimals) * price > (totalValue0 - want0Value) * 1.0001) {
    // too much token1 → swap the excess to token0
    const excessValue = toNum(have1, t1.decimals) * price - (totalValue0 - want0Value);
    const swap1 = fromNum(excessValue / price, t1.decimals);
    const { quoted, min } = await swapVia(t1, t0, swap1);
    checkImpact(1 - toNum(quoted, t0.decimals) / toNum(swap1, t1.decimals) / price);
    have1 -= swap1;
    have0 += min;
  }

  // 3. Deposit into the CLM with a minimum-shares guard.
  const [shares, used0, used1] = (await client.readContract({
    address: info.clm,
    abi: CLM_ABI,
    functionName: "previewDeposit",
    args: [have0, have1],
  })) as readonly [bigint, bigint, bigint, bigint, bigint];
  if (shares <= BigInt(0)) throw new Error("The vault isn't accepting this deposit right now");
  // The preview is read before this batch's own swap moves the pool, so allow for that impact.
  const minShares = minus(shares, Math.max(50, slip + 2 * impactBps));
  if (used0 > BigInt(0)) calls.push(encodeContractCall(t0.address, erc20Abi, "approve", [info.clm, used0]));
  if (used1 > BigInt(0)) calls.push(encodeContractCall(t1.address, erc20Abi, "approve", [info.clm, used1]));
  steps.push({ kind: "approve", label: `Approve ${[used0 > BigInt(0) ? t0.symbol : "", used1 > BigInt(0) ? t1.symbol : ""].filter(Boolean).join(" + ")} (exact amounts)` });
  calls.push(encodeContractCall(info.clm, CLM_ABI, "deposit", [used0, used1, minShares]));
  steps.push({ kind: "deposit", label: `Add liquidity to the ${t1.symbol}/${t0.symbol} pool` });

  // 4. Stake the CLM shares in the auto-compounding vault with depositAll(). The swap above can make
  // the CLM mint a little more than the pre-swap preview (bounded by MAX_IMPACT), so the approval
  // covers preview + 2×MAX_IMPACT; the vault only pulls what was actually minted.
  calls.push(encodeContractCall(info.clm, erc20Abi, "approve", [info.vault, (shares * BigInt(10_000 + 2 * MAX_IMPACT * 10_000)) / BPS]));
  calls.push(encodeContractCall(info.vault, BEEFY_VAULT_ABI, "depositAll", []));
  steps.push({ kind: "stake", label: "Stake into the auto-compounding vault" });

  const leftover0 = have0 - used0;
  const leftover1 = have1 - used1;
  if (leftover0 > BigInt(0) || leftover1 > BigInt(0)) {
    warnings.push(
      `The pool can't take everything at today's ratio; ${[
        leftover0 > BigInt(0) ? `${toNum(leftover0, t0.decimals).toFixed(4)} ${t0.symbol}` : "",
        leftover1 > BigInt(0) ? `${toNum(leftover1, t1.decimals).toFixed(6)} ${t1.symbol}` : "",
      ]
        .filter(Boolean)
        .join(" and ")} will stay in your wallet.`
    );
  }

  return {
    steps,
    calls,
    expected: {
      deposit0: used0,
      deposit1: used1,
      minClmShares: minShares,
      valueInToken0: toNum(used0, t0.decimals) + toNum(used1, t1.decimals) * price,
    },
    warnings,
  };
}

export type ClmWithdrawPlan = {
  steps: Array<{ kind: "unstake" | "withdraw" | "swap" | "approve"; label: string }>;
  calls: ContractCall[];
  expected: { out0: bigint; out1: bigint; clmShares: bigint; valueInToken0: number };
};

/** Withdraw `vaultShares` (or all) → both tokens back, optionally swapping token1 to token0. */
export async function planClmWithdraw(params: {
  client: ZapClient;
  info: ClmVault;
  user: Address;
  vaultShares: bigint;
  toToken0?: boolean;
  slippageBps?: number;
}): Promise<ClmWithdrawPlan> {
  const { client, info, user } = params;
  const slip = params.slippageBps ?? 100;
  const steps: ClmWithdrawPlan["steps"] = [];
  const calls: ContractCall[] = [];
  const ppfs = (await client.readContract({ address: info.vault, abi: BEEFY_VAULT_ABI, functionName: "getPricePerFullShare" })) as bigint;
  const clmShares = (params.vaultShares * ppfs) / BigInt(10) ** BigInt(18);
  calls.push(encodeContractCall(info.vault, BEEFY_VAULT_ABI, "withdraw", [params.vaultShares]));
  steps.push({ kind: "unstake", label: "Unstake from the vault" });

  const [a0, a1] = (await client.readContract({ address: info.clm, abi: CLM_ABI, functionName: "previewWithdraw", args: [clmShares] })) as readonly [bigint, bigint];
  const min0 = minus(a0, Math.max(50, slip));
  const min1 = minus(a1, Math.max(50, slip));
  calls.push(encodeContractCall(info.clm, CLM_ABI, "withdraw", [clmShares, min0, min1]));
  steps.push({ kind: "withdraw", label: `Remove liquidity → ${info.token0.symbol} + ${info.token1.symbol}` });

  let out0 = min0;
  let out1 = min1;
  if (params.toToken0 && min1 > BigInt(0)) {
    const q = await quoteSlipstreamExactIn(info.token1.address, info.token0.address, min1);
    if (q.hasLiquidity) {
      const min = minus(q.amountOut, slip);
      calls.push(encodeContractCall(info.token1.address, erc20Abi, "approve", [q.router, min1]));
      calls.push(
        buildContractCall(
          q.router,
          encodeSlipstreamExactInput({ tokenIn: info.token1.address, tokenOut: info.token0.address, recipient: user, amountIn: min1, amountOutMinimum: min, tickSpacing: q.tickSpacing })
        )
      );
      steps.push({ kind: "swap", label: `Swap ${info.token1.symbol} → ${info.token0.symbol}` });
      out0 += min;
      out1 = BigInt(0);
    }
  }
  return {
    steps,
    calls,
    expected: {
      out0,
      out1,
      clmShares,
      valueInToken0: toNum(out0, info.token0.decimals) + toNum(out1, info.token1.decimals) * info.priceToken1InToken0,
    },
  };
}
