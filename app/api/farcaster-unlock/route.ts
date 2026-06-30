import { NextRequest, NextResponse } from "next/server";
import { decodePaymentSignatureHeader, encodePaymentRequiredHeader } from "@x402/core/http";
import type { Network, PaymentRequired } from "@x402/core/types";
import { settleX402Payment, verifyX402Payment } from "@/lib/x402-facilitator";
import { getX402Product } from "@/lib/constants/x402-products";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAY_TO = "0xB4BD7D410543cB27f42c562ab3fF5DC12fBDd42F";
const NETWORK: Network = "eip155:8453";
const USDC_ADDRESS = "0x833589fCD6EDB6E08f4c7C32D4f71b54bdA02913";
const PRODUCT_ID = "farcaster" as const;

function buildPaymentRequired(req: NextRequest): PaymentRequired {
  const product = getX402Product(PRODUCT_ID);
  const url = new URL(req.nextUrl.pathname, req.nextUrl.origin).toString();
  return {
    x402Version: 2,
    resource: {
      url,
      description: `Base Analytics ${product.label}`,
    },
    accepts: [
      {
        scheme: "exact",
        network: NETWORK,
        amount: product.amountUsdc,
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
  const body = (await req.json().catch(() => ({}))) as { address?: string };
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

    return NextResponse.json({
      unlocked: true,
      product: PRODUCT_ID,
      address: body.address?.toLowerCase(),
      message: "Farcaster analysis unlocked for this session",
      unlockedAt: new Date().toISOString(),
      transaction: settleData.transaction,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Payment error";
    console.error("[farcaster-unlock]", msg, e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
