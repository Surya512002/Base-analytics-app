import { NextResponse } from "next/server";
import { analyzeWalletAddress } from "@/lib/analyze-wallet";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import {
  getCachedAnalyze,
  setCachedAnalyze,
  ANALYZE_CACHE_TTL_SECONDS,
} from "@/lib/wallet/analyze-cache";
import { runWalletSyncBurst } from "@/lib/wallet/sync-engine";
import { buildWalletMetricsPatch } from "@/lib/wallet/metrics-patch";
import { mergeWalletMetricsMax } from "@/lib/wallet/merge-metrics";
import { buildRecentTxPreview } from "@/lib/utils/wallet-activity";
import { cacheGet, cacheSet } from "@/lib/redis-cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const ANALYZE_CACHE_TTL = ANALYZE_CACHE_TTL_SECONDS;
/** Stay under Vercel's function wall — leave room for analyze + JSON response. */
const HANDLER_BUDGET_MS = 95_000;

/**
 * When a sync pass finds nothing (the history indexer is unreachable or blocked, e.g. a Cloudflare
 * challenge), remember it per wallet for 30 minutes and answer instantly instead of burning
 * another ~55s pass. Shared through Redis when configured, with an in-process fallback.
 */
const STALL_TTL_SECONDS = 30 * 60;
const stallMem = new Map<string, number>();
const stallKey = (address: string) => `wallet-sync:stalled:${address}`;
async function isSyncStalled(address: string): Promise<boolean> {
  const until = stallMem.get(address);
  if (until && until > Date.now()) return true;
  return Boolean(await cacheGet<number>(stallKey(address)).catch(() => null));
}
async function markSyncStalled(address: string): Promise<void> {
  stallMem.set(address, Date.now() + STALL_TTL_SECONDS * 1000);
  await cacheSet(stallKey(address), Date.now(), STALL_TTL_SECONDS).catch(() => {});
}

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

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const handlerDeadline = Date.now() + HANDLER_BUDGET_MS;

  try {
    // Full history already synced and analyzed within the cache window (1h): serve it. Without
    // this, every connect re-ran the complete analysis (~30–45s of function time per call).
    const fresh = await getCachedAnalyze(address).catch(() => null);
    if (fresh?.wallet && fresh.historyComplete === true) {
      return NextResponse.json({
        ...fresh,
        cached: true,
        historyComplete: true,
        partial: false,
        sync: {
          complete: true,
          uniqueDays: fresh.wallet.uniqueDays,
          uniqueHashes: fresh.wallet.txCount,
        },
      });
    }

    const syncBudget = Math.min(
      52_000,
      Math.max(12_000, handlerDeadline - Date.now() - 35_000)
    );
    if (await isSyncStalled(address)) {
      return NextResponse.json({ historyComplete: false, partial: true, stalled: true, sync: { complete: false, transferLegs: 0, uniqueDays: 0 } });
    }

    const { transfers, state } = await runWalletSyncBurst(address, syncBudget);

    if (!state.historyComplete) {
      if (transfers.length === 0 && !state.activityDays.length && !Object.keys(state.tpd ?? {}).length) {
        await markSyncStalled(address);
        const res = await buildPartialSyncResponse(address, transfers, state);
        const body = await res.json();
        return NextResponse.json({ ...body, stalled: true });
      }
      return buildPartialSyncResponse(address, transfers, state);
    }

    if (handlerDeadline - Date.now() < 28_000) {
      return buildPartialSyncResponse(address, transfers, state);
    }

    const cached = await getCachedAnalyze(address);
    const priorWallet = cached?.wallet;

    const result = await analyzeWalletAddress(address, {
      historyComplete: true,
      v2StreamStates: state.v2StreamStates,
      fetchDepth: "complete",
      transfers,
    });

    if (!result) {
      return buildPartialSyncResponse(address, transfers, state);
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
