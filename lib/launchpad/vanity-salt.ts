import { keccak256, toBytes } from "viem";
import { B20_FACTORY_ADDRESS, B20_VARIANT_ASSET } from "@/lib/b20/constants";
import { B20_FACTORY_ABI } from "@/lib/b20/encode";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

export interface VanityResult {
  salt: `0x${string}`;
  address: `0x${string}`;
  attempts: number;
}

/** Grind a B20 vanity address (all assets start with 0xB200…; optional suffix match). */
export async function grindVanityAddress(
  creator: `0x${string}`,
  options?: {
    suffix?: string;
    maxAttempts?: number;
    onProgress?: (attempts: number) => void;
  }
): Promise<VanityResult | null> {
  const maxAttempts = options?.maxAttempts ?? 40_000;
  const suffix = options?.suffix?.toLowerCase().replace(/^0x/, "");
  const pub = createBasePublicClient();
  const batch = 80;

  for (let i = 0; i < maxAttempts; i += batch) {
    const promises: Promise<VanityResult | null>[] = [];
    for (let j = 0; j < batch && i + j < maxAttempts; j++) {
      const attempt = i + j;
      const salt = keccak256(toBytes(`vanity:${creator.toLowerCase()}:${attempt}`));
      promises.push(
        pub
          .readContract({
            address: B20_FACTORY_ADDRESS,
            abi: B20_FACTORY_ABI,
            functionName: "getB20Address",
            args: [B20_VARIANT_ASSET, creator, salt],
          })
          .then((address) => {
            const addr = address.toLowerCase();
            if (suffix && !addr.endsWith(suffix)) return null;
            return { salt, address, attempts: attempt + 1 };
          })
          .catch(() => null)
      );
    }
    const results = await Promise.all(promises);
    const hit = results.find(Boolean);
    if (hit) return hit;
    options?.onProgress?.(Math.min(i + batch, maxAttempts));
    await new Promise((r) => setTimeout(r, 0));
  }
  return null;
}

export function shortVanityAddress(addr: string | null): string {
  if (!addr) return "0xb20000…";
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}
