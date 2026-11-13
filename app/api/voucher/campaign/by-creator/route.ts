import { NextResponse } from "next/server";
import { encodeEventTopics, isAddress, pad } from "viem";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import { CAMPAIGN_CONTRACT } from "@/lib/constants/env";
import { CAMPAIGN_ABI } from "@/lib/voucher/campaign-abi";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Block the mainnet BaseVoucherCampaign was deployed in — nothing to scan before it. */
const DEPLOY_BLOCK = BigInt(process.env.CAMPAIGN_DEPLOY_BLOCK || "56557355");

/**
 * GET /api/voucher/campaign/by-creator?address=0x…
 * Campaign IDs created by a wallet, read from onchain CampaignCreated events, so the sender can
 * find and refund campaigns from any device (the claim secret is never involved).
 */
export async function GET(req: Request) {
  if (!CAMPAIGN_CONTRACT) return NextResponse.json({ ids: [] });
  const address = new URL(req.url).searchParams.get("address")?.trim() || "";
  if (!isAddress(address)) return NextResponse.json({ error: "address must be a valid address" }, { status: 400 });

  const rl = await checkRateLimitAsync(`campaign-by-creator:${getClientIp(req)}`, 20, 60_000);
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const [topic0] = encodeEventTopics({ abi: CAMPAIGN_ABI, eventName: "CampaignCreated" });
  const topic2 = pad(address.toLowerCase() as `0x${string}`, { size: 32 });
  const ids = new Set<string>();

  // 1) Basescan logs API: one call covers the whole history.
  const key = process.env.BASESCAN_API_KEY;
  let ok = false;
  if (key) {
    try {
      const url =
        `https://api.etherscan.io/v2/api?chainid=8453&module=logs&action=getLogs&address=${CAMPAIGN_CONTRACT}` +
        `&fromBlock=${DEPLOY_BLOCK}&toBlock=latest&topic0=${topic0}&topic0_2_opr=and&topic2=${topic2}&apikey=${key}`;
      const r = await fetch(url, { cache: "no-store" });
      const j = (await r.json()) as { status: string; message: string; result: Array<{ topics: string[] }> | string };
      if (Array.isArray(j.result)) {
        for (const log of j.result) ids.add(BigInt(log.topics[1]).toString());
        ok = true;
      } else if (j.message === "No records found") {
        ok = true;
      }
    } catch {
      /* fall through to RPC */
    }
  }

  // 2) Fallback: RPC over recent blocks (chunked to stay under provider limits).
  if (!ok) {
    try {
      const client = createBasePublicClient();
      const latest = await client.getBlockNumber();
      const floor = latest > 200_000n ? latest - 200_000n : 0n;
      const start = DEPLOY_BLOCK > floor ? DEPLOY_BLOCK : floor;
      for (let from = start; from <= latest; from += 10_000n) {
        const to = from + 9_999n > latest ? latest : from + 9_999n;
        const logs = await client.getContractEvents({
          address: CAMPAIGN_CONTRACT,
          abi: CAMPAIGN_ABI,
          eventName: "CampaignCreated",
          args: { creator: address as `0x${string}` },
          fromBlock: from,
          toBlock: to,
        });
        for (const l of logs) ids.add((l.args.campaignId as bigint).toString());
      }
      ok = true;
    } catch (err) {
      console.error("[voucher/campaign by-creator]", err);
    }
  }

  if (!ok) return NextResponse.json({ error: "Could not read campaigns" }, { status: 502 });
  return NextResponse.json(
    { ids: [...ids].sort((a, b) => Number(BigInt(b) - BigInt(a))) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
