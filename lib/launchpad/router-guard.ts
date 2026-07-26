import type { Address } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

/**
 * Routers verified to hold code on Base during this session.
 *
 * Sending a swap to an address with no contract code does not revert — the ETH
 * is simply accepted and lost — so every direct-DEX route is checked once
 * before its first use.
 */
const verified = new Map<string, boolean>();

export async function routerHasCode(router: Address): Promise<boolean> {
  const key = router.toLowerCase();
  const cached = verified.get(key);
  if (cached !== undefined) return cached;

  try {
    const pub = createBasePublicClient();
    const code = await pub.getCode({ address: router });
    const ok = Boolean(code && code !== "0x");
    verified.set(key, ok);
    return ok;
  } catch {
    // An RPC outage must not block trading — fail open and re-check next time.
    return true;
  }
}
