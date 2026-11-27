/**
 * Read-only check on real Base mainnet: positions are read in grouped (Multicall3) requests, and a
 * real borrower's Morpho loan must still show up. Run with: npm run test:fork
 */
import { expect, it } from "vitest";
import { morphoAdapter } from "@/lib/lending/discovery/adapters/morpho";
import { fetchAllUserPositions } from "@/lib/lending/user-positions";

it("grouped reads still return a real borrower's loan", { timeout: 120_000 }, async () => {
  const markets = await morphoAdapter.discoverMarkets(8453);
  const query = `query($id:[String!]){ marketPositions(first:1, where:{chainId_in:[8453], marketUniqueKey_in:$id, borrowShares_gte:"1"}){ items{ user{ address } } } }`;
  const r = await fetch("https://blue-api.morpho.org/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { id: markets.map((m) => m.marketId) } }),
  });
  const borrower = (await r.json()).data.marketPositions.items[0].user.address;

  const res = await fetchAllUserPositions(borrower, markets);

  expect(res.errors).toEqual({});
  expect(res.positions.some((p) => p.protocol === "morpho" && p.borrowedUsd > 0)).toBe(true);
});
