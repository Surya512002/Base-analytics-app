import { NextResponse } from "next/server";
import { analyzeWalletAddress } from "@/lib/analyze-wallet";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import {
  getCachedAnalyze,
  setCachedAnalyze,
  ANALYZE_CACHE_TTL_SECONDS,
} from "@/lib/wallet/analyze-cache";
import {
  saveWalletHistory,
  emptyHistoryState,
} from "@/lib/wallet/history-store";
import { runWalletSyncBurst } from "@/lib/wallet/sync-engine";
import { buildWalletMetricsPatch } from "@/lib/wallet/metrics-patch";
import { mergeWalletMetricsMax } from "@/lib/wallet/merge-metrics";
import { buildRecentTxPreview } from "@/lib/utils/wallet-activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const ANALYZE_CACHE_TTL = ANALYZE_CACHE_TTL_SECONDS;

export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimitAsync(`sync:${ip}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.trim().toLowerCase();
  const reset = searchParams.get("reset") === "1";

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    if (reset) {
      await saveWalletHistory(address, emptyHistoryState());
    }

    const { transfers, state } = await runWalletSyncBurst(address, 58_000);

    if (!state.historyComplete) {
      const cached = await getCachedAnalyze(address);
      const prior = cached?.wallet;

      const patch = await buildWalletMetricsPatch(transfers, address, state, {
        partialSync: true,
        priorWallet: prior ?? null,
        basename: prior?.basename,
        gmCount: prior?.gmCount,
        checkInCount: prior?.checkInCount,
        currentStreak: prior?.currentStreak,
        longestStreak: prior?.longestStreak,
        bridgeTxCount: prior?.bridgeTxCount,
        defiInteractions: prior?.defiInteractions,
        uniqueContracts: prior?.uniqueContracts,
      });
      const recentTxs = buildRecentTxPreview(transfers, address, 10);
      const sortedTs = transfers
        .map((t) => t.metadata?.blockTimestamp)
        .filter(Boolean)
        .sort();
      const firstTx = sortedTs[0]?.slice(0, 10) ?? prior?.firstTx;
      const lastTx = sortedTs[sortedTs.length - 1]?.slice(0, 10) ?? prior?.lastTx;

      return NextResponse.json({
        historyComplete: false,
        partial: true,
        wallet: {
          ...patch,
          recentTxs,
          firstTx,
          lastTx,
        },
        sync: {
          complete: false,
          transferLegs: transfers.length,
          uniqueDays: patch.uniqueDays,
          uniqueHashes: patch.txCount,
        },
      });
    }

    const cached = await getCachedAnalyze(address);
    const priorWallet = cached?.wallet;

    const result = await analyzeWalletAddress(address, {
      historyComplete: true,
      v2StreamStates: state.v2StreamStates,
      fetchDepth: "complete",
    });

    if (!result) {
      return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
    }

    const wallet = priorWallet
      ? mergeWalletMetricsMax(priorWallet, result.wallet)
      : result.wallet;
    const finalResult = {
      ...result,
      wallet,
      historyComplete: true as const,
    };

    await setCachedAnalyze(address, finalResult, ANALYZE_CACHE_TTL);

    return NextResponse.json({
      ...finalResult,
      partial: false,
      sync: {
        complete: true,
        transferLegs: transfers.length,
        uniqueDays: wallet.uniqueDays,
        uniqueHashes: wallet.txCount,
      },
    });
  } catch (err) {
    console.error("[wallet-sync]", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  let address = searchParams.get("address")?.trim().toLowerCase();
  if (!address) {
    try {
      const body = await req.json();
      address = body.address?.trim().toLowerCase();
    } catch {
      // ignore
    }
  }

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const cached = await getCachedAnalyze(address);

  return NextResponse.json({
    address,
    cached: Boolean(cached),
    complete: cached?.historyComplete === true,
    uniqueDays: cached?.wallet?.uniqueDays ?? 0,
  });
}
