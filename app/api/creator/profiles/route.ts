import { NextResponse } from "next/server";
import { getCreatorProfiles } from "@/lib/launchpad/creator-profile-store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("addresses")?.trim();
  if (!raw) {
    return NextResponse.json({ error: "addresses query required" }, { status: 400 });
  }

  const addresses = raw
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter((a) => a.startsWith("0x") && a.length === 42)
    .slice(0, 50);

  if (addresses.length === 0) {
    return NextResponse.json({ profiles: {} });
  }

  const profiles = await getCreatorProfiles(addresses);
  return NextResponse.json({ profiles });
}
