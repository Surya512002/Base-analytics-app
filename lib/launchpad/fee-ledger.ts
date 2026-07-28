import { cacheGet, cacheSet } from "@/lib/redis-cache";

export type FeeAsset = "eth" | "usdc" | "token";

export interface FeeEvent {
  id: string;
  txHash: string;
  tokenAddress: string;
  tokenSymbol: string;
  trader: string;
  creator: string;
  referrer: string | null;
  direction: "buy" | "sell";
  feeAsset: FeeAsset;
  feeAmount: string;
  creatorShare: string;
  platformShare: string;
  referrerShare: string;
  timestamp: number;
}

export interface RevenueByToken {
  tokenAddress: string;
  tokenSymbol: string;
  events: number;
  creatorShare: bigint;
  referrerShare: bigint;
}

export interface CreatorRevenueSummary {
  address: string;
  role: "creator" | "referrer";
  eventCount: number;
  /** Sum of creator or referrer shares (raw wei / smallest unit). */
  totalShare: string;
  byToken: RevenueByToken[];
  recent: FeeEvent[];
  /** Estimated from DexScreener volume when ledger is sparse. */
  estimated?: boolean;
}

const LEDGER_KEY = "launchpad:fee-events:v1";
const LEDGER_TTL = 60 * 60 * 24 * 365;
const MAX_EVENTS = 5000;

const memEvents: FeeEvent[] = [];

function normalize(addr: string): string {
  return addr.trim().toLowerCase();
}

async function loadEvents(): Promise<FeeEvent[]> {
  const cached = await cacheGet<FeeEvent[]>(LEDGER_KEY);
  if (cached?.length) return cached;
  return memEvents;
}

async function saveEvents(events: FeeEvent[]): Promise<void> {
  const trimmed = events.slice(0, MAX_EVENTS);
  memEvents.length = 0;
  memEvents.push(...trimmed);
  await cacheSet(LEDGER_KEY, trimmed, LEDGER_TTL).catch(() => {});
}

export async function recordFeeEvent(
  event: Omit<FeeEvent, "id" | "timestamp"> & { timestamp?: number }
): Promise<FeeEvent> {
  const entry: FeeEvent = {
    ...event,
    id: `${event.txHash}-${event.creator}-${Date.now()}`,
    tokenAddress: normalize(event.tokenAddress),
    trader: normalize(event.trader),
    creator: normalize(event.creator),
    referrer: event.referrer ? normalize(event.referrer) : null,
    timestamp: event.timestamp ?? Date.now(),
  };

  const existing = await loadEvents();
  const dup = existing.some(
    (e) => e.txHash === entry.txHash && e.creator === entry.creator && e.trader === entry.trader
  );
  if (dup) return entry;

  await saveEvents([entry, ...existing]);
  return entry;
}

function sumShares(
  events: FeeEvent[],
  role: "creator" | "referrer",
  address: string
): { total: bigint; byToken: Map<string, RevenueByToken> } {
  const addr = normalize(address);
  let total = BigInt(0);
  const byToken = new Map<string, RevenueByToken>();

  for (const e of events) {
    const isCreator = role === "creator" && e.creator === addr;
    const isReferrer = role === "referrer" && e.referrer === addr;
    if (!isCreator && !isReferrer) continue;

    const share = BigInt(isCreator ? e.creatorShare : e.referrerShare);
    if (share <= BigInt(0)) continue;
    total += share;

    const key = e.tokenAddress;
    const prev = byToken.get(key);
    if (prev) {
      prev.events += 1;
      if (isCreator) prev.creatorShare += share;
      else prev.referrerShare += share;
    } else {
      byToken.set(key, {
        tokenAddress: key,
        tokenSymbol: e.tokenSymbol,
        events: 1,
        creatorShare: isCreator ? share : BigInt(0),
        referrerShare: isReferrer ? share : BigInt(0),
      });
    }
  }

  return { total, byToken };
}

export async function getCreatorRevenue(address: string): Promise<CreatorRevenueSummary> {
  const addr = normalize(address);
  const events = await loadEvents();
  const { total, byToken } = sumShares(events, "creator", addr);
  const recent = events.filter((e) => e.creator === addr).slice(0, 20);

  return {
    address: addr,
    role: "creator",
    eventCount: events.filter((e) => e.creator === addr).length,
    totalShare: total.toString(),
    byToken: [...byToken.values()].sort((a, b) => Number(b.creatorShare - a.creatorShare)),
    recent,
  };
}

export async function getReferrerRevenue(address: string): Promise<CreatorRevenueSummary> {
  const addr = normalize(address);
  const events = await loadEvents();
  const { total, byToken } = sumShares(events, "referrer", addr);
  const recent = events.filter((e) => e.referrer === addr).slice(0, 20);

  return {
    address: addr,
    role: "referrer",
    eventCount: events.filter((e) => e.referrer === addr).length,
    totalShare: total.toString(),
    byToken: [...byToken.values()].sort((a, b) => Number(b.referrerShare - a.referrerShare)),
    recent,
  };
}
