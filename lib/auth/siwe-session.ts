import { cookies } from "next/headers";
import { parseSessionToken, SESSION_COOKIE } from "@/lib/auth/siwe-server";

/** Returns verified session address from httpOnly cookie, or null. */
export async function getSiweSessionAddress(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return parseSessionToken(token);
}

export async function requireSiweSession(expectedAddress?: string): Promise<
  | { ok: true; address: string }
  | { ok: false; status: number; error: string }
> {
  const address = await getSiweSessionAddress();
  if (!address) {
    return { ok: false, status: 401, error: "Sign in with your wallet to continue" };
  }
  if (expectedAddress && address !== expectedAddress.toLowerCase()) {
    return { ok: false, status: 403, error: "Session does not match this wallet" };
  }
  return { ok: true, address };
}
