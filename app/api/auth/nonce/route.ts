import { NextResponse } from "next/server";
import { buildSiweMessage, issueSiweNonce } from "@/lib/auth/siwe-server";
import { getAddress } from "viem";

export const dynamic = "force-dynamic";

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

  const nonce = await issueSiweNonce();
  const message = address ? buildSiweMessage(address, nonce) : null;

  return NextResponse.json({ nonce, message, address });
}
