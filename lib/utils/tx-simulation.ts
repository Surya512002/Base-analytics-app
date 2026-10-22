import { type Address, type PublicClient } from "viem";
import type { ContractCall } from "./tx";

export interface SimulationResult {
  ok: boolean;
  restrictionFailed?: boolean;
  reason?: string;
}

/**
 * Pre-simulates transactions on Base mainnet before prompting user wallet.
 * Catches token transfer restrictions, allowlists, pauses, and blocklists.
 */
export async function simulateCallsBeforeExecution(
  client: { call: (args: any) => Promise<any> },
  user: Address,
  calls: ContractCall[]
): Promise<SimulationResult> {
  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];
    try {
      await client.call({
        account: user,
        to: call.to,
        data: call.data,
        value: call.value,
      });
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : String(error);
      const isRestriction =
        /restriction|allowlist|whitelist|not eligible|blocked|blacklisted|frozen|paused|transfer not allowed|unauthorized/i.test(
          msg
        );

      if (isRestriction) {
        return {
          ok: false,
          restrictionFailed: true,
          reason: "This token has transfer restrictions. You may not be eligible.",
        };
      }

      // Check for custom revert errors or general revert
      if (/execution reverted|revert/i.test(msg)) {
        // Could be a transfer restriction custom error
        if (/transfer|token|compliance/i.test(msg)) {
          return {
            ok: false,
            restrictionFailed: true,
            reason: "This token has transfer restrictions. You may not be eligible.",
          };
        }
        return {
          ok: false,
          reason: "Transaction simulation reverted on-chain. Please check balances and parameters.",
        };
      }

      // Other network / RPC error
      return {
        ok: false,
        reason: msg.split("\n")[0],
      };
    }
  }

  return { ok: true };
}
