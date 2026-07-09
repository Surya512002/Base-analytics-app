import type { AlchemyTransfer } from "@/lib/types/wallet";
import { getDayKey, getMonthKey, getWeekKey } from "@/lib/utils/dates";
import { getAppContractHit } from "@/lib/utils/app-contracts";
import { DEFI_PROTOCOLS } from "@/lib/constants/protocols";

export function normalizeAddr(addr: string | null | undefined): string {
  return (addr || "").toLowerCase();
}

/** Wallet sent or received this transfer leg. */
export function walletInvolved(tx: AlchemyTransfer, wallet: string): boolean {
  const w = normalizeAddr(wallet);
  return normalizeAddr(tx.from) === w || normalizeAddr(tx.to) === w;
}

/** Count toward heatmap / active days — includes address-indexed & gasless activity. */
export function countsTowardActivity(
  tx: AlchemyTransfer,
  wallet: string
): boolean {
  if (!tx.metadata?.blockTimestamp) return false;
  if (tx.metadata.walletParticipated) return true;
  if (walletInvolved(tx, wallet)) return true;
  if (tx.category === "useroperation" || tx.metadata?.isUserOperation) return true;
  if (tx.category === "contractcall") return true;
  if (
    tx.metadata?.isSponsored &&
    (walletInvolved(tx, wallet) || normalizeAddr(tx.from) === normalizeAddr(wallet))
  ) {
    return true;
  }
  return false;
}

