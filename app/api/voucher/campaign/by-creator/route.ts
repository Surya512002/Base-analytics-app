import { NextResponse } from "next/server";
import { encodeEventTopics, isAddress, pad } from "viem";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/api/rate-limit";
import { CAMPAIGN_CONTRACT } from "@/lib/constants/env";
import { CAMPAIGN_ABI } from "@/lib/voucher/campaign-abi";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Campaign counts up to this are read straight from contract state (fast, complete). */
const STATE_SCAN_MAX = 5_000;

/**
 * Campaign IDs created by `creator`, read from contract state: nextCampaignId, then
 * getCampaign(id).creator for every id via Multicall. Complete for any age (the log fallback
 * only covered the last ~200k blocks, so campaigns older than ~4.6 days vanished from
 * "My gifts" along with their refund button). Returns null when the count is too large or
 * the read fails, so the caller can fall back to logs.
 */
async function campaignIdsByCreatorFromState(
  client: ReturnType<typeof createBasePublicClient>,
  contract: `0x${string}`,
  creator: string
): Promise<string[] | null> {
  try {
    const next = (await client.readContract({ address: contract, abi: CAMPAIGN_ABI, functionName: "nextCampaignId" })) as bigint;
    const total = Number(next) - 1;
    if (total <= 0) return [];
    if (total > STATE_SCAN_MAX) return null;
    const want = creator.toLowerCase();
    const ids: string[] = [];
    for (let start = 1; start <= total; start += 100) {
      const chunk = Array.from({ length: Math.min(100, total - start + 1) }, (_, i) => BigInt(start + i));
      const results = await client.multicall({
        contracts: chunk.map((id) => ({ address: contract, abi: CAMPAIGN_ABI, functionName: "getCampaign" as const, args: [id] as const })),
        allowFailure: true,
      });
      results.forEach((r, i) => {
        if (r.status !== "success") return;
        const c = r.result as unknown as { creator?: string } | [{ creator?: string }];
        const obj = Array.isArray(c) ? c[0] : c;
        if (String(obj?.creator ?? "").toLowerCase() === want) ids.push(chunk[i].toString());
      });
    }
    return ids;
  } catch (err) {
    console.warn("[voucher/campaign by-creator] state scan failed", err);
    return null;
  }
}

/** Block BaseVoucherCampaign v2 was deployed in on Base mainnet — nothing to scan before it. */
const DEPLOY_BLOCK = BigInt(process.env.CAMPAIGN_DEPLOY_BLOCK || "56762521");

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

  // 0) Contract state: complete and independent of log-range limits.
  const fromState = await campaignIdsByCreatorFromState(createBasePublicClient(), CAMPAIGN_CONTRACT, address);
  if (fromState) {
    return NextResponse.json(
      { ids: fromState.sort((a, b) => Number(BigInt(b) - BigInt(a))) },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

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
