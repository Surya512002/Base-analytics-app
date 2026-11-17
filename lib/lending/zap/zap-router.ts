/**
 * Atomic Smart Deposit / Withdraw through Beefy's Zap Router (audited, deployed on Base).
 *
 * Why: executed call-by-call from a wallet, a pair deposit is 4–7 transactions on browser
 * wallets (approve → swap → approve × 2 → deposit → approve → stake). Each one is signed and
 * mined separately, so the plan goes stale between steps (the min-shares guard then reverts
 * mid-way), and an early failure leaves approvals or half-swapped tokens behind.
 *
 * Through the router the user signs at most two things:
 *   1. approve(TokenManager, exact amount): skipped when the allowance already covers it.
 *      The TokenManager can only pull for an order the user themselves executes
 *      (order.user must be msg.sender), and the amount is consumed in full.
 *   2. executeOrder(order, route): every swap, the liquidity add and the stake run inside one
 *      transaction. The router checks each output against its minimum and returns every
 *      leftover token to the user, so it either completes or reverts with nothing changed.
 * The router approves the swap router / CLM / vault for ITS OWN balance during the route; the
 * user never approves those contracts.
 *
 * Every call still goes through encodeContractCall → Base builder code.
 */
import { encodeFunctionData, erc20Abi, getAddress, type Address, type Hex } from "viem";
import { encodeContractCall, type ContractCall } from "@/lib/utils/tx";
import { encodeSlipstreamExactInput, quoteSlipstreamExactIn } from "@/lib/launchpad/slipstream";
import {
  BEEFY_VAULT_ABI,
  CLM_ABI,
  computeClmDeposit,
  encodeClmLeg,
  type ClmDepositPlan,
  type ClmVault,
  type ClmWithdrawPlan,
  type PayAsset,
  type ZapClient,
} from "@/lib/lending/zap/clm-zap";
import { WETH_BASE } from "@/lib/launchpad/uniswap";

/** Beefy Zap Router + its TokenManager on Base (bytecode selectors verified on-chain). */
export const BEEFY_ZAP_ROUTER = getAddress("0x6F19Da51d488926C007B9eBaa5968291a2eC6a63");
export const BEEFY_TOKEN_MANAGER = getAddress("0x3fBD1da78369864c67d62c242d30983d6900c0f0");
const NATIVE = "0x0000000000000000000000000000000000000000" as Address;

export const ZAP_ROUTER_ABI = [
  {
    type: "function",
    name: "executeOrder",
    stateMutability: "payable",
    inputs: [
      {
        name: "_order",
        type: "tuple",
        components: [
          { name: "inputs", type: "tuple[]", components: [{ name: "token", type: "address" }, { name: "amount", type: "uint256" }] },
          { name: "outputs", type: "tuple[]", components: [{ name: "token", type: "address" }, { name: "minOutputAmount", type: "uint256" }] },
          { name: "relay", type: "tuple", components: [{ name: "target", type: "address" }, { name: "value", type: "uint256" }, { name: "data", type: "bytes" }] },
          { name: "user", type: "address" },
          { name: "recipient", type: "address" },
        ],
      },
      {
        name: "_route",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "value", type: "uint256" },
          { name: "data", type: "bytes" },
          { name: "tokens", type: "tuple[]", components: [{ name: "token", type: "address" }, { name: "index", type: "int32" }] },
        ],
      },
    ],
    outputs: [],
  },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
] as const;

/**
 * A route step. Each `tokens` entry makes the router approve `target` for its whole balance of
 * that token; with `index` ≥ 0 it also writes that balance into `data` at that byte offset.
 */
export type ZapStep = { target: Address; value: bigint; data: Hex; tokens: Array<{ token: Address; index: number }> };
export type ZapOrder = {
  inputs: Array<{ token: Address; amount: bigint }>;
  outputs: Array<{ token: Address; minOutputAmount: bigint }>;
  user: Address;
  recipient: Address;
};

/** Byte offsets of injected amounts (selector = 4 bytes). */
export const OFFSET = {
  /** deposit(uint256 _amount0, ...), withdraw(uint256 shares, ...) */
  arg0: 4,
  arg1: 36,
  /** exactInputSingle((tokenIn, tokenOut, tickSpacing, recipient, deadline, amountIn, ...)) */
  exactInputSingleAmountIn: 4 + 5 * 32,
} as const;

