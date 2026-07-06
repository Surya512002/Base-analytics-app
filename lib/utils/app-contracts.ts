import type { AlchemyTransfer } from "@/lib/types/wallet";
import {
  ACHIEVEMENTS_CONTRACT,
  BOOSTER_CONTRACT,
  CHECKIN_CONTRACT,
  GM_GN_CONTRACT,
} from "@/lib/constants/contracts";
import { PREDICTIONS_CONTRACT } from "@/lib/constants/env";

export const APP_CONTRACTS = {
  gm: GM_GN_CONTRACT.toLowerCase(),
  checkin: CHECKIN_CONTRACT.toLowerCase(),
  booster: BOOSTER_CONTRACT.toLowerCase(),
  achievements: ACHIEVEMENTS_CONTRACT.toLowerCase(),
  ...(PREDICTIONS_CONTRACT
    ? { predictions: PREDICTIONS_CONTRACT.toLowerCase() }
    : {}),
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

/** True for gasless / paymaster / ERC-4337 activity. */
export function isPaymasterActivity(tx: AlchemyTransfer, wallet: string): boolean {
  const w = wallet.toLowerCase();
  const to = (tx.to || "").toLowerCase();
  return (
    tx.category === "useroperation" ||
    tx.metadata?.isSponsored === true ||
    tx.metadata?.isUserOperation === true ||
    (tx.category === "internal" &&
      to === w &&
      (tx.from || "").toLowerCase() !== w)
  );
}
