import { createBasePublicClient, withRpcRetry } from "@/lib/utils/base-rpc";

const BASE_REVERSE_REGISTRAR =
  "0x79EA96012eEa67A83431F1701B3dFf7e37F9E282" as `0x${string}`;
const BASE_L2_RESOLVER =
  "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD" as `0x${string}`;

const REVERSE_REGISTRAR_ABI = [
  {
    name: "node",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "addr", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

const NAME_RESOLVER_ABI = [
  {
    name: "name",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "node", type: "bytes32" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

function normalizeName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed || trimmed === "null") return null;
  return trimmed;
}

async function resolveBasenameOnchain(address: string): Promise<string | null> {
  const pub = createBasePublicClient();

  return withRpcRetry(async () => {
    const reverseNode = await pub.readContract({
      address: BASE_REVERSE_REGISTRAR,
      abi: REVERSE_REGISTRAR_ABI,
      functionName: "node",
      args: [address as `0x${string}`],
    });

    if (!reverseNode || reverseNode === `0x${"0".repeat(64)}`) return null;

    const name = await pub.readContract({
      address: BASE_L2_RESOLVER,
      abi: NAME_RESOLVER_ABI,
      functionName: "name",
      args: [reverseNode],
    });

    return normalizeName(name);
  }).catch(() => null);
}

/** Blockscout quick search — fallback when RPC reverse lookup fails or rate-limits. */
export async function resolveBasenameBlockscout(
  address: string
): Promise<string | null> {
  try {
    const addr = address.toLowerCase();
    const res = await fetch(
      `https://base.blockscout.com/api/v2/search/quick?q=${encodeURIComponent(addr)}`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;

    const items = (await res.json()) as {
      type?: string;
      address_hash?: string;
      ens_info?: { name?: string | null };
    }[];

    if (!Array.isArray(items)) return null;

    for (const item of items) {
      if (item.type !== "ens_domain") continue;
      if (item.address_hash?.toLowerCase() !== addr) continue;
      const name = normalizeName(item.ens_info?.name);
      if (name) return name;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Resolve Basename / .base.eth for an address.
 * On-chain + Blockscout in parallel — fastest wins.
 */
export async function resolveBasename(
  address: string,
  options: { quick?: boolean } = {}
): Promise<string | null> {
  if (!address?.startsWith("0x") || address.length !== 42) return null;

  if (options.quick) {
    return resolveBasenameBlockscout(address);
  }

  const [onchain, blockscout] = await Promise.all([
    resolveBasenameOnchain(address),
    resolveBasenameBlockscout(address),
  ]);

  return onchain ?? blockscout;
}

/** Client-side resolve — uses app RPC fallbacks (not rate-limited public only). */
export async function resolveBasenameClient(
  address: string
): Promise<string | null> {
  try {
    const pub = createBasePublicClient();
    const reverseNode = await pub.readContract({
      address: BASE_REVERSE_REGISTRAR,
      abi: REVERSE_REGISTRAR_ABI,
      functionName: "node",
      args: [address as `0x${string}`],
    });
    if (!reverseNode || reverseNode === `0x${"0".repeat(64)}`) {
      return resolveBasenameBlockscout(address);
    }
    const name = await pub.readContract({
      address: BASE_L2_RESOLVER,
      abi: NAME_RESOLVER_ABI,
      functionName: "name",
      args: [reverseNode],
    });
    return normalizeName(name) ?? (await resolveBasenameBlockscout(address));
  } catch {
    return resolveBasenameBlockscout(address);
  }
}
