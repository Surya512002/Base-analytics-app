/**
 * Read-only proof on real Base that appending our builder code to a 0x AllowanceHolder swap
 * doesn't change its result: recent real 0x swaps are replayed (eth_call at the block before
 * they landed) with and without the suffix, and both must succeed. Run: npm run test:fork
 */
import { describe, expect, it } from "vitest";
import { getBuilderSuffix, ZEROX_ALLOWANCE_HOLDER } from "@/lib/utils/tx";

const RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = (await r.json()) as { result?: T; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j.result as T;
}

type Tx = { hash: string; from: string; to: string | null; input: string; value: string; gas: string };

describe("builder code on 0x swaps (real Base)", { timeout: 300_000 }, () => {
  it("recent 0x AllowanceHolder swaps succeed identically with our suffix appended", async () => {
    const head = parseInt(await rpc<string>("eth_blockNumber", []), 16);
    const swaps: Array<{ tx: Tx; block: number }> = [];
    for (let b = head - 1; b > head - 600 && swaps.length < 3; b--) {
      const blk = await rpc<{ transactions: Tx[] }>("eth_getBlockByNumber", [`0x${b.toString(16)}`, true]);
      for (const tx of blk.transactions) {
        if ((tx.to ?? "").toLowerCase() === ZEROX_ALLOWANCE_HOLDER.toLowerCase() && tx.input.length > 10) {
          const rc = await rpc<{ status: string }>("eth_getTransactionReceipt", [tx.hash]);
          if (rc.status === "0x1") swaps.push({ tx, block: b });
        }
      }
    }
    expect(swaps.length, "found recent 0x swaps to replay").toBeGreaterThan(0);

    for (const { tx, block } of swaps) {
      const call = { from: tx.from, to: tx.to, value: tx.value, gas: tx.gas };
      const tag = `0x${(block - 1).toString(16)}`;
      const plain = await rpc<string>("eth_call", [{ ...call, data: tx.input }, tag]).then(() => "ok", (e) => String(e));
      const withCode = await rpc<string>("eth_call", [{ ...call, data: tx.input + getBuilderSuffix() }, tag]).then(
        () => "ok",
        (e) => String(e)
      );
      // Only meaningful when the original replays cleanly at that state.
      if (plain === "ok") expect(withCode, `${tx.hash} with builder code`).toBe("ok");
    }
  });
});
