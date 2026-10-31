import { NextResponse } from "next/server";
import {
  recordUniqueUser,
  getUniqueUserCount,
  getFormattedUniqueUserCount,
} from "@/lib/redis-unique-users";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET() {
  const count = await getUniqueUserCount();
  const formatted = await getFormattedUniqueUserCount();
  return NextResponse.json(
    {
      ok: true,
      count,
      formatted,
    },
    { headers: NO_CACHE_HEADERS }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const address = typeof body?.address === "string" ? body.address : "";
    const count = await recordUniqueUser(address);
    const formatted = count.toLocaleString();
    return NextResponse.json(
      {
        ok: true,
        count,
        formatted,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch {
    const count = await getUniqueUserCount();
    const formatted = count.toLocaleString();
    return NextResponse.json(
      {
        ok: true,
        count,
        formatted,
      },
      { headers: NO_CACHE_HEADERS }
    );
  }
}
