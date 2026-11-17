/**
 * Mainnet simulation harness for auditing app transaction batches.
 * Uses eth_simulateV1 with state overrides: a throwaway address is given USDC/ETH so the
 * exact batches the app would send run against live Base state. Nothing is signed or sent.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/audit/vault-deposit.mts [vault]
 */
import { createPublicClient, http, keccak256, encodeAbiParameters, pad, toHex, type Address, type Hex } from "viem";
import { base } from "viem/chains";
import { finalizeAppTransactionBatch, type ContractCall } from "../../lib/utils/tx";

export const pub = createPublicClient({ chain: base, transport: http(process.env.AUDIT_RPC || "https://mainnet.base.org") });
export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as Address;
export const TEST_USER = "0x00000000000000000000000000000000ba5ea0d1" as Address;

/** USDC (FiatTokenV2_2) keeps balances in mapping slot 9. */
export function usdcBalanceSlot(user: Address): Hex {
  return keccak256(encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [user, BigInt(9)]));
}

export type SimRow = { i: number; to: Address; status: string; gas: bigint; error?: string };

export async function simulate(
  calls: ContractCall[],
  opts: { user?: Address; usdc?: bigint; eth?: bigint } = {}
): Promise<SimRow[]> {
  const user = opts.user ?? TEST_USER;
  const batch = finalizeAppTransactionBatch(calls);
  const stateOverrides = [
    { address: user, balance: opts.eth ?? BigInt(10) ** BigInt(18) },
    ...(opts.usdc
      ? [{ address: USDC, stateDiff: [{ slot: usdcBalanceSlot(user), value: pad(toHex(opts.usdc), { size: 32 }) }] }]
      : []),
  ];
  const sim = await pub.simulateCalls({
    account: user,
    calls: batch.map((c) => ({ to: c.to, data: c.data, value: c.value })),
    stateOverrides,
  });
  return sim.results.map((r, i) => ({
    i,
    to: batch[i].to,
    status: r.status,
    gas: r.gasUsed,
    error:
      r.status === "success"
        ? undefined
        : String((r as { error?: Error }).error?.message ?? "")
            .split("\n")[0]
            .slice(0, 160),
  }));
}
