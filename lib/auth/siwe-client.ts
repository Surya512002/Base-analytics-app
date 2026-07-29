"use client";

import { getEip1193Provider } from "@/app/connection";
import type { ConnectionType } from "@/lib/types/wallet";
import { isInsideBaseMiniApp } from "@/lib/utils/mini-app-connect";
import { createWalletClient, custom, getAddress, toHex } from "viem";
import { base } from "viem/chains";

const SESSION_KEY = "ba_siwe_authed_address";

export function readLocalSiweAddress(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SESSION_KEY);
}

export function writeLocalSiweAddress(address: string | null) {
  if (typeof window === "undefined") return;
  if (address) localStorage.setItem(SESSION_KEY, address.toLowerCase());
  else localStorage.removeItem(SESSION_KEY);
}

export async function fetchSiweSession(): Promise<{ address: string | null; authenticated: boolean }> {
  try {
    const r = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" });
    if (!r.ok) return { address: null, authenticated: false };
    const data = (await r.json()) as { address?: string | null; authenticated?: boolean };
    const addr = data.address?.toLowerCase() ?? null;
    if (data.authenticated && addr) writeLocalSiweAddress(addr);
    return { address: addr, authenticated: Boolean(data.authenticated && addr) };
  } catch {
    return { address: null, authenticated: false };
  }
}

async function signMessageWithWallet(
  address: string,
  connType: ConnectionType,
  message: string
): Promise<string> {
  const provider = await getEip1193Provider(connType);
  const checksum = getAddress(address);

  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const matched =
    accounts.find((a) => a.toLowerCase() === address.toLowerCase()) ?? accounts[0];
  if (!matched) throw new Error("No wallet account connected");

  // Prefer viem (handles EIP-191 correctly for most wallets)
  try {
    const walletClient = createWalletClient({
      chain: base,
      transport: custom(provider),
    });
    return await walletClient.signMessage({
      account: matched as `0x${string}`,
      message,
    });
  } catch (viemErr) {
    // MetaMask / some injected wallets: personal_sign with [hexMessage, address]
    try {
      const hexMsg = toHex(message);
      const sig = (await provider.request({
        method: "personal_sign",
        params: [hexMsg, checksum],
      })) as string;
      return sig;
    } catch {
      // Legacy param order / UTF-8 string message
      try {
        const sig = (await provider.request({
          method: "personal_sign",
          params: [message, checksum],
        })) as string;
        return sig;
      } catch {
        throw viemErr instanceof Error ? viemErr : new Error("Wallet could not sign message");
      }
    }
  }
}

async function postVerify(body: Record<string, unknown>): Promise<{
  ok: boolean;
  error?: string;
  address?: string;
}> {
  const verifyRes = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  if (!verifyRes.ok) {
    const err = (await verifyRes.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: err.error ?? "Sign-in rejected" };
  }

  const data = (await verifyRes.json()) as { address?: string };
  const sessionAddr = (data.address as string | undefined)?.toLowerCase();
  if (sessionAddr) writeLocalSiweAddress(sessionAddr);
  return { ok: true, address: sessionAddr };
}

function isUserRejected(e: unknown): boolean {
  const name = e instanceof Error ? e.name : "";
  const msg = e instanceof Error ? e.message : String(e);
  return (
    name === "SignIn.RejectedByUser" ||
    /reject|denied|cancel|user denied/i.test(msg)
  );
}

/** Preferred path inside Base App / Warpcast: Quick Auth JWT. */
async function signInWithQuickAuth(
  address: string
): Promise<{ ok: boolean; error?: string; address?: string }> {
  const { sdk } = await import("@farcaster/miniapp-sdk");
  if (sdk?.actions?.ready) {
    try {
      await sdk.actions.ready();
    } catch {
      // ignore
    }
  }

  if (!sdk.quickAuth?.getToken) {
    return { ok: false, error: "Quick Auth unavailable" };
  }

  try {
    const { token } = await sdk.quickAuth.getToken();
    if (!token) return { ok: false, error: "Quick Auth returned empty token" };
    return postVerify({
      token,
      address,
      authMethod: "quickAuth",
    });
  } catch (e) {
    if (isUserRejected(e)) return { ok: false, error: "Sign-in cancelled" };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Quick Auth sign-in failed",
    };
  }
}

/** Fallback: native SIWF via sdk.actions.signIn */
async function signInWithFarcasterSignIn(
  address: string,
  nonce: string
): Promise<{ ok: boolean; error?: string; address?: string }> {
  const { sdk } = await import("@farcaster/miniapp-sdk");
  if (sdk?.actions?.ready) {
    try {
      await sdk.actions.ready();
    } catch {
      // ignore
    }
  }

  try {
    const result = await sdk.actions.signIn({
      nonce,
      acceptAuthAddress: true,
    });

    return postVerify({
      message: result.message,
      signature: result.signature,
      address,
      authMethod: "farcaster",
    });
  } catch (e) {
    if (isUserRejected(e)) return { ok: false, error: "Sign-in cancelled" };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Sign-in failed",
    };
  }
}

async function signInInsideMiniApp(
  address: string,
  nonce: string
): Promise<{ ok: boolean; error?: string; address?: string }> {
  const quick = await signInWithQuickAuth(address);
  if (quick.ok) return quick;
  if (quick.error === "Sign-in cancelled") return quick;

  const siwf = await signInWithFarcasterSignIn(address, nonce);
  if (siwf.ok) return siwf;
  if (siwf.error === "Sign-in cancelled") return siwf;

  // Surface the more actionable error
  return {
    ok: false,
    error: siwf.error || quick.error || "Base App sign-in failed — try again",
  };
}

export async function signInWithSiwe(
  address: string,
  connType: ConnectionType
): Promise<{ ok: boolean; error?: string; address?: string }> {
  try {
    const nonceRes = await fetch(
      `/api/auth/nonce?address=${encodeURIComponent(address)}`,
      { cache: "no-store", credentials: "include" }
    );
    if (!nonceRes.ok) return { ok: false, error: "Could not start sign-in" };
    const { nonce, message } = (await nonceRes.json()) as {
      nonce?: string;
      message?: string;
    };
    if (!nonce || !message) return { ok: false, error: "Invalid sign-in challenge" };

    // Always use mini-app auth inside Base App / Warpcast — ignore stale connType
    // (e.g. metamask persisted from a previous browser session).
    const inMiniApp = await isInsideBaseMiniApp();
    if (inMiniApp || connType === "farcaster") {
      return signInInsideMiniApp(address, nonce);
    }

    const signature = await signMessageWithWallet(address, connType, message);

    return postVerify({
      message,
      signature,
      address,
      authMethod: "siwe",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sign-in failed";
    if (/reject|denied|cancel|user denied/i.test(msg)) {
      return { ok: false, error: "Sign-in cancelled" };
    }
    return { ok: false, error: msg };
  }
}

export async function signOutSiwe(): Promise<void> {
  writeLocalSiweAddress(null);
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
}
