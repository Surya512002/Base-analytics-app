/**
 * "Get {stock} first": buy the token a vault or market needs without leaving the Lend page.
 *
 * Stock liquidity on Base sits in stock/USDC Slipstream pools, so the route is
 *   USDC → stock                      (one swap), or
 *   ETH → USDC → stock                (two swaps, same batch)
 * Each swap is quoted on-chain (SimQuoter on the pool itself), guarded by a minimum-out, and
 * paid with an exact approval. Every call is built with buildContractCall → builder code.
 */
import { erc20Abi, type Address } from "viem";
import { buildContractCall, encodeContractCall, type ContractCall } from "@/lib/utils/tx";
import { encodeSlipstreamBuy, encodeSlipstreamExactInput, quoteSlipstreamExactIn } from "@/lib/launchpad/slipstream";
import { WETH_BASE } from "@/lib/launchpad/uniswap";

export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;

export type GetTokenPlan = {
  steps: string[];
  calls: ContractCall[];
  /** Guaranteed minimum of the target token (after slippage). */
  minOut: bigint;
  /** Quoted amount of the target token. */
  quotedOut: bigint;
};

const BPS = BigInt(10_000);
const minus = (x: bigint, bps: number) => (x * (BPS - BigInt(bps))) / BPS;

export async function planGetToken(params: {
  user: Address;
  pay: "usdc" | "eth";
  amount: bigint;
  tokenOut: Address;
  tokenOutSymbol: string;
  slippageBps?: number;
}): Promise<GetTokenPlan> {
  const { user, pay, amount, tokenOut, tokenOutSymbol } = params;
  const slip = params.slippageBps ?? 100;
  const steps: string[] = [];
  const calls: ContractCall[] = [];
  if (amount <= BigInt(0)) throw new Error("Enter an amount");

  let usdcIn = amount;
  if (pay === "eth") {
    const q = await quoteSlipstreamExactIn(WETH_BASE as Address, USDC_ADDRESS, amount);
    if (!q.hasLiquidity) throw new Error("No ETH → USDC route right now");
    usdcIn = minus(q.amountOut, slip);
    calls.push(
      buildContractCall(
        q.router,
        encodeSlipstreamBuy({ tokenOut: USDC_ADDRESS, recipient: user, amountIn: amount, amountOutMinimum: usdcIn, tickSpacing: q.tickSpacing }),
        amount
      )
    );
    steps.push("Swap ETH → USDC");
  }

  if (tokenOut.toLowerCase() === USDC_ADDRESS.toLowerCase()) {
    return { steps, calls, minOut: usdcIn, quotedOut: usdcIn };
  }

  const q = await quoteSlipstreamExactIn(USDC_ADDRESS, tokenOut, usdcIn);
  if (!q.hasLiquidity) throw new Error(`No USDC → ${tokenOutSymbol} route right now`);
  const minOut = minus(q.amountOut, slip);
  calls.push(encodeContractCall(USDC_ADDRESS, erc20Abi, "approve", [q.router, usdcIn]));
  calls.push(
    buildContractCall(
      q.router,
      encodeSlipstreamExactInput({ tokenIn: USDC_ADDRESS, tokenOut, recipient: user, amountIn: usdcIn, amountOutMinimum: minOut, tickSpacing: q.tickSpacing })
    )
  );
  steps.push(`Swap USDC → ${tokenOutSymbol}`);
  return { steps, calls, minOut, quotedOut: q.amountOut };
}
