import { NextResponse } from "next/server";
import {
  getCreatorProfile,
  upsertCreatorProfile,
} from "@/lib/launchpad/creator-profile-store";
import { requireSiweSession } from "@/lib/auth/siwe-session";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ address: string }> }
) {
  const { address } = await ctx.params;
  const addr = address?.trim().toLowerCase();
  if (!addr?.startsWith("0x") || addr.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const profile = await getCreatorProfile(addr);
  return NextResponse.json({
    profile: profile ?? { address: addr, createdAt: 0, updatedAt: 0 },
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ address: string }> }
) {
  const { address } = await ctx.params;
  const addr = address?.trim().toLowerCase();
  if (!addr?.startsWith("0x") || addr.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  const session = await requireSiweSession(addr);
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: session.status });
  }

  try {
    const body = (await req.json()) as {
      displayName?: string;
      bio?: string;
      avatarUrl?: string;
      website?: string;
      twitter?: string;
      telegram?: string;
    };
    const profile = await upsertCreatorProfile(addr, {
      displayName: body.displayName,
      bio: body.bio,
      avatarUrl: body.avatarUrl,
      website: body.website,
      twitter: body.twitter,
      telegram: body.telegram,
    });
    return NextResponse.json({ profile });
  } catch (e) {
    console.warn("[creator/profile] update failed", e);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}
