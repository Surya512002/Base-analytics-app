import { NextResponse } from "next/server";
import { addAnnouncement, listAnnouncements } from "@/lib/launchpad/announcements-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = (searchParams.get("token") || "").trim().toLowerCase();
  if (!token.startsWith("0x") || token.length !== 42) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  const announcements = await listAnnouncements(token);
  return NextResponse.json({ announcements });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      token?: string;
      creator?: string;
      body?: string;
    };
    const result = await addAnnouncement(
      body.token || "",
      body.creator || "",
      body.body || ""
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }
    return NextResponse.json({ ok: true, announcements: result.announcements });
  } catch (e) {
    console.error("[launchpad/announcements POST]", e);
    return NextResponse.json({ error: "Failed to post" }, { status: 500 });
  }
}
