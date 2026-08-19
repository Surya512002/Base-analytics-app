import type { AlchemyTransfer } from "@/lib/types/wallet";
import { ENTRYPOINT_V06, ENTRYPOINT_V07 } from "@/lib/constants/contracts";

const EP = new Set([ENTRYPOINT_V06.toLowerCase(), ENTRYPOINT_V07.toLowerCase()]);
const ZERO = "0x0000000000000000000000000000000000000000";

function addr(value: string | null | undefined): string {
  return (value || "").toLowerCase();
}

/**
 * ERC-4337 UserOp sent by this wallet (Basescan “Other Transactions → AA”).
 * Does not treat inbound internals or EntryPoint refunds as AA.
 */
export function isWalletUserOp(tx: AlchemyTransfer, wallet: string): boolean {
  const w = addr(wallet);
  const from = addr(tx.from);
  if (from !== w) return false;
  if (tx.category === "useroperation") return true;
  if (tx.metadata?.isUserOperation === true) return true;
  if (tx.metadata?.userOpHash) return true;
  return false;
}

/**
 * Paymaster-sponsored UserOp (Base App gasless). Subset of AA — not every
 * internal ETH transfer, and not every UserOp without a paymaster.
 */
export function isWalletGaslessUserOp(tx: AlchemyTransfer, wallet: string): boolean {
  if (!isWalletUserOp(tx, wallet)) return false;
  if (tx.metadata?.isSponsored !== true) return false;
  return true;
}

export function isEntryPointAddress(value: string | null | undefined): boolean {
  return EP.has(addr(value));
}

export function countAaActivity(
  transfers: AlchemyTransfer[],
  wallet: string
): { aaTxCount: number; paymasterTxCount: number } {
  const w = addr(wallet);
  const aaIds = new Set<string>();
  const gaslessHashes = new Set<string>();

  for (const tx of transfers) {
    if (!isWalletUserOp(tx, w)) continue;
    const aaId =
      addr(tx.metadata?.userOpHash) ||
      `${addr(tx.hash)}-${addr(tx.from)}-${addr(tx.to)}`;
    aaIds.add(aaId);
    if (isWalletGaslessUserOp(tx, w)) {
      gaslessHashes.add(addr(tx.hash) || aaId);
    }
  }

  return {
    aaTxCount: aaIds.size,
    paymasterTxCount: gaslessHashes.size,
  };
}

export function isZeroAddress(value: string | null | undefined): boolean {
  return addr(value) === ZERO;
}
