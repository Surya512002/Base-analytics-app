import type { AlchemyTransfer } from "@/lib/types/wallet";
import {
  ACHIEVEMENTS_CONTRACT,
  BOOSTER_CONTRACT,
  CHECKIN_CONTRACT,
  GM_GN_CONTRACT,
} from "@/lib/constants/contracts";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";
import { isWalletUserOp } from "@/lib/wallet/aa-activity";

export const APP_CONTRACTS = {
  gm: GM_GN_CONTRACT.toLowerCase(),
  checkin: CHECKIN_CONTRACT.toLowerCase(),
  booster: BOOSTER_CONTRACT.toLowerCase(),
  achievements: ACHIEVEMENTS_CONTRACT.toLowerCase(),
  launchpad: B20_FACTORY_ADDRESS.toLowerCase(),
} as const;

export type AppContractKey = keyof typeof APP_CONTRACTS;

/** Wallet initiated a call to one of our app contracts (MetaMask external OR Base App internal/paymaster). */
export function isWalletCallTo(
  tx: AlchemyTransfer,
  wallet: string,
  contract: string
): boolean {
  const w = wallet.toLowerCase();
  const c = contract.toLowerCase();
  const to = (tx.to || "").toLowerCase();
  if (to !== c) return false;
  const from = (tx.from || "").toLowerCase();
  if (from === w) return true;
  if (tx.category === "contractcall" && from === w) return true;
  return false;
}

export function getAppContractHit(
  tx: AlchemyTransfer,
  wallet: string
): AppContractKey | null {
  for (const [key, addr] of Object.entries(APP_CONTRACTS) as [
    AppContractKey,
    string,
  ][]) {
    if (isWalletCallTo(tx, wallet, addr)) return key;
  }
  return null;
}

const APP_CONTRACT_ADDRS = new Set(Object.values(APP_CONTRACTS));

function appKeyForTarget(to: string | null | undefined): AppContractKey | null {
  const target = (to || "").toLowerCase();
  if (!APP_CONTRACT_ADDRS.has(target)) return null;
  for (const [key, addr] of Object.entries(APP_CONTRACTS) as [
    AppContractKey,
    string,
  ][]) {
    if (addr === target) return key;
  }
  return null;
}

/**
 * Smart-wallet / paymaster txs often index as wallet → EntryPoint.
 * Scan every leg in a hash where the wallet participated to find inner app calls.
 */
export function buildAppActionHitsByHash(
  txs: AlchemyTransfer[],
  wallet: string
): Map<string, AppContractKey> {
  const w = wallet.toLowerCase();
  const walletHashes = new Set<string>();

  for (const tx of txs) {
    if (!tx.hash) continue;
    const from = (tx.from || "").toLowerCase();
    const to = (tx.to || "").toLowerCase();
    if (
      from === w ||
      to === w ||
      tx.metadata?.walletParticipated ||
      tx.category === "useroperation"
    ) {
      walletHashes.add(tx.hash.toLowerCase());
    }
  }

  const hits = new Map<string, AppContractKey>();
  for (const tx of txs) {
    if (!tx.hash) continue;
    const h = tx.hash.toLowerCase();
    if (!walletHashes.has(h)) continue;

    const direct = getAppContractHit(tx, w);
    if (direct) {
      hits.set(h, direct);
      continue;
    }

    const inner = appKeyForTarget(tx.to);
    if (inner) hits.set(h, inner);
  }

  return hits;
}

/** True only for ERC-4337 UserOps sent by this wallet — not internals or EntryPoint refunds. */
export function isPaymasterActivity(tx: AlchemyTransfer, wallet: string): boolean {
  return isWalletUserOp(tx, wallet);
}
