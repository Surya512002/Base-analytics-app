import { SiweMessage } from "siwe";
import { createClient } from "@farcaster/quick-auth";
import { getAddress } from "viem";
import { getAppUrl } from "@/lib/constants/app-url";

function appHostname(): string {
  try {
    return new URL(getAppUrl()).hostname;
  } catch {
    return "localhost";
  }
}

function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const cleaned = host.split(",")[0]?.trim().toLowerCase();
  if (!cleaned) return null;
  return cleaned.replace(/:80$/, "").replace(/:443$/, "");
}

/** Domains Quick Auth / SIWF may use for this deployment. */
export function farcasterAuthDomains(requestHost?: string | null): string[] {
  const domains: string[] = [];
  const push = (d: string | null | undefined) => {
    if (!d) return;
    const v = d.toLowerCase();
    if (!domains.includes(v)) domains.push(v);
    const bare = v.replace(/^www\./, "");
    if (!domains.includes(bare)) domains.push(bare);
  };
  push(normalizeHost(requestHost));
  push(appHostname());
  return domains;
}

function domainFromSiwfMessage(message: string): string | null {
  try {
    const siwe = new SiweMessage(message);
    return siwe.domain?.toLowerCase() ?? null;
  } catch {
    const first = message.split("\n")[0] ?? "";
    const m = first.match(/^([^\s]+)\s+wants you to sign in/i);
    return m?.[1]?.toLowerCase() ?? null;
  }
}

function addressFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const raw =
    "address" in payload ? String((payload as { address?: string }).address ?? "") : "";
  if (!raw.startsWith("0x") || raw.length !== 42) return null;
  try {
    return getAddress(raw).toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Verify a Quick Auth JWT from sdk.quickAuth.getToken().
 * Session binds to the connected wallet when provided (custody/auth ≠ smart wallet).
 */
export async function verifyFarcasterQuickAuthToken(
  token: string,
  requestHost?: string | null,
  expectedAddress?: string
): Promise<{ address: string; fid?: number } | { error: string }> {
  const client = createClient();
  const domains = farcasterAuthDomains(requestHost);
  let lastError = "Invalid Farcaster session token";

  for (const domain of domains) {
    try {
      const payload = await client.verifyJwt({ token, domain });
      const jwtAddress = addressFromPayload(payload);
      const sessionAddress = expectedAddress?.toLowerCase() ?? jwtAddress;
      if (!sessionAddress?.startsWith("0x")) {
        return { error: "Farcaster sign-in did not include a wallet address" };
      }
      const fid =
        typeof payload === "object" && payload && "sub" in payload
          ? Number((payload as { sub?: string | number }).sub)
          : undefined;
      return {
        address: sessionAddress,
        fid: Number.isFinite(fid) ? fid : undefined,
      };
    } catch (e) {
      lastError = e instanceof Error ? e.message : lastError;
    }
  }

  return { error: lastError };
}

/**
 * Verify a SIWF credential from sdk.actions.signIn().
 */
export async function verifyFarcasterSignIn(
  message: string,
  signature: string,
  expectedAddress?: string,
  requestHost?: string | null
): Promise<{ address: string } | { error: string }> {
  const client = createClient();
  const msgDomain = domainFromSiwfMessage(message);
  const domains = [
    ...(msgDomain ? [msgDomain] : []),
    ...farcasterAuthDomains(requestHost),
  ].filter((d, i, arr) => arr.indexOf(d) === i);

  let lastError = "Farcaster sign-in failed";

  for (const domain of domains) {
    try {
      const { token } = await client.verifySiwf({
        message,
        signature,
        domain,
        // Auth-address SIWF (Base App) — supported by Quick Auth; types lag behind.
        ...({ acceptAuthAddress: true } as Record<string, unknown>),
      } as Parameters<typeof client.verifySiwf>[0]);

      const payload = await client.verifyJwt({ token, domain });
      const jwtAddress = addressFromPayload(payload);
      // Prefer connected wallet — SIWF may be custody/auth address.
      const sessionAddress =
        expectedAddress?.toLowerCase() ?? jwtAddress ?? undefined;

      if (!sessionAddress?.startsWith("0x")) {
        return { error: "Farcaster sign-in did not include a wallet address" };
      }

      return { address: sessionAddress };
    } catch (e) {
      lastError = e instanceof Error ? e.message : lastError;
    }
  }

  return { error: lastError };
}
