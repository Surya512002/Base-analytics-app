import { PAYMASTER_URL } from "@/lib/constants/env";

/** Wallet capabilities for OnchainKit Transaction (paymaster sponsorship). */
export function getCapabilities() {
  if (!PAYMASTER_URL) return {};
  return { paymasterService: { url: PAYMASTER_URL } };
}

export const getTxCapabilities = getCapabilities;
