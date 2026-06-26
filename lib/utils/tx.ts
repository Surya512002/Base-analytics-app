import { toUtf8Bytes } from "ethers";
import { encodeFunctionData, type Abi, type Hex } from "viem";
import { BUILDER_CODE } from "@/lib/constants/env";

const SUFFIX_TAIL = "0080218021802180218021802180218021";

/** Raw hex suffix (no 0x) appended to contract calldata for Base builder attribution. */
export function getBuilderSuffix(): string {
  const cb = toUtf8Bytes(BUILDER_CODE);
  const hex = Array.from(cb)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex}${cb.length.toString(16).padStart(2, "0")}${SUFFIX_TAIL}`;
}

/** Viem `dataSuffix` / wallet capability form (with 0x prefix). */
export function getBuilderDataSuffix(): Hex {
  return `0x${getBuilderSuffix()}` as Hex;
}

export function hasBuilderSuffix(data: string): boolean {
  const normalized = data.toLowerCase();
  return normalized.endsWith(getBuilderSuffix().toLowerCase());
}

/** Append builder code once — safe to call on already-suffixed calldata. */
export function withBuilderSuffix(data: Hex): Hex {
  if (!data || data === "0x") {
    return getBuilderDataSuffix();
  }
  if (hasBuilderSuffix(data)) return data;
  return `${data}${getBuilderSuffix()}` as Hex;
}

export type ContractCall = {
  to: `0x${string}`;
  data: Hex;
  value?: bigint;
};

export function buildContractCall(
  to: `0x${string}`,
  data: Hex,
  value?: bigint
): ContractCall {
  return {
    to,
    data: withBuilderSuffix(data),
    ...(value !== undefined ? { value } : {}),
  };
}

export function encodeContractCall(
  to: `0x${string}`,
  abi: Abi,
  functionName: string,
  args?: readonly unknown[],
  value?: bigint
): ContractCall {
  const data = encodeFunctionData({
    abi,
    functionName: functionName as never,
    args: args as never,
  });
  return buildContractCall(to, data, value);
}

export function normalizeTxHash(tx: string): string | null {
  const match = tx.trim().match(/0x[a-fA-F0-9]{64}/);
  return match ? match[0] : null;
}

export function basescanTxUrl(tx: string): string | null {
  const hash = normalizeTxHash(tx);
  return hash ? `https://basescan.org/tx/${hash}` : null;
}

/** Active builder code — every app tx must include this attribution. */
export { BUILDER_CODE };
