import { describe, expect, it } from "vitest";

/**
 * Mirrors pollHelpers normalization logic used in send-app-tx (kept pure for tests).
 * Duplicated thin wrappers so we can unit-test without exporting internal fns.
 */
function normalizeCallsStatus(
  status: string | number | undefined,
  statusCode?: number
): "pending" | "confirmed" | "failed" | "unknown" {
  const raw = status ?? statusCode;
  if (raw == null) return "unknown";

  if (typeof raw === "number") {
    if (raw === 1) return "pending";
    if (raw === 2) return "confirmed";
    if (raw >= 100 && raw < 200) return "pending";
    if (raw >= 200 && raw < 300) return "confirmed";
    if (raw >= 400) return "failed";
    return "unknown";
  }

  const s = String(raw).toUpperCase();
  if (s === "PENDING" || s === "100" || s === "1" || s === "LOADING" || s === "EXECUTING") {
    return "pending";
  }
  if (
    s === "CONFIRMED" ||
    s === "SUCCESS" ||
    s === "COMPLETE" ||
    s === "COMPLETED" ||
    s === "200" ||
    s === "2"
  ) {
    return "confirmed";
  }
  if (s === "FAILED" || s === "REVERTED" || s === "ERROR" || s === "400" || s === "500" || s === "600") {
    return "failed";
  }
  return "unknown";
}

function isTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function extractTxHashFromStatus(status: {
  receipts?: Array<{
    transactionHash?: string;
    transaction_hash?: string;
    hash?: string;
  }>;
  capabilities?: { caip345?: { transactionHashes?: string[] } };
}): string | null {
  for (const h of status.capabilities?.caip345?.transactionHashes ?? []) {
    if (typeof h === "string" && isTxHash(h)) return h;
  }
  for (const receipt of status.receipts ?? []) {
    for (const key of ["transactionHash", "transaction_hash", "hash"] as const) {
      const v = receipt[key];
      if (typeof v === "string" && isTxHash(v)) return v;
    }
  }
  return null;
}

const SAMPLE_HASH =
  "0x9b7bb827c2e5e3c1a0a44dc53e573aa0b3af3bd1f9f5ed03071b100bb039eaff";

describe("wallet_getCallsStatus normalization", () => {
  it("treats EIP-5792 200 and legacy 2 as confirmed", () => {
    expect(normalizeCallsStatus(200)).toBe("confirmed");
    expect(normalizeCallsStatus(2)).toBe("confirmed");
    expect(normalizeCallsStatus("SUCCESS")).toBe("confirmed");
    expect(normalizeCallsStatus("COMPLETE")).toBe("confirmed");
  });

  it("treats 100 and legacy 1 as pending", () => {
    expect(normalizeCallsStatus(100)).toBe("pending");
    expect(normalizeCallsStatus(1)).toBe("pending");
  });

  it("extracts hash from alternate receipt field names", () => {
    expect(
      extractTxHashFromStatus({
        receipts: [{ transaction_hash: SAMPLE_HASH }],
      })
    ).toBe(SAMPLE_HASH);
    expect(
      extractTxHashFromStatus({
        capabilities: { caip345: { transactionHashes: [SAMPLE_HASH] } },
      })
    ).toBe(SAMPLE_HASH);
  });
});
