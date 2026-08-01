import { NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";
import { VOUCHER_ABI } from "@/lib/constants/contracts";
import {
  VOUCHER_CONTRACT,
  alchemyRpcForKey,
  getAlchemyKey,
  BASE_RPC,
} from "@/lib/constants/env";
import { parseCardId, tokenToAsset } from "@/lib/utils/voucher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const cardId = new URL(req.url).searchParams.get("card")?.trim();
  const parsed = cardId ? parseCardId(cardId) : null;

  if (!parsed || !VOUCHER_CONTRACT) {
    return NextResponse.json({ error: "Invalid card or contract not configured" }, { status: 400 });
  }

  try {
    const alchemyKey = getAlchemyKey();
    const rpcUrl = alchemyKey ? alchemyRpcForKey(alchemyKey) : BASE_RPC;
    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    });

    const [batch, redeemed] = await Promise.all([
      client.readContract({
        address: VOUCHER_CONTRACT as `0x${string}`,
        abi: VOUCHER_ABI,
        functionName: "getBatch",
        args: [BigInt(parsed.batchId)],
      }),
      client.readContract({
        address: VOUCHER_CONTRACT as `0x${string}`,
        abi: VOUCHER_ABI,
        functionName: "isCardRedeemed",
        args: [BigInt(parsed.batchId), BigInt(parsed.cardIndex)],
      }),
    ]);

    const [, token, amountPerCard, cardCount, , message] = batch;
    if (cardCount === BigInt(0)) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const asset = tokenToAsset(token as string);

    return NextResponse.json({
      cardId,
      batchId: parsed.batchId,
      asset,
      amountPerCard: amountPerCard.toString(),
      message: message as string,
      redeemed: Boolean(redeemed),
      cardCount: Number(cardCount),
    });
  } catch (e) {
    console.error("[card-preview]", e);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
