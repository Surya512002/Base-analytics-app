import { describe, expect, it } from "vitest";
import { SWAP_ROUTER_02, QUOTER_V2, WETH_BASE } from "@/lib/launchpad/uniswap";
import { AERODROME_ROUTER, AERODROME_FACTORY } from "@/lib/launchpad/aerodrome";
import {
  SLIPSTREAM_SWAP_ROUTER,
  SLIPSTREAM_QUOTER_V2,
} from "@/lib/launchpad/slipstream";
import { USDC_BASE } from "@/lib/launchpad/tokens-base";

const RPC = process.env.BASE_RPC_URL || "https://base-rpc.publicnode.com";

const CONTRACTS: Record<string, string> = {
  "Uniswap SwapRouter02": SWAP_ROUTER_02,
  "Uniswap QuoterV2": QUOTER_V2,
  "Aerodrome Router": AERODROME_ROUTER,
  "Aerodrome PoolFactory": AERODROME_FACTORY,
  "Slipstream SwapRouter": SLIPSTREAM_SWAP_ROUTER,
  "Slipstream QuoterV2": SLIPSTREAM_QUOTER_V2,
  WETH: WETH_BASE,
  USDC: USDC_BASE,
};

async function getCode(address: string): Promise<string> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getCode",
      params: [address, "latest"],
    }),
  });
  const json = (await res.json()) as { result?: string };
  return json.result ?? "0x";
}

/**
 * Guards against the class of bug where a plausible-looking but non-existent
 * address is committed: swaps sent to a codeless address burn the ETH instead
 * of reverting, and quoter calls just return zero, which reads as "no route".
 */
describe("Base DEX contract addresses", () => {
  it.each(Object.entries(CONTRACTS))(
    "%s is deployed on Base",
    async (_name, address) => {
      const code = await getCode(address);
      expect(code.length).toBeGreaterThan(2);
    },
    30_000
  );

  it("QuoterV2 returns a live WETH → USDC price", async () => {
    const pad = (h: string) => h.replace(/^0x/, "").padStart(64, "0");
    const data =
      "0xc6a5026a" +
      pad(WETH_BASE) +
      pad(USDC_BASE) +
      pad((BigInt(10) ** BigInt(16)).toString(16)) +
      pad((500).toString(16)) +
      pad("0");

    const res = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_call",
        params: [{ to: QUOTER_V2, data }, "latest"],
      }),
    });
    const json = (await res.json()) as { result?: string };
    const raw = json.result ?? "0x";
    expect(raw.length).toBeGreaterThan(2);
    expect(BigInt("0x" + raw.slice(2, 66))).toBeGreaterThan(BigInt(0));
  }, 30_000);
});
