import { PAYMASTER_URL } from "@/lib/constants/env";
import { getBuilderDataSuffix } from "@/lib/utils/tx";
import type { ConnectionType } from "@/lib/types/wallet";

const BUILDER_DATA_SUFFIX_CAP = {
  dataSuffix: {
    value: getBuilderDataSuffix(),
    optional: true,
  },
};

/** EIP-5792 capabilities for wallet_sendCalls (paymaster + builder attribution). */
export function getSendCallsCapabilities(): Record<string, unknown> {
  const caps: Record<string, unknown> = { ...BUILDER_DATA_SUFFIX_CAP };
  if (PAYMASTER_URL) {
    caps.paymasterService = { url: PAYMASTER_URL };
  }
  return caps;
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
  if (connType === "coinbase" || connType === "farcaster") {
    return { ...BUILDER_DATA_SUFFIX_CAP };
  }
  return getCapabilities();
}

export function usesWalletSendCallsAttribution(
  connType: ConnectionType | null
): boolean {
  return connType === "coinbase" || connType === "farcaster";
}

export function supportsPaymaster(connType: ConnectionType): boolean {
  return (
    (connType === "farcaster" || connType === "coinbase") &&
    Boolean(PAYMASTER_URL)
  );
}

export const getTxCapabilities = getCapabilities;
