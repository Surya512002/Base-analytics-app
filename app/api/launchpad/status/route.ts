import { NextResponse } from "next/server";
import { isB20AssetActivated } from "@/lib/b20/activation";

export const dynamic = "force-dynamic";

export async function GET() {
  const activated = await isB20AssetActivated();
  return NextResponse.json({ activated });
}
