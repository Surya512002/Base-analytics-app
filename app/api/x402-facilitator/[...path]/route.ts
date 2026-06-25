import { NextRequest, NextResponse } from "next/server";
import {
  getFacilitatorAddress,
  settleX402Payment,
  verifyX402Payment,
} from "@/lib/x402-facilitator";

async function handleSupported() {
  return NextResponse.json({
    kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:8453" }],
    extensions: [],
    signers: { "eip155:*": [getFacilitatorAddress()] },
  });
}

async function handleVerify(req: NextRequest) {
  const { paymentPayload, paymentRequirements } = await req.json();
  const requirements = paymentPayload?.accepted ?? paymentRequirements;
  const result = await verifyX402Payment(paymentPayload, requirements);
  return NextResponse.json(result);
}

async function handleSettle(req: NextRequest) {
  const { paymentPayload, paymentRequirements } = await req.json();
  const requirements = paymentPayload?.accepted ?? paymentRequirements;
  const result = await settleX402Payment(paymentPayload, requirements);
  return NextResponse.json(result);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const endpoint = path?.[0];
  if (endpoint === "supported" || !endpoint) return handleSupported();
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const endpoint = path?.[0];
  if (endpoint === "verify") return handleVerify(req);
  if (endpoint === "settle") return handleSettle(req);
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
