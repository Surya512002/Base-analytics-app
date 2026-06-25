import { toUtf8Bytes } from "ethers";
import { BUILDER_CODE } from "@/lib/constants/env";

export function getBuilderSuffix(): string {
  const cb = toUtf8Bytes(BUILDER_CODE);
  const hex = Array.from(cb)
    .map((b: number) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${hex}${cb.length.toString(16).padStart(2, "0")}0080218021802180218021802180218021`;
}

export function normalizeTxHash(tx: string): string | null {
  const match = tx.trim().match(/0x[a-fA-F0-9]{64}/);
  return match ? match[0] : null;
}

export function basescanTxUrl(tx: string): string | null {
  const hash = normalizeTxHash(tx);
  return hash ? `https://basescan.org/tx/${hash}` : null;
}
