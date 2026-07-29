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

  const host = requestHost(req);
  const domain = resolveSiweDomain(host);
  const uri = requestOrigin(req, domain);
  const nonce = issueSiweNonce();
  const message = address ? buildSiweMessage(address, nonce, domain, uri) : null;

  return NextResponse.json({ nonce, message, address, domain });
}
