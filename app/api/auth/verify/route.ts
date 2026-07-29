import { NextResponse } from "next/server";
import { getAddress } from "viem";
import { verifyFarcasterSignIn } from "@/lib/auth/farcaster-siwe-server";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
  verifySiweCredentials,
} from "@/lib/auth/siwe-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      message?: string;
      signature?: string;
      address?: string;
      authMethod?: "siwe" | "farcaster";
    };
    const message = body.message?.trim();
    const signature = body.signature?.trim();
    const authMethod = body.authMethod ?? "siwe";
    let expectedAddress: string | null = null;

    try {
      if (body.address?.startsWith("0x") && body.address.length === 42) {
        expectedAddress = getAddress(body.address).toLowerCase();
      }
    } catch {
      expectedAddress = null;
    }

    if (!message || !signature) {
      return NextResponse.json({ error: "Missing message or signature" }, { status: 400 });
    }

    const verified =
      authMethod === "farcaster"
        ? await verifyFarcasterSignIn(message, signature, expectedAddress ?? undefined)
        : await verifySiweCredentials(message, signature);

    if ("error" in verified) {
      return NextResponse.json({ error: verified.error }, { status: 401 });
    }

    if (expectedAddress && verified.address !== expectedAddress) {
      return NextResponse.json(
        { error: "Signed address does not match connected wallet" },
        { status: 401 }
      );
    }

    const token = createSessionToken(verified.address);
    const res = NextResponse.json({ ok: true, address: verified.address });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (e) {
    console.warn("[auth/verify]", e);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
