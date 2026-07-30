import { NextResponse } from "next/server";
import { buildSiweMessage, issueSiweNonce, resolveSiweDomain } from "@/lib/auth/siwe-server";
import { getAddress } from "viem";

export const dynamic = "force-dynamic";

function requestHost(req: Request): string | null {
  return (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    null
  );
}

function requestOrigin(req: Request, host: string): string {
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("address")?.trim();
  let address: string | null = null;
  try {
    if (raw?.startsWith("0x") && raw.length === 42) {
      address = getAddress(raw).toLowerCase();
    }
  } catch {
    address = null;
  }

  try {
    const host = requestHost(req);
    const domain = resolveSiweDomain(host);
    const uri = requestOrigin(req, domain);
    const nonce = issueSiweNonce();
    const message = address ? buildSiweMessage(address, nonce, domain, uri) : null;

    return NextResponse.json({ nonce, message, address, domain });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "nonce failed";
    console.error("[auth/nonce]", msg);
    // Misconfigured production (e.g. missing SIWE_SESSION_SECRET) — surface as 503, not opaque 500
    if (msg.includes("SIWE_SESSION_SECRET")) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Could not issue nonce" }, { status: 500 });
  }
}
