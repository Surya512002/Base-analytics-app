/** Find the ERC-20 balance mapping slot of a token by probing with state overrides. */
import { encodeAbiParameters, erc20Abi, keccak256, pad, toHex, type Address, type Hex } from "viem";
import { pub, TEST_USER } from "./sim-harness.mts";

export async function findBalanceSlot(token: Address): Promise<Hex | null> {
  const probe = BigInt(123456789);
  // Plain layouts (0..300) and OpenZeppelin v5 namespaced ERC20 storage.
  const NAMESPACED = BigInt("0x52c63247e1f47db19d5ce0460030c497f067ca4cebf71ba98eeadabe20bace00");
  const candidates: bigint[] = [NAMESPACED, ...Array.from({ length: 301 }, (_, i) => BigInt(i))];
  for (const slot of candidates) {
    const key = keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [TEST_USER, slot]));
    const r = await pub
      .call({
        to: token,
        data: `0x70a08231${TEST_USER.slice(2).padStart(64, "0")}`,
        stateOverride: [{ address: token, stateDiff: [{ slot: key, value: pad(toHex(probe), { size: 32 }) }] }],
      })
      .catch(() => null);
    if (r?.data && BigInt(r.data) === probe) return key;
  }
  return null;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  for (const t of process.argv.slice(2) as Address[]) {
    const bal = await pub.readContract({ address: t, abi: erc20Abi, functionName: "balanceOf", args: [TEST_USER] });
    console.log(t, "slot key:", await findBalanceSlot(t), "real bal", bal);
  }
}
