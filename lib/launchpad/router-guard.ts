import type { Address } from "viem";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import { SWAP_ROUTER_02 } from "@/lib/launchpad/uniswap";
import { AERODROME_ROUTER } from "@/lib/launchpad/aerodrome";
import { SLIPSTREAM_SWAP_ROUTER, SLIPSTREAM_V2_ROUTER } from "@/lib/launchpad/slipstream";
import { ZEROX_ALLOWANCE_HOLDER } from "@/lib/utils/tx";

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

/**
 * The only contracts a swap may approve or call. Quotes come from our server and from 0x; if
 * either were ever tampered with, an unknown address here would make the user approve or pay an
 * attacker. Add a router only after checking its address on BaseScan.
 */
const TRUSTED_SWAP_TARGETS = new Set(
  [SWAP_ROUTER_02, AERODROME_ROUTER, SLIPSTREAM_SWAP_ROUTER, SLIPSTREAM_V2_ROUTER, ZEROX_ALLOWANCE_HOLDER].map(
    (a) => a.toLowerCase()
  )
);

export function isTrustedSwapTarget(address: string | null | undefined): boolean {
  return Boolean(address && TRUSTED_SWAP_TARGETS.has(address.toLowerCase()));
}