export function encodeExecuteOrder(order: ZapOrder, route: ZapStep[]): Hex {
  return encodeFunctionData({
    abi: ZAP_ROUTER_ABI,
    functionName: "executeOrder",
    args: [
      {
        inputs: order.inputs,
        outputs: order.outputs,
        relay: { target: NATIVE, value: BigInt(0), data: "0x" },
        user: order.user,
        recipient: order.recipient,
      },
      route.map((s) => ({ target: s.target, value: s.value, data: s.data, tokens: s.tokens })),
    ],
  });
}

/** The user's calls: an exact approval to the TokenManager only if needed, then the order. */
async function buildUserCalls(
  client: ZapClient,
  user: Address,
  input: { token: Address; amount: bigint },
  order: ZapOrder,
  route: ZapStep[]
): Promise<{ calls: ContractCall[]; approved: boolean }> {
  const calls: ContractCall[] = [];
  let approved = false;
  const native = input.token === NATIVE;
  if (!native) {
    const allowance = (await client.readContract({
      address: input.token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [user, BEEFY_TOKEN_MANAGER],
    })) as bigint;
    if (allowance < input.amount) {
      calls.push(encodeContractCall(input.token, erc20Abi, "approve", [BEEFY_TOKEN_MANAGER, input.amount]));
      approved = true;
    }
  }
  calls.push(encodeContractCall(BEEFY_ZAP_ROUTER, ZAP_ROUTER_ABI as never, "executeOrder", [
    {
      inputs: order.inputs,
      outputs: order.outputs,
      relay: { target: NATIVE, value: BigInt(0), data: "0x" },
      user: order.user,
      recipient: order.recipient,
    },
    route,
  ], native ? input.amount : undefined));
  return { calls, approved };
}

const uniq = (xs: Address[]) => [...new Map(xs.map((x) => [x.toLowerCase(), x])).values()];

/** Whether the router is live (not paused). Callers fall back to wallet execution when not. */
export async function zapRouterAvailable(client: ZapClient): Promise<boolean> {
  try {
    return !((await client.readContract({ address: BEEFY_ZAP_ROUTER, abi: ZAP_ROUTER_ABI, functionName: "paused" })) as boolean);
  } catch {
    return false;
  }
}

/** Smart Deposit as one atomic order: pay USDC, the stock or ETH → swap → add liquidity → stake. */
export async function planClmDepositZap(params: {
  client: ZapClient;
  info: ClmVault;
  user: Address;
  pay: PayAsset;
  amount: bigint;
  slippageBps?: number;
}): Promise<ClmDepositPlan & { router: true }> {
  const { client, info, user, pay, amount } = params;
  const core = await computeClmDeposit(params);
  const t0 = info.token0;
  const t1 = info.token1;
  const payToken = pay === "eth" ? NATIVE : pay === "token0" ? t0.address : t1.address;

  const route: ZapStep[] = [];
  const touched: Address[] = [t0.address, t1.address];
  for (const leg of core.legs) {
    if (leg.kind === "wrap") {
      route.push({ target: WETH_BASE as Address, value: leg.amount, data: "0xd0e30db0", tokens: [] }); // deposit()
      continue;
    }
    const { value, data } = encodeClmLeg(leg, BEEFY_ZAP_ROUTER);
    route.push({
      target: leg.router,
      value,
      data,
      // Later hops spend exactly what the previous hop delivered.
      tokens: leg.tokenIn === "eth" ? [] : [{ token: leg.tokenIn, index: leg.chained ? OFFSET.exactInputSingleAmountIn : -1 }],
    });
    if (leg.tokenIn !== "eth") touched.push(leg.tokenIn);
    touched.push(leg.tokenOut);
  }
  // Deposit whatever the router now holds; the CLM takes its ratio, the rest goes back to the user.
  route.push({
    target: info.clm,
    value: BigInt(0),
    data: encodeFunctionData({ abi: CLM_ABI, functionName: "deposit", args: [BigInt(0), BigInt(0), core.minShares] }),
    tokens: [
      { token: t0.address, index: OFFSET.arg0 },
      { token: t1.address, index: OFFSET.arg1 },
    ],
  });
  route.push({ target: info.vault, value: BigInt(0), data: encodeFunctionData({ abi: BEEFY_VAULT_ABI, functionName: "depositAll" }), tokens: [{ token: info.clm, index: -1 }] });

  const ppfs = (await client.readContract({ address: info.vault, abi: BEEFY_VAULT_ABI, functionName: "getPricePerFullShare" })) as bigint;
  const minVaultShares = (core.minShares * BigInt(10) ** BigInt(18)) / (ppfs > BigInt(0) ? ppfs : BigInt(1));
  const order: ZapOrder = {
    inputs: [{ token: payToken, amount }],
    outputs: [
      { token: info.vault, minOutputAmount: minVaultShares },
      ...uniq(touched)
        .filter((t) => t.toLowerCase() !== info.vault.toLowerCase())
        .map((token) => ({ token, minOutputAmount: BigInt(0) })),
    ],
    user,
    recipient: user,
  };
  const { calls, approved } = await buildUserCalls(client, user, { token: payToken, amount }, order, route);
  const paySym = pay === "eth" ? "ETH" : pay === "token0" ? t0.symbol : t1.symbol;
  const steps: ClmDepositPlan["steps"] = [
    ...(approved ? [{ kind: "approve" as const, label: `Approve exactly this ${paySym} for Beefy's audited zap (used in full)` }] : []),
    ...core.swapLabels.map((label) => ({ kind: "swap" as const, label })),
    { kind: "deposit", label: `Add liquidity to the ${t1.symbol}/${t0.symbol} pool` },
    { kind: "stake", label: "Stake into the auto-compounding vault" },
  ];
  return {
    router: true,
    steps,
    calls,
    expected: {
      deposit0: core.used0,
      deposit1: core.used1,
      minClmShares: core.minShares,
      valueInToken0: Number(core.used0) / 10 ** t0.decimals + (Number(core.used1) / 10 ** t1.decimals) * info.priceToken1InToken0,
    },
    warnings: core.warnings.map((w) => w.replace("will stay in your wallet", "comes back to your wallet")),
  };
}

