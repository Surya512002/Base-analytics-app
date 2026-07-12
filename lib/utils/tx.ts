import { toUtf8Bytes } from "ethers";
import { encodeFunctionData, type Abi, type Hex } from "viem";
import { BUILDER_CODE } from "@/lib/constants/env";
import { LAUNCHPAD_TREASURY } from "@/lib/constants/launchpad";
import { gasLimitForB20Target } from "@/lib/b20/preflight";

const SUFFIX_TAIL = "0080218021802180218021802180218021";

/** B20 factory + token precompiles reject non-canonical calldata (no builder suffix). */
export function isB20PrecompileAddress(to: string): boolean {
  return to.toLowerCase().startsWith("0xb20");
}

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

/** Remove builder suffix for wallet_sendCalls (wallet applies dataSuffix capability). */
export function stripBuilderSuffix(data: Hex): Hex {
  if (!hasBuilderSuffix(data)) return data;
  const suffix = getBuilderSuffix();
  return (`0x${data.slice(2).slice(0, -suffix.length)}`) as Hex;
}

/** Strip calldata suffix before wallet_sendCalls when wallet appends via capability. */
export function prepareCallsForWalletSendCalls(
  calls: ContractCall[]
): ContractCall[] {
  const hasB20 = calls.some((c) => isB20PrecompileAddress(c.to));
  if (hasB20) {
    return calls.map((call) => {
      if (isPreservedCalldataCall(call)) return call;
      if (!hasBuilderSuffix(call.data)) {
        return { ...call, data: withBuilderSuffix(call.data) };
      }
      return call;
    });
  }
  return calls.map((call) =>
    isPreservedCalldataCall(call)
      ? call
      : { ...call, data: stripBuilderSuffix(call.data) }
  );
}

/** ETH transfer with builder attribution in calldata. */
export function buildAttributedNativeTransfer(
  to: `0x${string}`,
  value: bigint
): ContractCall {
  return buildContractCall(to, "0x", value);
}

/**
 * Zero-value companion tx so B20-only batches still earn builder attribution
 * (B20 precompile calldata cannot include the suffix).
 */
export function buildBuilderAttributionCall(
  to: `0x${string}` = LAUNCHPAD_TREASURY
): ContractCall {
  return buildContractCall(to, "0x");
}

/** Normalize a batch so every non-B20 call carries builder attribution. */
export function finalizeAppTransactionBatch(
  calls: ContractCall[],
  opts?: { skipCompanion?: boolean }
): ContractCall[] {
  if (calls.length === 0) return calls;

  const normalized = calls.map((call) => {
    if (isPreservedCalldataCall(call)) return call;
    if (call.data === "0x" && call.value && call.value > BigInt(0)) {
      return buildAttributedNativeTransfer(call.to, call.value);
    }
    if (!hasBuilderSuffix(call.data)) {
      return { ...call, data: withBuilderSuffix(call.data) };
    }
    return call;
  });

  if (opts?.skipCompanion) return normalized;

  const hasB20 = normalized.some((c) => isB20PrecompileAddress(c.to));
  const hasAttributedNonB20 = normalized.some(
    (c) => !isB20PrecompileAddress(c.to) && hasBuilderSuffix(c.data)
  );

  if (hasB20 && !hasAttributedNonB20) {
    return [...normalized, buildBuilderAttributionCall()];
  }

  return normalized;
}

export type ContractCall = {
  to: `0x${string}`;
  data: Hex;
  value?: bigint;
  /** Explicit gas for B20 precompiles when wallets cannot estimate. */
  gas?: bigint;
  /** Third-party swap calldata (0x) — must not append builder suffix. */
  preserveCalldata?: boolean;
};

/** Returns true when calldata must be sent exactly as quoted (0x AllowanceHolder, etc.). */
export function isPreservedCalldataCall(call: ContractCall): boolean {
  return call.preserveCalldata === true || isB20PrecompileAddress(call.to);
}

export function buildContractCall(
  to: `0x${string}`,
  data: Hex,
  value?: bigint
): ContractCall {
  if (isB20PrecompileAddress(to)) {
    return buildB20Call(to, data, value);
  }
  return {
    to,
    data: withBuilderSuffix(data),
    ...(value !== undefined ? { value } : {}),
  };
}

/** 0x / aggregator swaps — calldata is validated on-chain and cannot carry a builder suffix. */
export function buildExternalSwapCall(
  to: `0x${string}`,
  data: Hex,
  value?: bigint
): ContractCall {
  return {
    to,
    data,
    preserveCalldata: true,
    ...(value !== undefined ? { value } : {}),
  };
}

/** B20 precompile call — canonical calldata only, no builder suffix. */
export function buildB20Call(
  to: `0x${string}`,
  data: Hex,
  value?: bigint
): ContractCall {
  return {
    to,
    data,
    gas: gasLimitForB20Target(to),
    ...(value !== undefined ? { value } : {}),
  };
}

/** Plain ETH transfer — includes builder attribution via calldata suffix. */
export function buildNativeTransferCall(
  to: `0x${string}`,
  value: bigint
): ContractCall {
  return buildAttributedNativeTransfer(to, value);
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
