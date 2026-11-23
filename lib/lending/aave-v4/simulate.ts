import { createPublicClient, decodeFunctionResult, encodeFunctionData, http } from "viem";
import { base } from "viem/chains";
import { createBasePublicClient } from "@/lib/utils/base-rpc";
import type { ContractCall } from "@/lib/utils/tx";
import { AAVE_V4_SPOKE, AAVE_V4_SPOKE_ABI } from "./constants";

type Sim = { status: string; returnData: string; error?: { message?: string } };

export type BatchSimulation =
  | { ok: true; healthFactor: number | null }
  | { ok: false; reason: string; failedStep?: number; unavailable?: boolean };

async function run(client: { request: (a: { method: string; params: unknown[] }) => Promise<unknown> }, user: `0x${string}`, calls: ContractCall[]) {
  const withHf = [
    ...calls.map((c) => ({ from: user, to: c.to, data: c.data, value: c.value ? `0x${c.value.toString(16)}` : "0x0" })),
    { from: user, to: AAVE_V4_SPOKE, data: encodeFunctionData({ abi: AAVE_V4_SPOKE_ABI, functionName: "getUserAccountData", args: [user] }) },
  ];
  const res = (await client.request({ method: "eth_simulateV1", params: [{ blockStateCalls: [{ calls: withHf }], validation: false }, "latest"] })) as Array<{ calls: Sim[] }>;
  return res[0].calls;
}

/**
 * Runs the whole batch, in order, against live Base state before the wallet is asked, and reads the
 * contract's own health factor at the end. Unlike checking calls one by one, this sees that call 5
 * works only because call 4 ran. Fails closed: if the check cannot run, the caller must not continue.
 */
export async function simulateBatchAtomically(user: `0x${string}`, calls: ContractCall[]): Promise<BatchSimulation> {
  // The app's RPC first, then Base's public one (not every provider supports eth_simulateV1)
  const clients = [createBasePublicClient() as unknown as Parameters<typeof run>[0], createPublicClient({ chain: base, transport: http("https://mainnet.base.org") }) as unknown as Parameters<typeof run>[0]];
  let lastError = "";
  for (const client of clients) {
    try {
      const results = await run(client, user, calls);
      const failed = results.slice(0, calls.length).findIndex((r) => r.status !== "0x1");
      if (failed !== -1) {
        const msg = results[failed].error?.message ?? "reverted";
        return { ok: false, failedStep: failed + 1, reason: `Step ${failed + 1} of ${calls.length} would fail on-chain: ${msg}` };
      }
      const last = results[calls.length];
      if (!last || last.status !== "0x1") return { ok: true, healthFactor: null };
      const account = decodeFunctionResult({ abi: AAVE_V4_SPOKE_ABI, functionName: "getUserAccountData", data: last.returnData as `0x${string}` });
      const hf = Number(account.healthFactor) / 1e18;
      return { ok: true, healthFactor: account.totalDebtValueRay > BigInt(0) && Number.isFinite(hf) ? hf : null };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, unavailable: true, reason: `Could not check the plan on-chain right now (${lastError.split("\n")[0].slice(0, 120)}). Try again in a moment.` };
}