const minusBps = (x: bigint, bps: number) => (x * BigInt(10_000 - bps)) / BigInt(10_000);

/** Withdraw as one atomic order: vault shares (or CoW shares) → both tokens, or all token0. */
export async function planClmWithdrawZap(params: {
  client: ZapClient;
  info: ClmVault;
  user: Address;
  vaultShares?: bigint;
  clmShares?: bigint;
  toToken0?: boolean;
  slippageBps?: number;
}): Promise<ClmWithdrawPlan & { router: true }> {
  const { client, info, user } = params;
  const slip = params.slippageBps ?? 100;
  const fromVault = params.clmShares === undefined;
  const inputShares = fromVault ? params.vaultShares ?? BigInt(0) : params.clmShares!;
  if (inputShares <= BigInt(0)) throw new Error("Nothing to withdraw");

  let clmShares = inputShares;
  const route: ZapStep[] = [];
  const steps: ClmWithdrawPlan["steps"] = [];
  if (fromVault) {
    const ppfs = (await client.readContract({ address: info.vault, abi: BEEFY_VAULT_ABI, functionName: "getPricePerFullShare" })) as bigint;
    clmShares = (inputShares * ppfs) / BigInt(10) ** BigInt(18);
    route.push({
      target: info.vault,
      value: BigInt(0),
      data: encodeFunctionData({ abi: BEEFY_VAULT_ABI, functionName: "withdraw", args: [BigInt(0)] }),
      tokens: [{ token: info.vault, index: OFFSET.arg0 }],
    });
    steps.push({ kind: "unstake", label: "Unstake from the vault" });
  }
  const [a0, a1] = (await client.readContract({ address: info.clm, abi: CLM_ABI, functionName: "previewWithdraw", args: [clmShares] })) as readonly [bigint, bigint];
  const min0 = minusBps(a0, Math.max(50, slip));
  const min1 = minusBps(a1, Math.max(50, slip));
  route.push({
    target: info.clm,
    value: BigInt(0),
    data: encodeFunctionData({ abi: CLM_ABI, functionName: "withdraw", args: [BigInt(0), min0, min1] }),
    tokens: [{ token: info.clm, index: OFFSET.arg0 }],
  });
  steps.push({ kind: "withdraw", label: `Remove liquidity → ${info.token0.symbol} + ${info.token1.symbol}` });

  let out0 = min0;
  let out1 = min1;
  if (params.toToken0 && min1 > BigInt(0)) {
    const q = await quoteSlipstreamExactIn(info.token1.address, info.token0.address, min1);
    if (q.hasLiquidity) {
      const min = minusBps(q.amountOut, slip);
      route.push({
        target: q.router,
        value: BigInt(0),
        // amountIn is overwritten with everything the router received, so nothing is left over.
        data: encodeSlipstreamExactInput({ tokenIn: info.token1.address, tokenOut: info.token0.address, recipient: BEEFY_ZAP_ROUTER, amountIn: min1, amountOutMinimum: min, tickSpacing: q.tickSpacing }),
        tokens: [{ token: info.token1.address, index: OFFSET.exactInputSingleAmountIn }],
      });
      steps.push({ kind: "swap", label: `Swap ${info.token1.symbol} → ${info.token0.symbol}` });
      out0 += min;
      out1 = BigInt(0);
    }
  }
  const inputToken = fromVault ? info.vault : info.clm;
  const order: ZapOrder = {
    inputs: [{ token: inputToken, amount: inputShares }],
    outputs: [
      { token: info.token0.address, minOutputAmount: out0 },
      { token: info.token1.address, minOutputAmount: out1 },
    ],
    user,
    recipient: user,
  };
  const { calls, approved } = await buildUserCalls(client, user, { token: inputToken, amount: inputShares }, order, route);
  if (approved) steps.unshift({ kind: "approve", label: "Approve exactly these shares for Beefy's audited zap (used in full)" });
  return {
    router: true,
    steps,
    calls,
    expected: {
      out0,
      out1,
      clmShares,
      valueInToken0: Number(out0) / 10 ** info.token0.decimals + (Number(out1) / 10 ** info.token1.decimals) * info.priceToken1InToken0,
    },
  };
}

