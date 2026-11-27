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

/**
 * The name the wallet's owner set as primary on Base, read on-chain; null otherwise. There is no
 * third-party backup: a search by address also matches names that someone else pointed at the wallet.
 */
export async function resolveBasename(address: string): Promise<string | null> {
  if (!address?.startsWith("0x") || address.length !== 42) return null;
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

/** The same lookup, under the name the browser screens import. */
export const resolveBasenameClient = resolveBasename;
