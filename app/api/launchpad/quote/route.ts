import { NextResponse } from "next/server";
import { parseUnits, type Address } from "viem";
import {
  WETH_BASE,
  applySlippage,
  quoteUniswapFeeTier,
} from "@/lib/launchpad/uniswap";
import { quoteAerodromeRoute } from "@/lib/launchpad/aerodrome";
import { quoteSlipstreamTickSpacing } from "@/lib/launchpad/slipstream";
import {
  estimatePriceImpactBps,
  type MarginalProbe,
} from "@/lib/launchpad/price-impact";
import { splitGrossAmount } from "@/lib/launchpad/fees";
import { fetchErc20Decimals } from "@/lib/launchpad/erc20-meta";
import { quoteLaunchSwap, type LaunchDex } from "@/lib/launchpad/dex";
import {
  fetchZeroXPrice,
  fetchZeroXQuote,
  zeroXConfigured,
} from "@/lib/launchpad/zerox";
import { getLaunchedToken } from "@/lib/launchpad/token-store";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { evaluateAntiSnipe } from "@/lib/launchpad/anti-snipe";
import { ensurePoolOpenBlock } from "@/lib/launchpad/token-protection";
import { feeShareLabels } from "@/lib/launchpad/fee-split";
import {
  parseSwapAsset,
  resolveSwapLegs,
} from "@/lib/launchpad/swap-assets";

export const dynamic = "force-dynamic";

function parseDex(raw: string | null): LaunchDex {
  if (raw === "uniswap" || raw === "aerodrome" || raw === "slipstream" || raw === "auto") {
    return raw;
  }
  return "auto";
}

