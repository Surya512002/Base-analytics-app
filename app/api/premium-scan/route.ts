import { NextRequest, NextResponse } from "next/server";
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader } from "@x402/core/http";

const PAY_TO = "0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F";
const NETWORK = "eip155:8453";
const AMOUNT_USDC = "1000"; // 0.001 USDC in micro-units (6 decimals)
// Native USDC on Base mainnet
const USDC_ADDRESS = "0x833589fCD6EDB6E08f4c7C32D4f71b54bdA02913";

// Build the 402 payment required response manually
function buildPaymentRequired(url: string) {
  return {
    x402Version: 2,
    resource: {
      url,
      description: "Base Analytics Premium Scan",
    },
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        amount: AMOUNT_USDC,
        asset: USDC_ADDRESS,
        payTo: PAY_TO,
        maxTimeoutSeconds: 300,
        extra: {
          name: "USD Coin",
          version: "2",
          assetTransferMethod: "eip3009",
        },
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  const paymentHeader =
    req.headers.get("payment-signature") ||
    req.headers.get("PAYMENT-SIGNATURE");

  // No payment header → return 402
  if (!paymentHeader) {
    const paymentRequired = buildPaymentRequired(req.url);
    return NextResponse.json(
      {},
      {
        status: 402,
        headers: {
          "PAYMENT-REQUIRED": encodePaymentRequiredHeader(paymentRequired),
          "Content-Type": "application/json",
        },
      }
    );
  }

  // Has payment header → forward to facilitator to verify + settle
  try {
    const paymentPayload = decodePaymentSignatureHeader(paymentHeader);
    const paymentRequirements = buildPaymentRequired(req.url).accepts[0];

    // Verify
    const verifyRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/x402-facilitator/verify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentPayload, paymentRequirements }),
      }
    );
    const verifyData = await verifyRes.json();

    if (!verifyData.isValid) {
      return NextResponse.json(
        { error: verifyData.invalidReason || "Payment invalid" },
        { status: 402 }
      );
    }

    // Settle
    const settleRes = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/x402-facilitator/settle`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentPayload, paymentRequirements }),
      }
    );
    const settleData = await settleRes.json();

    if (!settleData.success) {
      return NextResponse.json(
        { error: settleData.errorReason || "Settlement failed" },
        { status: 402 }
      );
    }

    // Payment confirmed — run handler
    const body = await req.json().catch(() => ({}));
    return NextResponse.json({
      premium: true,
      address: (body as { address?: string }).address,
      message: `🔓 Premium analytics unlocked`,
      unlockedAt: new Date().toISOString(),
      transaction: settleData.transaction,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Payment error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
} 