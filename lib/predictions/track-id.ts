import { keccak256, toBytes } from "viem";

/** Matches `keccak256(bytes(trackId))` used when opening markets on-chain. */
export function encodeTrackId(trackId: string): `0x${string}` {
  return keccak256(toBytes(trackId));
}