/**
 * "Get {stock}" paid with ETH as one transaction and no approval: the router swaps
 * ETH → USDC → stock and enforces the minimum on-chain. (Paying USDC stays a direct
 * approve + swap: the same two signatures, without the router hop.)
 */
export async function planGetTokenWithEthZap(params: {
  user: Address;
  amount: bigint;
  tokenOut: Address;
  tokenOutSymbol: string;
  slippageBps?: number;
}): Promise<{ steps: string[]; calls: ContractCall[]; minOut: bigint; quotedOut: bigint; router: true }> {
  const { user, amount, tokenOut, tokenOutSymbol } = params;
  const slip = params.slippageBps ?? 100;
  if (amount <= BigInt(0)) throw new Error("Enter an amount");
  const usdc = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
  const q1 = await quoteSlipstreamExactIn(WETH_BASE as Address, usdc, amount);
  if (!q1.hasLiquidity) throw new Error("No ETH → USDC route right now");
  const usdcMin = minusBps(q1.amountOut, slip);
  const route: ZapStep[] = [
    { target: q1.router, value: amount, data: encodeClmLeg({ kind: "swap", router: q1.router, tokenIn: "eth", tokenOut: usdc, amountIn: amount, amountOutMinimum: usdcMin, tickSpacing: q1.tickSpacing, chained: false }, BEEFY_ZAP_ROUTER).data, tokens: [] },
  ];
  let minOut = usdcMin;
  let quotedOut = q1.amountOut;
  const outputs: ZapOrder["outputs"] = [];
  if (tokenOut.toLowerCase() !== usdc.toLowerCase()) {
    const q2 = await quoteSlipstreamExactIn(usdc, tokenOut, usdcMin);
    if (!q2.hasLiquidity) throw new Error(`No USDC → ${tokenOutSymbol} route right now`);
    minOut = minusBps(q2.amountOut, slip);
    quotedOut = q2.amountOut;
    route.push({
      target: q2.router,
      value: BigInt(0),
      // Spend every USDC the first swap delivered.
      data: encodeSlipstreamExactInput({ tokenIn: usdc, tokenOut, recipient: BEEFY_ZAP_ROUTER, amountIn: usdcMin, amountOutMinimum: minOut, tickSpacing: q2.tickSpacing }),
      tokens: [{ token: usdc, index: OFFSET.exactInputSingleAmountIn }],
    });
    outputs.push({ token: usdc, minOutputAmount: BigInt(0) });
  }
  outputs.unshift({ token: tokenOut, minOutputAmount: minOut });
  const order: ZapOrder = { inputs: [{ token: NATIVE, amount }], outputs, user, recipient: user };
  const call = encodeContractCall(BEEFY_ZAP_ROUTER, ZAP_ROUTER_ABI as never, "executeOrder", [
    { inputs: order.inputs, outputs: order.outputs, relay: { target: NATIVE, value: BigInt(0), data: "0x" }, user, recipient: user },
    route,
  ], amount);
  return { steps: [`Swap ETH → USDC → ${tokenOutSymbol} in one transaction`], calls: [call], minOut, quotedOut, router: true };
}
