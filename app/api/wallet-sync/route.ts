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
import { applyHistoryIndexToWallet, buildWalletMetricsPatch } from "@/lib/wallet/metrics-patch";
import { mergeWalletMetricsMax } from "@/lib/wallet/merge-metrics";
import { buildRecentTxPreview } from "@/lib/utils/wallet-activity";
import { requireAnalyticsUnlock } from "@/lib/utils/require-analytics-unlock";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const ANALYZE_CACHE_TTL = ANALYZE_CACHE_TTL_SECONDS;
/** Stay under Vercel's function wall — leave room for analyze + JSON response. */
const HANDLER_BUDGET_MS = 95_000;

async function buildPartialSyncResponse(
  address: string,
  transfers: Awaited<ReturnType<typeof runWalletSyncBurst>>["transfers"],
  state: Awaited<ReturnType<typeof runWalletSyncBurst>>["state"]
) {
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

  const locked = await requireAnalyticsUnlock(req, address);
  if (locked) return locked;

  const handlerDeadline = Date.now() + HANDLER_BUDGET_MS;

  try {
    if (reset) {
      await saveWalletHistory(address, emptyHistoryState());
    }

    // Short bursts so each poll returns a partial for *this* address quickly.
    // Give Alchemy resume more room per burst (~35s) under the 95s handler wall.
    const syncBudget = Math.min(
      40_000,
      Math.max(12_000, handlerDeadline - Date.now() - 28_000)
    );
    const { transfers, state } = await runWalletSyncBurst(address, syncBudget);

    if (!state.historyComplete) {
      return buildPartialSyncResponse(address, transfers, state);
    }

    const cached = await getCachedAnalyze(address);

    // Never re-analyze from this burst's legs — Redis only stores a compact
    // heatmap index, so a last-page burst would zero out volume / AA / ETH flow.
    if (cached?.wallet) {
      const fromIndex = applyHistoryIndexToWallet(cached.wallet, state);
      const wallet = mergeWalletMetricsMax(cached.wallet, fromIndex);
      const finalResult = {
        wallet,
        mintedLevels: cached.mintedLevels ?? {},
        boosts: cached.boosts ?? 0,
        streak: cached.streak ?? 0,
        checkedToday: cached.checkedToday ?? false,
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
    }

    if (handlerDeadline - Date.now() < 28_000) {
      return buildPartialSyncResponse(address, transfers, state);
    }

    const result = await analyzeWalletAddress(address, {
      historyComplete: true,
      v2StreamStates: state.v2StreamStates,
      fetchDepth: "connect",
    });

    if (!result) {
      return buildPartialSyncResponse(address, transfers, state);
    }

    const wallet = result.wallet;
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
    try {
      const cached = await getCachedAnalyze(address);
      if (cached?.wallet) {
        return NextResponse.json({
          ...cached,
          historyComplete: cached.historyComplete ?? false,
          partial: true,
          sync: {
            complete: cached.historyComplete === true,
            uniqueDays: cached.wallet.uniqueDays,
            uniqueHashes: cached.wallet.txCount,
          },
        });
      }
    } catch {
      /* ignore cache read errors */
    }
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
