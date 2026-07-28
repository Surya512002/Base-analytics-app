import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { parseSessionToken, SESSION_COOKIE } from "@/lib/auth/siwe-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const address = parseSessionToken(token);
  return NextResponse.json({
    authenticated: Boolean(address),
    address,
  });
}
