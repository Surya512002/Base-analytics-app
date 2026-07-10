import { NextResponse } from "next/server";
import { getAlchemyKey } from "@/lib/constants/env";

export const dynamic = "force-dynamic";

/** Lightweight deploy health — missing optional env vars only. */
export async function GET() {
  const checks = {
    alchemy: Boolean(getAlchemyKey()),
    redis: Boolean(process.env.KV_REDIS_URL?.trim()),
    voucherContract: Boolean(process.env.NEXT_PUBLIC_VOUCHER_CONTRACT?.trim()),
    appUrl: Boolean(
      process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim()
    ),
  };

  return NextResponse.json({
    ok: true,
    checks,
    timestamp: new Date().toISOString(),
  });
}
