/**
 * Address Merkle trees in the format BaseDrops verifies (OpenZeppelin StandardMerkleTree style):
 * leaf = keccak256(bytes.concat(keccak256(abi.encode(address)))), parents hash sorted pairs.
 * Used for allowlists (claimer addresses) and one-time codes (code key addresses).
 */
import { concat, encodeAbiParameters, keccak256, type Hex } from "viem";

export function addressLeaf(address: string): Hex {
  return keccak256(concat([keccak256(encodeAbiParameters([{ type: "address" }], [address as `0x${string}`]))]));
}

function hashPair(a: Hex, b: Hex): Hex {
  return BigInt(a) < BigInt(b) ? keccak256(concat([a, b])) : keccak256(concat([b, a]));
}

export interface AddressTree {
  root: Hex;
  /** Proof for an address, or null if it isn't in the tree. */
  proof(address: string): Hex[] | null;
}

/** Build a tree over unique addresses (case-insensitive). Needs at least one address. */
export function buildAddressTree(addresses: readonly string[]): AddressTree {
  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
  if (unique.length === 0) throw new Error("Empty list");
  const leaves = unique.map(addressLeaf).sort((x, y) => (BigInt(x) < BigInt(y) ? -1 : BigInt(x) > BigInt(y) ? 1 : 0));

  // levels[0] = leaves; an odd node is carried up unchanged.
  const levels: Hex[][] = [leaves];
  while (levels[levels.length - 1]!.length > 1) {
    const cur = levels[levels.length - 1]!;
    const next: Hex[] = [];
    for (let i = 0; i < cur.length; i += 2) next.push(i + 1 < cur.length ? hashPair(cur[i]!, cur[i + 1]!) : cur[i]!);
    levels.push(next);
  }
  const root = levels[levels.length - 1]![0]!;

  return {
    root,
    proof(address) {
      const leaf = addressLeaf(address.toLowerCase());
      let idx = leaves.indexOf(leaf);
      if (idx < 0) return null;
      const proof: Hex[] = [];
      for (let l = 0; l < levels.length - 1; l++) {
        const level = levels[l]!;
        const sibling = idx % 2 === 0 ? idx + 1 : idx - 1;
        if (sibling < level.length) proof.push(level[sibling]!);
        idx = Math.floor(idx / 2);
      }
      return proof;
    },
  };
}

/** Same check the contract runs (for tests and pre-flight). */
export function verifyProof(proof: readonly Hex[], root: Hex, leaf: Hex): boolean {
  let h = leaf;
  for (const p of proof) h = hashPair(h, p);
  return h.toLowerCase() === root.toLowerCase();
}
