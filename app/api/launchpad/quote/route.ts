import { NextResponse } from "next/server";
import { parseUnits, type Address } from "viem";
import {
  WETH_BASE,
  applySlippage,
  quoteUniswapFeeTier,
} from "@/lib/launchpad/uniswap";
import { USDC_BASE } from "@/lib/launchpad/tokens-base";
import { quoteAerodromeRoute } from "@/lib/launchpad/aerodrome";
import { quoteSlipstreamTickSpacing } from "@/lib/launchpad/slipstream";
import {
  estimatePriceImpactBps,
  type MarginalProbe,
} from "@/lib/launchpad/price-impact";
import { splitGrossAmount } from "@/lib/launchpad/fees";
import { fetchErc20Decimals } from "@/lib/launchpad/erc20-meta";
import { sanitizeTokenAmountInput } from "@/lib/launchpad/token-amount";
import { quoteLaunchSwap, type LaunchDex } from "@/lib/launchpad/dex";
import { fetchDexScreenerBatch } from "@/lib/launchpad/dexscreener";
import { inferPreferredDex, pickRoutingPair } from "@/lib/launchpad/routing-pairs";
import {
  fetchZeroXPrice,
  fetchZeroXQuote,
  zeroXConfigured,
} from "@/lib/launchpad/zerox";
import { getLaunchedToken, isAppLaunchedToken } from "@/lib/launchpad/token-store";
import { resolveTokenCreator } from "@/lib/launchpad/resolve-creator";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { evaluateAntiSnipe } from "@/lib/launchpad/anti-snipe";
import { ensurePoolOpenBlock } from "@/lib/launchpad/token-protection";
import { feeShareLabels } from "@/lib/launchpad/fee-split";
import {
  parseSwapAsset,
  resolveSwapLegs,
} from "@/lib/launchpad/swap-assets";
import { fetchO1TradingQuote } from "@/lib/trading/o1-api";
import { getTokenizedStockByAddress, isActiveStockAddress } from "@/lib/stocks/tokenized-stocks-registry";
import { evaluateRegionCompliance, getComplianceConfig } from "@/src/config/compliance";

export const dynamic = "force-dynamic";

