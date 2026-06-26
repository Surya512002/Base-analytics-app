import { NextResponse } from "next/server";
import {
  fetchAlchemyTxsFast,
  fetchAlchemyTxsIncoming,
} from "@/lib/api/alchemy";
import {
  fetchBlockscoutInternalTxs,
  fetchBlockscoutTxs,
} from "@/lib/api/blockscout";
import { fetchBasescanTxs } from "@/lib/api/basescan";
import { mergeTransfers } from "@/lib/utils/wallet-activity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address")?.trim();

  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const basescanKey =
    process.env.BASESCAN_API_KEY ||
    process.env.NEXT_PUBLIC_BASESCAN_API_KEY ||
    "";

  try {
    const [alchemyOut, alchemyIn, blockscoutTxs, internalTxs, basescanTxs] =
      await Promise.all([
        fetchAlchemyTxsFast(address).catch(() => []),
        fetchAlchemyTxsIncoming(address).catch(() => []),
        fetchBlockscoutTxs(address).catch(() => []),
        fetchBlockscoutInternalTxs(address).catch(() => []),
        fetchBasescanTxs(address, basescanKey).catch(() => []),
      ]);

    const transfers = mergeTransfers([
      alchemyOut,
      alchemyIn,
      blockscoutTxs,
      internalTxs,
      basescanTxs,
    ]);

    return NextResponse.json({
      transfers,
      sources: {
        alchemyOut: alchemyOut.length,
        alchemyIn: alchemyIn.length,
        blockscout: blockscoutTxs.length,
        internal: internalTxs.length,
        basescan: basescanTxs.length,
        merged: transfers.length,
      },
    });
  } catch (err) {
    console.error("[wallet-txs]", err);
    return NextResponse.json({ transfers: [], sources: {} });
  }
}
