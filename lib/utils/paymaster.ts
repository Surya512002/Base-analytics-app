import { PAYMASTER_URL } from "@/lib/constants/env";
import { getBuilderDataSuffix, isB20PrecompileAddress } from "@/lib/utils/tx";
import type { ConnectionType } from "@/lib/types/wallet";

const BUILDER_DATA_SUFFIX_CAP = {
  dataSuffix: {
    value: getBuilderDataSuffix(),
    optional: true,
  },
};

/** EIP-5792 capabilities for wallet_sendCalls (paymaster + builder attribution). */
export function getSendCallsCapabilities(
  skipBuilderSuffix = false
): Record<string, unknown> {
  const caps: Record<string, unknown> = skipBuilderSuffix
    ? {}
    : { ...BUILDER_DATA_SUFFIX_CAP };
  if (PAYMASTER_URL) {
    caps.paymasterService = { url: PAYMASTER_URL };
  }
  return caps;
}

export function batchUsesB20Precompile(
  calls: { to: string }[]
): boolean {
  return calls.some((c) => isB20PrecompileAddress(c.to));
}

/** Wallet capabilities for OnchainKit Transaction (paymaster when configured). */
export function getCapabilities() {
  if (!PAYMASTER_URL) return {};
  return { paymasterService: { url: PAYMASTER_URL } };
}

/** OnchainKit: sponsored wallets use sendCalls + dataSuffix; EOAs keep suffix in calldata. */
export function getOnchainKitCapabilities(
  connType: ConnectionType | null
): Record<string, unknown> {
  if (connType && supportsPaymaster(connType)) {
    return getSendCallsCapabilities();
  }
  if (connType === "coinbase" || connType === "baseAccount" || connType === "farcaster") {
    return { ...BUILDER_DATA_SUFFIX_CAP };
  }
  // EOAs / injected wallets: builder suffix is appended in calldata — no paymaster.
  return { ...BUILDER_DATA_SUFFIX_CAP };
}

export function usesWalletSendCallsAttribution(
  connType: ConnectionType | null
): boolean {
  return (
    connType === "coinbase" ||
    connType === "baseAccount" ||
    connType === "farcaster"
  );
}

export function supportsPaymaster(connType: ConnectionType): boolean {
  return (
    (connType === "farcaster" ||
      connType === "coinbase" ||
      connType === "baseAccount") &&
    Boolean(PAYMASTER_URL)
  );
}

export const getTxCapabilities = getCapabilities;
