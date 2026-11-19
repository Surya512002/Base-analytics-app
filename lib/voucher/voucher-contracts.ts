/**
 * Every BaseVoucher (gift card) contract the app knows about, newest first.
 *
 * Gift-card batch ids are NOT unique across contracts: v1 and v2 both count from 1. A batch
 * is therefore identified by (contract, batchId), never by its id alone. Anything that stores
 * or matches batches should use `batchRefKey`.
 *
 * Adding a contract: put it in KNOWN_VOUCHER_CONTRACTS (or point NEXT_PUBLIC_VOUCHER_CONTRACT
 * at it). Older contracts stay listed so their cards can still be read, redeemed and reclaimed.
 */
import type { Address } from "viem";
import { VOUCHER_CONTRACT } from "@/lib/constants/env";

export const VOUCHER_V2_CONTRACT = "0xc118afff969db6cd6d2de639e2c8ba1223768fce" as const;
export const VOUCHER_V1_CONTRACT = "0xE425b060d888DD54C57160f4c3B0d3Fb76EcCf25" as const;

export interface VoucherContractInfo {
  address: Address;
  label: string;
  /** True only for the contract new batches are created on. */
  current: boolean;
}

const KNOWN_VOUCHER_CONTRACTS: ReadonlyArray<{ address: Address; label: string }> = [
  { address: VOUCHER_V2_CONTRACT, label: "BaseVoucher v2" },
  { address: VOUCHER_V1_CONTRACT, label: "BaseVoucher v1" },
];

const isAddr = (a: string | null | undefined): a is Address => Boolean(a && /^0x[0-9a-fA-F]{40}$/.test(a));

/** All known gift-card contracts, the current one first, no duplicates. */
export function voucherContracts(): VoucherContractInfo[] {
  const current = isAddr(VOUCHER_CONTRACT) ? (VOUCHER_CONTRACT as Address) : VOUCHER_V2_CONTRACT;
  const out: VoucherContractInfo[] = [];
  const seen = new Set<string>();
  const push = (address: Address, label: string) => {
    const k = address.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ address, label, current: k === current.toLowerCase() });
  };
  const known = KNOWN_VOUCHER_CONTRACTS.find((c) => c.address.toLowerCase() === current.toLowerCase());
  push(current, known?.label ?? "BaseVoucher (configured)");
  for (const c of KNOWN_VOUCHER_CONTRACTS) push(c.address, c.label);
  return out;
}

/** True when `address` is one of our gift-card contracts. */
export function isKnownVoucherContract(address: string | null | undefined): address is Address {
  if (!isAddr(address)) return false;
  const k = address.toLowerCase();
  return voucherContracts().some((c) => c.address.toLowerCase() === k);
}

/**
 * Contracts a batch may live on: just its own contract when known, else every known contract
 * (records saved before batches carried their contract address).
 */
export function candidateContracts(contractAddress?: string | null): Address[] {
  if (isKnownVoucherContract(contractAddress)) return [contractAddress];
  return voucherContracts().map((c) => c.address);
}

/** Stable identity for a batch: `contract:batchId` (contract lower-cased). */
export function batchRefKey(contract: string, batchId: number): string {
  return `${contract.toLowerCase()}:${batchId}`;
}
