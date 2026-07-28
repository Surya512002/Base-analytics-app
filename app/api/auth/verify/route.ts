import { NextResponse } from "next/server";
import {
  createSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
  verifySiweCredentials,
} from "@/lib/auth/siwe-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { message?: string; signature?: string };
    const message = body.message?.trim();
    const signature = body.signature?.trim();
    if (!message || !signature) {
      return NextResponse.json({ error: "Missing message or signature" }, { status: 400 });
    }

    const verified = await verifySiweCredentials(message, signature);
    if ("error" in verified) {
      return NextResponse.json({ error: verified.error }, { status: 401 });
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
