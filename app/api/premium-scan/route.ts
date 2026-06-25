import { NextRequest, NextResponse } from "next/server";
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader } from "@x402/core/http";
import type { Network, PaymentRequired } from "@x402/core/types";
import { settleX402Payment, verifyX402Payment } from "@/lib/x402-facilitator";

const PAY_TO = "0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F";
const NETWORK: Network = "eip155:8453";
const AMOUNT_USDC = "5000"; // 0.005 USDC (6 decimals)
const USDC_ADDRESS = "0x833589fCD6EDB6E08f4c7C32D4f71b54bdA02913";

function buildPaymentRequired(req: NextRequest): PaymentRequired {
  const url = new URL(req.nextUrl.pathname, req.nextUrl.origin).toString();
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

  if (!paymentHeader) {
    const paymentRequired = buildPaymentRequired(req);
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

  try {
    const paymentPayload = decodePaymentSignatureHeader(paymentHeader);
    const paymentRequirements =
      paymentPayload.accepted ?? buildPaymentRequired(req).accepts[0];

    const verifyData = await verifyX402Payment(paymentPayload, paymentRequirements);

    if (!verifyData.isValid) {
      return NextResponse.json(
        {
          error: verifyData.invalidReason || "Payment invalid",
          detail: verifyData.invalidMessage,
        },
        { status: 402 }
      );
    }

    const settleData = await settleX402Payment(paymentPayload, paymentRequirements);

    if (!settleData.success) {
      return NextResponse.json(
        {
          error: settleData.errorReason || "Settlement failed",
          detail: settleData.errorMessage,
        },
        { status: 402 }
      );
    }

    const body = await req.json().catch(() => ({}));
    return NextResponse.json({
      premium: true,
      address: (body as { address?: string }).address,
      message: "Premium analytics unlocked",
      unlockedAt: new Date().toISOString(),
      transaction: settleData.transaction,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Payment error";
    console.error("[premium-scan]", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
