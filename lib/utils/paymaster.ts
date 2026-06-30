import { PAYMASTER_URL } from "@/lib/constants/env";
import { getBuilderDataSuffix } from "@/lib/utils/tx";
import type { ConnectionType } from "@/lib/types/wallet";

/** Wallet capabilities for OnchainKit Transaction (paymaster sponsorship). */
export function getCapabilities() {
  if (!PAYMASTER_URL) return {};
  return { paymasterService: { url: PAYMASTER_URL } };
}

/** EIP-5792 capabilities for wallet_sendCalls (paymaster + builder attribution). */
export function getSendCallsCapabilities(): Record<string, unknown> {
  const caps: Record<string, unknown> = {
    dataSuffix: {
      value: getBuilderDataSuffix(),
      optional: true,
    },
  };
  if (PAYMASTER_URL) {
    caps.paymasterService = { url: PAYMASTER_URL };
  }
  return caps;
}

export function supportsPaymaster(connType: ConnectionType): boolean {
  return (
    (connType === "farcaster" || connType === "coinbase") &&
    Boolean(PAYMASTER_URL)
  );
}

export const getTxCapabilities = getCapabilities;
