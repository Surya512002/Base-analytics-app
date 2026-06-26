import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_PREFIX = "v2/farcaster/";

/** Server-side proxy for Neynar — keeps API key off the client. */
export async function GET(req: Request) {
  const key = process.env.NEYNAR_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "NEYNAR_API_KEY not configured" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");
  if (!path || !path.startsWith(ALLOWED_PREFIX)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const url = new URL(`https://api.neynar.com/${path}`);
  searchParams.forEach((value, name) => {
    if (name !== "path") url.searchParams.set(name, value);
  });

  try {
    const res = await fetch(url.toString(), {
      headers: { accept: "application/json", "x-api-key": key },
      next: { revalidate: 60 },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[Neynar proxy]", err);
    return NextResponse.json({ error: "Upstream request failed" }, { status: 502 });
  }
}
