import { NextResponse } from "next/server";
import { parseUnits, type Address } from "viem";
import { WETH_BASE } from "@/lib/launchpad/uniswap";
import { splitGrossAmount } from "@/lib/launchpad/fees";
import { quoteLaunchSwap, type LaunchDex } from "@/lib/launchpad/dex";
import { getLaunchedToken } from "@/lib/launchpad/token-store";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { evaluateAntiSnipe } from "@/lib/launchpad/anti-snipe";
import { ensurePoolOpenBlock } from "@/lib/launchpad/token-protection";
import { feeShareLabels } from "@/lib/launchpad/fee-split";

export const dynamic = "force-dynamic";

function parseDex(raw: string | null): LaunchDex {
  if (raw === "uniswap" || raw === "aerodrome" || raw === "auto") return raw;
  return "auto";
}

function isAddressLike(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token")?.trim().toLowerCase();
  const direction = searchParams.get("direction") === "sell" ? "sell" : "buy";
  const amount = searchParams.get("amount")?.trim();
  const decimals = parseInt(searchParams.get("decimals") || "18", 10);
  const slippageBps = parseInt(searchParams.get("slippageBps") || "100", 10);
  const dex = parseDex(searchParams.get("dex"));
  const referrer = searchParams.get("referrer")?.trim().toLowerCase() || null;

  if (!token || !token.startsWith("0x") || token.length !== 42 || !amount) {
    return NextResponse.json({ error: "Invalid quote params" }, { status: 400 });
  }

  const amountNum = parseFloat(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  try {
    const tokenAddr = token as Address;
    const weth = WETH_BASE as Address;
    const registered = await getLaunchedToken(token);
    const pub = createBasePublicClient();
    const currentBlock = Number(await pub.getBlockNumber());

    const antiSnipe = evaluateAntiSnipe({
      currentBlock,
      poolOpenBlock: registered?.poolOpenBlock,
      antiSnipeBlocks: registered?.antiSnipeBlocks,
      direction,
    });

    if (antiSnipe.active) {
      return NextResponse.json({
        hasLiquidity: false,
        error: antiSnipe.message || "Anti-snipe window active — buys temporarily blocked",
        antiSnipe,
      });
    }

    const feeShares = feeShareLabels();
    const creator = registered?.creator as `0x${string}` | undefined;

    if (direction === "buy") {
      const gross = parseUnits(amount, 18);
      if (gross <= BigInt(0)) {
        return NextResponse.json({ error: "Invalid ETH amount" }, { status: 400 });
      }
      const { net: amountIn, fee: platformFee } = splitGrossAmount(gross);
      if (amountIn <= BigInt(0)) {
        return NextResponse.json({ error: "Amount too small after fee" }, { status: 400 });
      }
      const quote = await quoteLaunchSwap({
        token: tokenAddr,
        direction: "buy",
        amountIn,
        slippageBps,
        dex,
      });

      if (quote.hasLiquidity && registered && !registered.poolOpenBlock) {
        await ensurePoolOpenBlock(token, currentBlock);
      }

      return NextResponse.json({
        direction: "buy",
        dex: quote.dex,
        router: quote.router,
        amountIn: amountIn.toString(),
        amountOut: quote.amountOut.toString(),
        amountOutMinimum: quote.amountOutMinimum.toString(),
        platformFee: platformFee.toString(),
        grossAmount: gross.toString(),
        hasLiquidity: quote.hasLiquidity,
        uniswapHasLiquidity: quote.uniswapHasLiquidity,
        aerodromeHasLiquidity: quote.aerodromeHasLiquidity,
        uniswapFeeTier: quote.uniswapFeeTier,
        aerodromeStable: quote.aerodromeStable,
        tokenIn: weth,
        tokenOut: tokenAddr,
        creator,
        referrer: isAddressLike(referrer || "") ? referrer : null,
        feeShares,
        antiSnipe,
      });
    }

    const dec = Math.min(18, Math.max(6, decimals));
    const gross = parseUnits(amount, dec);
    if (gross <= BigInt(0)) {
      return NextResponse.json({ error: "Invalid token amount" }, { status: 400 });
    }
    const { net: amountIn, fee: platformFee } = splitGrossAmount(gross);
    if (amountIn <= BigInt(0)) {
      return NextResponse.json({ error: "Amount too small after fee" }, { status: 400 });
    }
    const quote = await quoteLaunchSwap({
      token: tokenAddr,
      direction: "sell",
      amountIn,
      slippageBps,
      dex,
    });

    if (quote.hasLiquidity && registered && !registered.poolOpenBlock) {
      await ensurePoolOpenBlock(token, currentBlock);
    }

    return NextResponse.json({
      direction: "sell",
      dex: quote.dex,
      router: quote.router,
      amountIn: amountIn.toString(),
      amountOut: quote.amountOut.toString(),
      amountOutMinimum: quote.amountOutMinimum.toString(),
      platformFee: platformFee.toString(),
      grossAmount: gross.toString(),
      hasLiquidity: quote.hasLiquidity,
      uniswapHasLiquidity: quote.uniswapHasLiquidity,
      aerodromeHasLiquidity: quote.aerodromeHasLiquidity,
      uniswapFeeTier: quote.uniswapFeeTier,
      aerodromeStable: quote.aerodromeStable,
      tokenIn: tokenAddr,
      tokenOut: weth,
      creator,
      referrer: isAddressLike(referrer || "") ? referrer : null,
      feeShares,
      antiSnipe,
    });
  } catch (err) {
    console.error("[launchpad/quote]", err);
    const msg =
      err instanceof Error && err.message.includes("Number")
        ? "Invalid amount format"
        : "Quote failed — add liquidity on Uniswap or Aerodrome";
    return NextResponse.json({
      hasLiquidity: false,
      error: msg,
    });
  }
}
