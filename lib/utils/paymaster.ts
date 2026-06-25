import { PAYMASTER_URL } from "@/lib/constants/env";

export function getCapabilities() {
  if (!PAYMASTER_URL) return {};
  return { paymasterService: { url: PAYMASTER_URL } };
}
