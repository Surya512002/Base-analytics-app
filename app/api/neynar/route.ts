import { NextResponse } from "next/server";
import { limitIp } from "@/lib/drops/http";
import { neynarProxyRequest } from "@/lib/api/neynar-proxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Server-side proxy for the one Neynar lookup the app uses: keeps the API key off the client. */
export async function GET(req: Request) {
  const limited = await limitIp(req, "neynar", 60, 60_000);
  if (limited) return limited;

  const key = process.env.NEYNAR_API_KEY;
  if (!key) {
    return NextResponse.json({ error: "NEYNAR_API_KEY not configured" }, { status: 503 });
  }

  const target = neynarProxyRequest(new URL(req.url).searchParams);
  if ("error" in target) return NextResponse.json({ error: target.error }, { status: 400 });

  try {
    const res = await fetch(target.url, {
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
