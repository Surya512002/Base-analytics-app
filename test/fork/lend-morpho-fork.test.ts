/**
 * Read-only checks against REAL Base mainnet (no wallet, no funds, nothing is sent):
 * the Morpho borrow markets the Lend page shows must be the markets Morpho itself stores, and
 * the exact calls the app builds must be accepted by the Morpho contract in an eth_call
 * simulation from a real borrower.  Run with: npm run test:fork
 */
import { describe, expect, it } from "vitest";
import { createPublicClient, decodeFunctionData, erc20Abi, http, parseAbi, type Address } from "viem";
import { base } from "viem/chains";
import { morphoAdapter } from "@/lib/lending/discovery/adapters/morpho";
import { getUnifiedStockLendingComparison } from "@/lib/lending/unified-comparison";
import { buildUnifiedProtocolCalls } from "@/lib/lending/protocol-adapters";
import { getMorphoMarketId } from "@/lib/lending/morpho-blue";
import { MORPHO_BLUE_ABI, MORPHO_BLUE_BASE } from "@/lib/lending/constants";
import { isBaseVerifiedStockAddress } from "@/lib/stocks/base-verified";

const RPC = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const client = createPublicClient({ chain: base, transport: http(RPC, { timeout: 20_000 }) });

async function healthyBorrowers(marketId: string): Promise<Address[]> {
  const query = `query($id:[String!]){ marketPositions(first:5, where:{chainId_in:[8453], marketUniqueKey_in:$id, borrowShares_gte:"1", healthFactor_gte:1.3}){ items{ user{ address } } } }`;
  const r = await fetch("https://blue-api.morpho.org/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { id: [marketId] } }),
  });
  const j = await r.json();
  return (j?.data?.marketPositions?.items ?? []).map((p: { user: { address: Address } }) => p.user.address);
}

describe("Lend: Morpho stock borrow markets on real Base", { timeout: 120_000 }, () => {
  it("every market shown is the market Morpho stores, and the app's calls simulate successfully", async () => {
    const markets = (await morphoAdapter.discoverMarkets(8453)).filter(
      (m) => m.collateralAsset && isBaseVerifiedStockAddress(m.collateralAsset.address)
    );
    expect(markets.length).toBeGreaterThan(0);

    let simulatedBorrows = 0;
    const report: string[] = [];
    for (const m of markets) {
      const params = m.morphoParams!;
      // 1. Same market as on-chain
      expect(m.contractAddress?.toLowerCase()).toBe(MORPHO_BLUE_BASE.toLowerCase());
      expect(getMorphoMarketId(params).toLowerCase()).toBe(m.marketId.toLowerCase());
      const [loan, collateral, oracle, irm, lltv] = (await client.readContract({
        address: MORPHO_BLUE_BASE,
        abi: MORPHO_BLUE_ABI,
        functionName: "idToMarketParams",
        args: [m.marketId as `0x${string}`],
      })) as [Address, Address, Address, Address, bigint];
      expect(loan.toLowerCase()).toBe(params.loanToken.toLowerCase());
      expect(collateral.toLowerCase()).toBe(params.collateralToken.toLowerCase());
      expect(oracle.toLowerCase()).toBe(params.oracle.toLowerCase());
      expect(irm.toLowerCase()).toBe(params.irm.toLowerCase());
      expect(lltv).toBe(params.lltv);

      // 2. The option the UI builds (same path as the Borrow button)
      const sym = m.collateralAsset!.symbol;
      const comp = await getUnifiedStockLendingComparison(sym, undefined, false, markets);
      const opt = comp.options.find((o) => o.id === `morpho-${m.marketId}`);
      expect(opt, `${sym} option`).toBeDefined();

      // "Supply collateral" = approve the STOCK to MORPHO, then supplyCollateral on Morpho
      const [approve, supply] = buildUnifiedProtocolCalls({ option: opt!, action: "supply", amountRaw: 1n, userAddress: "0x000000000000000000000000000000000000dEaD" });
      expect(approve.to.toLowerCase()).toBe(params.collateralToken.toLowerCase());
      const approveArgs = decodeFunctionData({ abi: erc20Abi, data: approve.data.slice(0, 138) as `0x${string}` }).args as [Address, bigint];
      expect(approveArgs[0].toLowerCase()).toBe(MORPHO_BLUE_BASE.toLowerCase());
      expect(supply.to.toLowerCase()).toBe(MORPHO_BLUE_BASE.toLowerCase());

      // 3. Simulate the app's exact borrow call from real healthy borrowers (1 micro-USDC)
      const borrowers = await healthyBorrowers(m.marketId);
      for (const who of borrowers) {
        const [borrow] = buildUnifiedProtocolCalls({ option: opt!, action: "borrow", amountRaw: 1n, userAddress: who });
        expect(borrow.to.toLowerCase()).toBe(MORPHO_BLUE_BASE.toLowerCase());
        try {
          await client.call({ account: who, to: borrow.to, data: borrow.data });
          simulatedBorrows++;
          report.push(`${sym}: borrow simulated OK from ${who.slice(0, 8)}…`);
          break;
        } catch (e) {
          // A borrower at their limit or an empty market can revert; try the next one.
          const msg = e instanceof Error ? e.message : String(e);
          if (!/insufficient (collateral|liquidity)/i.test(msg)) throw e;
        }
      }
    }
    console.info([`[lend fork] ${markets.length} markets match on-chain params`, ...report].join(" | "));
    // At least one real borrow must go through end to end in simulation.
    expect(simulatedBorrows).toBeGreaterThan(0);
  });

  it("builder-code suffix doesn't break Morpho calls (calldata still decodes)", async () => {
    const markets = await morphoAdapter.discoverMarkets(8453);
    const m = markets.find((x) => x.collateralAsset && isBaseVerifiedStockAddress(x.collateralAsset.address))!;
    const comp = await getUnifiedStockLendingComparison(m.collateralAsset!.symbol, undefined, false, markets);
    const opt = comp.options.find((o) => o.id === `morpho-${m.marketId}`)!;
    const [borrow] = buildUnifiedProtocolCalls({ option: opt, action: "borrow", amountRaw: 5n, userAddress: "0x000000000000000000000000000000000000dEaD" });
    const decoded = decodeFunctionData({ abi: MORPHO_BLUE_ABI, data: borrow.data });
    expect(decoded.functionName).toBe("borrow");
    expect(decoded.args?.[1]).toBe(5n);
    void parseAbi;
  });
});

describe("Lend: single-stock vault deposits on real Base", { timeout: 120_000 }, () => {
  it("each in-app Deposit vault takes the official stock itself as its deposit token", async () => {
    const { beefyAdapter } = await import("@/lib/lending/discovery/adapters/beefy");
    const vaults = (await beefyAdapter.discoverMarkets(8453)).filter(
      (m) => m.collateralAsset && m.supplyAsset.symbol === m.collateralAsset.symbol
    );
    expect(vaults.length).toBeGreaterThan(0);
    for (const v of vaults) {
      const want = (await client.readContract({
        address: v.contractAddress!,
        abi: parseAbi(["function want() view returns (address)"]),
        functionName: "want",
      })) as Address;
      expect(want.toLowerCase(), v.marketId).toBe(v.collateralAsset!.address.toLowerCase());
      expect(isBaseVerifiedStockAddress(want), v.marketId).toBe(true);
    }
    console.info(`[lend fork] ${vaults.length} single-stock vaults take the official stock as deposit`);
  });
});