export function mergeTransfers(
  sources: AlchemyTransfer[][]
): AlchemyTransfer[] {
  const map = new Map<string, AlchemyTransfer>();
  for (const list of sources) {
    for (const tx of list) {
      if (!tx.hash) continue;
      const key = `${tx.hash}-${tx.category}-${tx.asset || "ETH"}-${normalizeAddr(tx.from)}-${normalizeAddr(tx.to)}-${tx.value ?? 0}-${tx.metadata?.isUserOperation ? "uop" : ""}-${tx.metadata?.isSponsored ? "pm" : ""}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, tx);
        continue;
      }
      if (tx.metadata?.walletParticipated && !existing.metadata?.walletParticipated) {
        map.set(key, {
          ...existing,
          metadata: { ...existing.metadata, walletParticipated: true },
        });
      }
    }
  }
  return Array.from(map.values());
}

/**
 * Tag paymaster / smart-wallet legs and add synthetic per-hash activity
 * so mints, gasless Base App txs, and contract calls are never dropped.
 */
export function enrichTransferLegs(
  transfers: AlchemyTransfer[],
  wallet: string
): AlchemyTransfer[] {
  const w = normalizeAddr(wallet);
  const enriched = transfers.map((tx) => {
    const to = normalizeAddr(tx.to);
    const from = normalizeAddr(tx.from);
    const meta = { ...tx.metadata };
    const paymaster =
      tx.category === "useroperation" ||
      meta.isUserOperation ||
      meta.isSponsored ||
      (tx.category === "internal" && to === w && from !== w) ||
      (tx.category === "internal" && ethZero(tx) && (from === w || to === w));

    if (paymaster) {
      meta.isSponsored = true;
      meta.walletParticipated = true;
    } else if (meta.walletParticipated || from === w || to === w) {
      meta.walletParticipated = true;
    }

    return meta !== tx.metadata ? { ...tx, metadata: meta } : tx;
  });

  const hashWalletLeg = new Set<string>();
  for (const tx of enriched) {
    if (!tx.hash) continue;
    if (normalizeAddr(tx.from) === w || normalizeAddr(tx.to) === w) {
      hashWalletLeg.add(tx.hash);
    }
  }

  const extras: AlchemyTransfer[] = [];
  const seenSynth = new Set<string>();

  for (const tx of enriched) {
    if (!tx.hash || !tx.metadata?.blockTimestamp) continue;
    if (!tx.metadata.walletParticipated && !hashWalletLeg.has(tx.hash)) continue;
    if (hashWalletLeg.has(tx.hash)) continue;

    const key = `${tx.hash}-${tx.metadata.blockTimestamp.slice(0, 10)}`;
    if (seenSynth.has(key)) continue;
    seenSynth.add(key);

    extras.push({
      hash: tx.hash,
      category: "contractcall",
      value: 0,
      asset: "ETH",
      from: w,
      to: tx.to,
      metadata: {
        blockTimestamp: tx.metadata.blockTimestamp,
        walletParticipated: true,
      },
    });
    hashWalletLeg.add(tx.hash);
  }

  return extras.length ? [...enriched, ...extras] : enriched;
}

function ethZero(tx: AlchemyTransfer): boolean {
  return !tx.value || tx.value === 0;
}

export interface ActivityRollup {
  participatingHashes: Set<string>;
  outgoingHashes: Set<string>;
  uDays: Set<string>;
  uWeeks: Set<string>;
  uMonths: Set<string>;
  tpd: Map<string, number>;
  monthActivity: Map<string, number>;
}

export function rollupWalletActivity(
  txs: AlchemyTransfer[],
  wallet: string
): ActivityRollup {
  const w = normalizeAddr(wallet);
  const participatingHashes = new Set<string>();
  const outgoingHashes = new Set<string>();
  const uDays = new Set<string>();
  const uWeeks = new Set<string>();
  const uMonths = new Set<string>();
  const tpd = new Map<string, number>();
  const monthActivity = new Map<string, number>();
  const dayHashSeen = new Set<string>();

  for (const tx of txs) {
    if (!countsTowardActivity(tx, w)) continue;

    const fromAddr = normalizeAddr(tx.from);
    const dk = getDayKey(tx.metadata.blockTimestamp);
    const wk = getWeekKey(tx.metadata.blockTimestamp);
    const mk = getMonthKey(tx.metadata.blockTimestamp);

    participatingHashes.add(tx.hash);
    if (fromAddr === w) outgoingHashes.add(tx.hash);

    uDays.add(dk);
    uWeeks.add(wk);
    uMonths.add(mk);

    const dayKey = `${tx.hash}-${dk}`;
    if (!dayHashSeen.has(dayKey)) {
      dayHashSeen.add(dayKey);
      tpd.set(dk, (tpd.get(dk) || 0) + 1);
      monthActivity.set(mk, (monthActivity.get(mk) || 0) + 1);
    }
  }

  return {
    participatingHashes,
    outgoingHashes,
    uDays,
    uWeeks,
    uMonths,
    tpd,
    monthActivity,
  };
}

/** 56ca030 analytics rollup — every timestamped leg counts; no per-hash day dedup. */
export function rollupAnalyticsActivity(
  txs: AlchemyTransfer[],
  wallet: string
): ActivityRollup {
  const w = normalizeAddr(wallet);
  const participatingHashes = new Set<string>();
  const outgoingHashes = new Set<string>();
  const uDays = new Set<string>();
  const uWeeks = new Set<string>();
  const uMonths = new Set<string>();
  const tpd = new Map<string, number>();
  const monthActivity = new Map<string, number>();

  for (const tx of txs) {
    const ts = tx.metadata?.blockTimestamp;
    if (!ts) continue;
    if (!walletInvolved(tx, w) && !tx.metadata?.walletParticipated) continue;

    const fromAddr = normalizeAddr(tx.from);
    const dk = getDayKey(ts);
    const wk = getWeekKey(ts);
    const mk = getMonthKey(ts);

    if (tx.hash) participatingHashes.add(tx.hash);
    if (fromAddr === w && tx.hash) outgoingHashes.add(tx.hash);

    uDays.add(dk);
    uWeeks.add(wk);
    uMonths.add(mk);
    tpd.set(dk, (tpd.get(dk) || 0) + 1);
    monthActivity.set(mk, (monthActivity.get(mk) || 0) + 1);
  }

  return {
    participatingHashes,
    outgoingHashes,
    uDays,
    uWeeks,
    uMonths,
    tpd,
    monthActivity,
  };
}

export function countContractInteractions(
  txs: AlchemyTransfer[],
  wallet: string,
  paymasterTxHashes: Set<string>
): {
  contractInteractions: number;
  uniqueContracts: Set<string>;
  defi: number;
  uProtocols: Set<string>;
  protocolFreq: Map<string, number>;
  hBoosts: number;
  hasGm: boolean;
  gmCount: number;
  checkInCount: number;
} {
  const w = normalizeAddr(wallet);
  const interactHashes = new Set<string>();
  const uniqueContracts = new Set<string>();
  const uProtocols = new Set<string>();
  const protocolFreq = new Map<string, number>();
  const boostHashes = new Set<string>();
  const checkInHashes = new Set<string>();
  const gmHashes = new Set<string>();
  let defi = 0;
  let hasGm = false;

  for (const tx of txs) {
    if (!countsTowardActivity(tx, w)) continue;

    const fromAddr = normalizeAddr(tx.from);
    const toAddr = normalizeAddr(tx.to);
    const isOutgoing = fromAddr === w;
    const isIncoming = toAddr === w;
    const isUserOp = tx.category === "useroperation" && isOutgoing;
    const isSponsored =
      paymasterTxHashes.has(tx.hash) ||
      tx.metadata?.isSponsored === true ||
      (tx.category === "internal" && isIncoming);

    const appHit = getAppContractHit(tx, w);
    if (appHit === "gm") {
      hasGm = true;
      if (tx.hash) gmHashes.add(tx.hash.toLowerCase());
    }
    if (appHit === "checkin" && tx.hash) {
      checkInHashes.add(tx.hash.toLowerCase());
    }
    if (appHit === "booster" && tx.hash) {
      boostHashes.add(tx.hash.toLowerCase());
    }

    if (!(isOutgoing || isSponsored || isUserOp || appHit)) continue;

    interactHashes.add(tx.hash);

    const counterparty = isOutgoing ? toAddr : fromAddr;
    if (counterparty && counterparty !== w) uniqueContracts.add(counterparty);

    if (DEFI_PROTOCOLS.has(counterparty)) {
      defi++;
      uProtocols.add(counterparty);
      protocolFreq.set(counterparty, (protocolFreq.get(counterparty) || 0) + 1);
    }
  }

  return {
    contractInteractions: interactHashes.size,
    uniqueContracts,
    defi,
    uProtocols,
    protocolFreq,
    hBoosts: boostHashes.size,
    hasGm,
    gmCount: gmHashes.size,
    checkInCount: checkInHashes.size,
  };
}
