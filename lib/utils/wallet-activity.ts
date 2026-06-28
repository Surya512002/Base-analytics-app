import type { AlchemyTransfer } from "@/lib/types/wallet";
import { getDayKey, getMonthKey, getWeekKey } from "@/lib/utils/dates";
import { DEFI_PROTOCOLS } from "@/lib/constants/protocols";
import {
  BOOSTER_CONTRACT,
  CHECKIN_CONTRACT,
  ENTRYPOINT_V06,
  ENTRYPOINT_V07,
  GM_GN_CONTRACT,
} from "@/lib/constants/contracts";

const EP06 = ENTRYPOINT_V06.toLowerCase();
const EP07 = ENTRYPOINT_V07.toLowerCase();

export function normalizeAddr(addr: string | null | undefined): string {
  return (addr || "").toLowerCase();
}

/** Wallet sent or received this transfer leg (+ Base App / paymaster extras). */
export function walletInvolved(tx: AlchemyTransfer, wallet: string): boolean {
  const w = normalizeAddr(wallet);
  const from = normalizeAddr(tx.from);
  const to = normalizeAddr(tx.to);
  if (from === w || to === w) return true;
  if (tx.category === "contractcall" && from === w) return true;
  if (tx.metadata?.isUserOperation && from === w) return true;
  if (tx.category === "internal" && (from === EP06 || from === EP07) && to === w)
    return true;
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
      if (!map.has(key)) map.set(key, tx);
    }
  }
  return Array.from(map.values());
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
    if (!tx.metadata?.blockTimestamp || !walletInvolved(tx, w)) continue;

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
  let defi = 0;
  let hBoosts = 0;
  let hasGm = false;
  let gmCount = 0;
  let checkInCount = 0;

  const boost = BOOSTER_CONTRACT.toLowerCase();
  const gm = GM_GN_CONTRACT.toLowerCase();
  const checkin = CHECKIN_CONTRACT.toLowerCase();

  for (const tx of txs) {
    if (!walletInvolved(tx, w)) continue;

    const fromAddr = normalizeAddr(tx.from);
    const toAddr = normalizeAddr(tx.to);
    const isOutgoing = fromAddr === w;
    const isIncoming = toAddr === w;
    const isUserOp = tx.category === "useroperation" && isOutgoing;
    const isSponsored =
      paymasterTxHashes.has(tx.hash) ||
      tx.metadata?.isSponsored === true ||
      (tx.category === "internal" && isIncoming);

    if (!(isOutgoing || isSponsored || isUserOp)) continue;

    interactHashes.add(tx.hash);

    const counterparty = isOutgoing ? toAddr : fromAddr;
    if (counterparty && counterparty !== w) uniqueContracts.add(counterparty);

    if (DEFI_PROTOCOLS.has(counterparty)) {
      defi++;
      uProtocols.add(counterparty);
      protocolFreq.set(counterparty, (protocolFreq.get(counterparty) || 0) + 1);
    }
    if (toAddr === boost && isOutgoing) hBoosts++;
    if (toAddr === gm && isOutgoing) {
      hasGm = true;
      gmCount++;
    }
    if (toAddr === checkin && isOutgoing) checkInCount++;
  }

  return {
    contractInteractions: interactHashes.size,
    uniqueContracts,
    defi,
    uProtocols,
    protocolFreq,
    hBoosts,
    hasGm,
    gmCount,
    checkInCount,
  };
}