function parseDex(raw: string | null): LaunchDex {
  if (raw === "uniswap" || raw === "aerodrome" || raw === "slipstream" || raw === "o1" || raw === "auto") {
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
  const decimalsRaw = parseInt(searchParams.get("decimals") || "18", 10);
  const decimals = Number.isFinite(decimalsRaw) && decimalsRaw > 0 ? decimalsRaw : 18;
  const slippageBps = parseInt(searchParams.get("slippageBps") || "100", 10);
  const dex = parseDex(searchParams.get("dex"));
  const referrer = searchParams.get("referrer")?.trim().toLowerCase() || null;
  const taker = searchParams.get("taker")?.trim().toLowerCase() || null;
  const payAsset = parseSwapAsset(searchParams.get("payAsset"), "eth");
  const receiveAsset = parseSwapAsset(searchParams.get("receiveAsset"), "eth");
  const payToken = searchParams.get("payToken")?.trim().toLowerCase() || null;
  const receiveToken = searchParams.get("receiveToken")?.trim().toLowerCase() || null;
  const counterDecimalsRaw = parseInt(searchParams.get("counterDecimals") || "18", 10);
  const counterDecimals = Number.isFinite(counterDecimalsRaw) && counterDecimalsRaw > 0 ? counterDecimalsRaw : 18;
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
    const isStock = isActiveStockAddress(tokenAddr) || Boolean(getTokenizedStockByAddress(tokenAddr));

    if (isStock) {
      const country =
        req.headers.get("x-user-country") ||
        req.headers.get("x-vercel-ip-country") ||
        req.headers.get("cf-ipcountry") ||
        req.headers.get("x-mock-country") ||
        process.env.COMPLIANCE_MOCK_COUNTRY ||
        null;
      const compliance = evaluateRegionCompliance(country, "stocks.swap");

      // In exit-only or blocked mode, buying is rejected. Exiting (selling) is allowed.
      if (direction === "buy" && !compliance.canEnter) {
        return NextResponse.json(
          {
            hasLiquidity: false,
            error: compliance.reason || "Tokenized stock features are not available in your region.",
            isRestricted: true,
            complianceMode: compliance.mode,
            canExit: compliance.canExit,
          },
          { status: 403 }
        );
      }
    }

    const weth = WETH_BASE as Address;
    const pageDecimals = await fetchErc20Decimals(tokenAddr, decimals);
    const registered = await getLaunchedToken(token);
    const pub = createBasePublicClient();
    const currentBlock = Number(await pub.getBlockNumber());

    const antiSnipe = evaluateAntiSnipe({
      currentBlock,
      poolOpenBlock: registered?.poolOpenBlock,
      antiSnipeBlocks: registered?.antiSnipeBlocks,
      launchBlock: registered?.launchBlock,
      direction,
    });

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
    const creator =
      (registered?.creator as `0x${string}` | undefined) ??
      (await resolveTokenCreator(token)) ??
      undefined;

    const isLaunched = isAppLaunchedToken(registered) || Boolean(registered) || Boolean(creator);

    const isCreatorTaker = Boolean(
      taker && creator && taker.toLowerCase() === creator.toLowerCase()
    );
    if (antiSnipe.active && !isCreatorTaker) {
      return NextResponse.json({
        hasLiquidity: false,
        error: antiSnipe.message || "Anti-snipe window active — buys temporarily blocked",
        antiSnipe,
      });
    }

    const cleanAmount = sanitizeTokenAmountInput(amount, legs.amountDecimals);
    if (!cleanAmount || parseFloat(cleanAmount) <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const gross = parseUnits(cleanAmount, legs.amountDecimals);
    if (gross <= BigInt(0)) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    // Direct DEX swaps execute the full gross amount directly with builder code attribution
    const amountIn = gross;
    const { fee: platformFee } = splitGrossAmount(gross);

    // Apply safe default slippage for newly launched tokens (200 bps) and tokenized stock multi-hop pools (150 bps)
    const isStockTrade = isStock || (legs && (isActiveStockAddress(legs.sellToken) || isActiveStockAddress(legs.buyToken)));
    const effectiveSlippageBps = isLaunched ? Math.max(slippageBps, 200) : isStockTrade ? Math.max(slippageBps, 150) : slippageBps;

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
      isLaunchedToken: isLaunched,
      defaultSlippageBps: isLaunched ? 250 : 100,
      creatorFeeBps: isLaunched ? 25 : 0,
      platformFeeBps: isLaunched ? 25 : 50,
      antiSnipe,
      aggregatorConfigured: zeroXConfigured(),
    };

    let directQuote: Awaited<ReturnType<typeof quoteLaunchSwap>> | null = null;
    if (legs.canUseDirectDex) {
      const pairBatch = await fetchDexScreenerBatch([token]);
      const routing = pickRoutingPair(pairBatch.get(token) ?? [], token);
      const venueHint = inferPreferredDex(routing?.dexId);
      const quoteDex: LaunchDex = dex !== "auto" ? dex : venueHint ?? "auto";
      const isUsdcLeg = legs.payAsset === "usdc" || legs.receiveAsset === "usdc";
      const quoteToken = isUsdcLeg ? (USDC_BASE as Address) : (WETH_BASE as Address);

      directQuote = await quoteLaunchSwap({
        token: tokenAddr,
        direction,
        amountIn,
        slippageBps: effectiveSlippageBps,
        dex: quoteDex,
        quoteToken,
        allowUsdcHop: !isUsdcLeg,
      });
    }

    const aggQuote = await tryAggregatorQuote({
      sellToken: legs.sellToken,
      buyToken: legs.buyToken,
      amountIn,
      slippageBps: effectiveSlippageBps,
      taker,
    });

    const benchmarkOut = directQuote?.hasLiquidity
      ? directQuote.amountOut
      : aggQuote?.hasLiquidity
        ? aggQuote.amountOut
        : BigInt(0);

    const o1Quote = await fetchO1TradingQuote(
      {
        sellToken: legs.sellToken,
        buyToken: legs.buyToken,
        sellAmount: amountIn,
        slippageBps,
        taker,
      },
      benchmarkOut
    );

    const aggregatorSidecar =
      includeAggregator && aggQuote
        ? {
            aggregatorHasLiquidity: true,
            aggregatorAmountOut: aggQuote.amountOut.toString(),
            aggregatorAmountOutMinimum: aggQuote.amountOutMinimum.toString(),
            o1PriceImprovementBps: o1Quote?.priceImprovementBps ?? 25,
          }
        : includeAggregator
          ? {
              aggregatorHasLiquidity: false,
              aggregatorAmountOut: "0",
              o1PriceImprovementBps: o1Quote?.priceImprovementBps ?? 25,
            }
          : {};

    const directPayload = directQuote
      ? {
          uniswapHasLiquidity: directQuote.uniswapHasLiquidity,
          aerodromeHasLiquidity: directQuote.aerodromeHasLiquidity,
          slipstreamHasLiquidity: directQuote.slipstreamHasLiquidity,
          uniswapFeeTier: directQuote.uniswapFeeTier,
          uniswapPath: directQuote.uniswapPath,
          uniswapMultiHop: directQuote.uniswapMultiHop,
          aerodromeStable: directQuote.aerodromeStable,
          aerodromeHops: directQuote.aerodromeHops,
          slipstreamTickSpacing: directQuote.slipstreamTickSpacing,
          o1Available: Boolean(o1Quote?.hasLiquidity),
        }
      : {
          uniswapHasLiquidity: false,
          aerodromeHasLiquidity: false,
          slipstreamHasLiquidity: false,
          uniswapPath: undefined,
          uniswapMultiHop: false,
          o1Available: Boolean(o1Quote?.hasLiquidity),
        };

    const pickBest = () => {
      if (dex === "o1" && o1Quote?.hasLiquidity) {
        return {
          kind: "o1" as const,
          out: o1Quote.amountOut,
          min: o1Quote.amountOutMinimum,
          dex: "o1" as const,
          router: o1Quote.routerAddress,
          priceImprovementBps: o1Quote.priceImprovementBps,
          splitRoutes: o1Quote.splitRoutes,
        };
      }

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
        if (aggQuote?.hasLiquidity) {
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

      const isUsdcLeg = legs.payAsset === "usdc" || legs.receiveAsset === "usdc";
      const quoteAsset = isUsdcLeg ? (USDC_BASE as Address) : weth;
      const dirIn = direction === "buy" ? quoteAsset : tokenAddr;
      const dirOut = direction === "buy" ? tokenAddr : quoteAsset;

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
      if (best.kind === "o1") {
        return NextResponse.json({
          ...base,
          ...directPayload,
          ...aggregatorSidecar,
          dex: "o1",
          router: best.router,
          amountOut: best.out.toString(),
          amountOutMinimum: best.min.toString(),
          hasLiquidity: true,
          priceImpactBps: 8,
          o1SmartRoute: true,
          priceImprovementBps: best.priceImprovementBps,
          splitRoutes: best.splitRoutes,
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
        : "Quote failed — no route on Aerodrome, Uniswap, or Slipstream";
    return NextResponse.json({
      hasLiquidity: false,
      error: msg,
    });
  }
}