function isAddressLike(a: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

async function tryAggregatorQuote(opts: {
  sellToken: string;
  buyToken: string;
  amountIn: bigint;
  slippageBps: number;
  taker: string | null;
}): Promise<{
  hasLiquidity: boolean;
  amountOut: bigint;
  amountOutMinimum: bigint;
  tx: { to: string; data: string; value: string } | null;
  allowanceSpender: string | null;
} | null> {
  if (!zeroXConfigured()) return null;

  if (opts.taker && isAddressLike(opts.taker)) {
    const quote = await fetchZeroXQuote({
      sellToken: opts.sellToken,
      buyToken: opts.buyToken,
      sellAmount: opts.amountIn,
      slippageBps: opts.slippageBps,
      taker: opts.taker,
    });
    if (!quote.liquidityAvailable || !quote.to || !quote.data) return null;
    return {
      hasLiquidity: true,
      amountOut: quote.buyAmount,
      amountOutMinimum:
        quote.minBuyAmount > BigInt(0)
          ? quote.minBuyAmount
          : applySlippage(quote.buyAmount, opts.slippageBps),
      tx: { to: quote.to, data: quote.data, value: quote.value.toString() },
      allowanceSpender: quote.allowanceSpender,
    };
  }

  const price = await fetchZeroXPrice({
    sellToken: opts.sellToken,
    buyToken: opts.buyToken,
    sellAmount: opts.amountIn,
    slippageBps: opts.slippageBps,
  });
  if (!price.liquidityAvailable) return null;
  return {
    hasLiquidity: true,
    amountOut: price.buyAmount,
    amountOutMinimum:
      price.minBuyAmount > BigInt(0)
        ? price.minBuyAmount
        : applySlippage(price.buyAmount, opts.slippageBps),
    tx: null,
    allowanceSpender: null,
  };
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
  const taker = searchParams.get("taker")?.trim().toLowerCase() || null;
  const payAsset = parseSwapAsset(searchParams.get("payAsset"), "eth");
  const receiveAsset = parseSwapAsset(searchParams.get("receiveAsset"), "eth");
  const payToken = searchParams.get("payToken")?.trim().toLowerCase() || null;
  const receiveToken = searchParams.get("receiveToken")?.trim().toLowerCase() || null;
  const counterDecimals = parseInt(searchParams.get("counterDecimals") || "18", 10);
  const includeAggregator = searchParams.get("includeAggregator") === "1";

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
    const pageDecimals = await fetchErc20Decimals(tokenAddr, decimals);
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

    const legs = resolveSwapLegs({
      pageToken: tokenAddr,
      direction,
      payAsset,
      receiveAsset,
      payToken,
      receiveToken,
      pageDecimals,
      counterDecimals,
    });
    if (!legs) {
      return NextResponse.json(
        { hasLiquidity: false, error: "Invalid pay/receive token configuration" },
        { status: 400 }
      );
    }

    const feeShares = feeShareLabels();
    const creator = registered?.creator as `0x${string}` | undefined;

    const gross = parseUnits(amount, legs.amountDecimals);
    if (gross <= BigInt(0)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    const { net: amountIn, fee: platformFee } = splitGrossAmount(gross);
    if (amountIn <= BigInt(0)) {
      return NextResponse.json({ error: "Amount too small after fee" }, { status: 400 });
    }

    const base = {
      direction,
      payAsset: legs.payAsset,
      receiveAsset: legs.receiveAsset,
      payToken: payAsset === "token" ? payToken : null,
      receiveToken: receiveAsset === "token" ? receiveToken : null,
      amountIn: amountIn.toString(),
      platformFee: platformFee.toString(),
      grossAmount: gross.toString(),
      tokenIn: legs.sellToken,
      tokenOut: legs.buyToken,
      outDecimals: legs.outDecimals,
      creator,
      referrer: isAddressLike(referrer || "") ? referrer : null,
      feeShares,
      antiSnipe,
      aggregatorConfigured: zeroXConfigured(),
    };

    let directQuote: Awaited<ReturnType<typeof quoteLaunchSwap>> | null = null;
    if (legs.canUseDirectDex) {
      directQuote = await quoteLaunchSwap({
        token: tokenAddr,
        direction,
        amountIn,
        slippageBps,
        dex,
      });
    }

    const aggQuote = await tryAggregatorQuote({
      sellToken: legs.sellToken,
      buyToken: legs.buyToken,
      amountIn,
      slippageBps,
      taker,
    });

    const aggregatorSidecar =
      includeAggregator && aggQuote
        ? {
            aggregatorHasLiquidity: true,
            aggregatorAmountOut: aggQuote.amountOut.toString(),
            aggregatorAmountOutMinimum: aggQuote.amountOutMinimum.toString(),
          }
        : includeAggregator
          ? { aggregatorHasLiquidity: false, aggregatorAmountOut: "0" }
          : {};

    const directPayload = directQuote
      ? {
          uniswapHasLiquidity: directQuote.uniswapHasLiquidity,
          aerodromeHasLiquidity: directQuote.aerodromeHasLiquidity,
          slipstreamHasLiquidity: directQuote.slipstreamHasLiquidity,
          uniswapFeeTier: directQuote.uniswapFeeTier,
          aerodromeStable: directQuote.aerodromeStable,
          slipstreamTickSpacing: directQuote.slipstreamTickSpacing,
        }
      : {
          uniswapHasLiquidity: false,
          aerodromeHasLiquidity: false,
          slipstreamHasLiquidity: false,
        };

    const pickBest = () => {
      const directOut =
        directQuote?.hasLiquidity && legs.canUseDirectDex ? directQuote.amountOut : BigInt(0);
      const aggOut = aggQuote?.hasLiquidity ? aggQuote.amountOut : BigInt(0);

      if (dex !== "auto" && legs.canUseDirectDex && directQuote?.hasLiquidity) {
        return {
          kind: "direct" as const,
          out: directQuote.amountOut,
          min: directQuote.amountOutMinimum,
          dex: directQuote.dex,
          router: directQuote.router,
        };
      }

      if (dex === "auto") {
        // Prefer direct DEX when liquidity exists — 0x calldata is fragile in smart wallets.
        const aggMuchBetter =
          aggOut > BigInt(0) &&
          directOut > BigInt(0) &&
          aggOut > (directOut * BigInt(103)) / BigInt(100);

        if (directOut > BigInt(0) && directQuote && !aggMuchBetter) {
          return {
            kind: "direct" as const,
            out: directQuote.amountOut,
            min: directQuote.amountOutMinimum,
            dex: directQuote.dex,
            router: directQuote.router,
          };
        }

        if (aggOut > directOut && aggQuote) {
          return {
            kind: "aggregator" as const,
            out: aggQuote.amountOut,
            min: aggQuote.amountOutMinimum,
            dex: "aggregator" as const,
            router: aggQuote.tx?.to ?? null,
            tx: aggQuote.tx,
            allowanceSpender: aggQuote.allowanceSpender,
          };
        }
        if (directOut > BigInt(0) && directQuote) {
          return {
            kind: "direct" as const,
            out: directQuote.amountOut,
            min: directQuote.amountOutMinimum,
            dex: directQuote.dex,
            router: directQuote.router,
          };
        }
        if (aggQuote) {
          return {
            kind: "aggregator" as const,
            out: aggQuote.amountOut,
            min: aggQuote.amountOutMinimum,
            dex: "aggregator" as const,
            router: aggQuote.tx?.to ?? null,
            tx: aggQuote.tx,
            allowanceSpender: aggQuote.allowanceSpender,
          };
        }
      }

      if (!legs.canUseDirectDex && aggQuote?.hasLiquidity) {
        return {
          kind: "aggregator" as const,
          out: aggQuote.amountOut,
          min: aggQuote.amountOutMinimum,
          dex: "aggregator" as const,
          router: aggQuote.tx?.to ?? null,
          tx: aggQuote.tx,
          allowanceSpender: aggQuote.allowanceSpender,
        };
      }

      return null;
    };

    /**
     * Re-quotes the winning route with a sliver of the order so impact can be
     * measured against the pool being traded rather than an external price
     * feed. Reuses the already-chosen fee tier / tick spacing / pool type, so
     * it costs exactly one extra call.
     *
     * Only direct venues can be probed: the aggregator re-plans its route per
     * request, so a small probe and the real order are frequently priced on
     * different paths. Measured that way, "impact" came out *falling* as the
     * order grew — an artifact of route switching, not depth — so aggregator
     * routes report no impact rather than a confident wrong number.
     */
    const probeForRoute = (
      route: NonNullable<ReturnType<typeof pickBest>>
    ): MarginalProbe | null => {
      if (route.kind === "aggregator") return null;

      const dirIn = direction === "buy" ? weth : tokenAddr;
      const dirOut = direction === "buy" ? tokenAddr : weth;

      if (route.dex === "uniswap" && directQuote?.uniswapFeeTier) {
        const fee = directQuote.uniswapFeeTier;
        return (probeIn) => quoteUniswapFeeTier(dirIn, dirOut, probeIn, fee);
      }
      if (route.dex === "aerodrome") {
        const stable = directQuote?.aerodromeStable ?? false;
        return async (probeIn) =>
          (await quoteAerodromeRoute(dirIn, dirOut, probeIn, stable)).amountOut;
      }
      if (route.dex === "slipstream" && directQuote?.slipstreamTickSpacing) {
        const spacing = directQuote.slipstreamTickSpacing;
        return (probeIn) =>
          quoteSlipstreamTickSpacing(dirIn, dirOut, probeIn, spacing);
      }
      return null;
    };

    const best = pickBest();
    if (best && best.out > BigInt(0)) {
      if (registered && !registered.poolOpenBlock) {
        await ensurePoolOpenBlock(token, currentBlock);
      }

      const probe = probeForRoute(best);
      const priceImpactBps = probe
        ? await estimatePriceImpactBps({
            amountIn,
            amountOut: best.out,
            probe,
          })
        : null;

      if (best.kind === "aggregator") {
        return NextResponse.json({
          ...base,
          ...directPayload,
          ...aggregatorSidecar,
          dex: "aggregator",
          router: best.router,
          amountOut: best.out.toString(),
          amountOutMinimum: best.min.toString(),
          hasLiquidity: true,
          priceImpactBps,
          aggregator: true,
          tx: best.tx ?? null,
          allowanceSpender: best.allowanceSpender ?? null,
        });
      }
      return NextResponse.json({
        ...base,
        ...directPayload,
        ...aggregatorSidecar,
        dex: best.dex,
        router: best.router,
        amountOut: best.out.toString(),
        amountOutMinimum: best.min.toString(),
        hasLiquidity: true,
        priceImpactBps,
      });
    }

    if (includeAggregator) {
      return NextResponse.json({
        ...base,
        ...directPayload,
        ...aggregatorSidecar,
        dex: directQuote?.dex ?? "uniswap",
        router: directQuote?.router ?? weth,
        amountOut: "0",
        amountOutMinimum: "0",
        hasLiquidity: false,
      });
    }

    return NextResponse.json({
      ...base,
      ...directPayload,
      dex: directQuote?.dex ?? "uniswap",
      router: directQuote?.router ?? weth,
      amountOut: "0",
      amountOutMinimum: "0",
      hasLiquidity: false,
      aggregatorConfigured: zeroXConfigured(),
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
