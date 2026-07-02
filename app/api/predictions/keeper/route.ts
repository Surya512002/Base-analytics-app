import { NextResponse } from "next/server";
import { runPredictionKeeper } from "@/lib/predictions/keeper";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PREDICTIONS_CONTRACT = process.env.NEXT_PUBLIC_PREDICTIONS_CONTRACT as
  | `0x${string}`
  | undefined;
const BASE_RPC =
  process.env.BASE_RPC_URL ||
  (process.env.NEXT_PUBLIC_ALCHEMY_KEY
    ? `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY}`
    : "");
const KEEPER_KEY = process.env.PREDICTIONS_KEEPER_PRIVATE_KEY as
  | `0x${string}`
  | undefined;
const KEEPER_SECRET = process.env.PREDICTIONS_KEEPER_SECRET || "";

/** POST /api/predictions/keeper — cron hook to open/close/resolve markets. */
export async function POST(req: Request) {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!KEEPER_SECRET || auth !== KEEPER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!PREDICTIONS_CONTRACT || !BASE_RPC || !KEEPER_KEY) {
    return NextResponse.json(
      {
        error:
          "Set NEXT_PUBLIC_PREDICTIONS_CONTRACT, NEXT_PUBLIC_ALCHEMY_KEY, and PREDICTIONS_KEEPER_PRIVATE_KEY",
      },
      { status: 503 }
    );
  }

  const result = await runPredictionKeeper({
    rpcUrl: BASE_RPC,
    contract: PREDICTIONS_CONTRACT,
    privateKey: KEEPER_KEY,
    initialLiquidityUsdc: Number(
      process.env.PREDICTIONS_INITIAL_LIQUIDITY_USDC || "10000"
    ),
  });

  return NextResponse.json({ ok: true, ...result });
}
