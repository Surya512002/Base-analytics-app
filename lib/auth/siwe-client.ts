"use client";

import { getEip1193Provider } from "@/app/connection";
import type { ConnectionType } from "@/lib/types/wallet";
import { isInsideBaseMiniApp } from "@/lib/utils/mini-app-connect";
import {
  inferConnType,
  resolveActiveConnType,
} from "@/lib/utils/wallet-connection";
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

function clientDomain(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.location.hostname;
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

  const signAttempts: Array<() => Promise<string>> = [
    async () => {
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider),
      });
      return walletClient.signMessage({
        account: matched as `0x${string}`,
        message,
      });
    },
    async () =>
      (await provider.request({
        method: "personal_sign",
        params: [message, checksum],
      })) as string,
    async () =>
      (await provider.request({
        method: "personal_sign",
        params: [toHex(message), checksum],
      })) as string,
    async () =>
      (await provider.request({
        method: "personal_sign",
        params: [checksum, toHex(message)],
      })) as string,
    async () =>
      (await provider.request({
        method: "personal_sign",
        params: [checksum, message],
      })) as string,
  ];

  let lastErr: unknown;
  for (const attempt of signAttempts) {
    try {
      const sig = await attempt();
      if (sig?.startsWith("0x")) return sig;
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("Wallet could not sign message");
}

async function postVerify(body: Record<string, unknown>): Promise<{
  ok: boolean;
  error?: string;
  address?: string;
}> {
  const domain = clientDomain();
  const payload = domain ? { ...body, clientDomain: domain } : body;

  const verifyRes = await fetch("/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
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
): Promise<{ ok: boolean; error?: string; address?: string; gotToken?: boolean }> {
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
    const verified = await postVerify({
      token,
      address,
      authMethod: "quickAuth",
    });
    return { ...verified, gotToken: true };
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

async function tryWalletSiwePaths(
  address: string,
  message: string,
  connType: ConnectionType
): Promise<{ ok: boolean; error?: string; address?: string }> {
  const types: ConnectionType[] = [];
  const push = (t: ConnectionType | null | undefined) => {
    if (!t || types.includes(t)) return;
    types.push(t);
  };

  push(connType);
  push("farcaster");
  push("baseAccount");
  push("coinbase");
  push("metamask");
  push("injected");

  let lastError = "Wallet could not sign message";

  for (const type of types) {
    try {
      const signature = await signMessageWithWallet(address, type, message);
      const result = await postVerify({
        message,
        signature,
        address,
        authMethod: "siwe",
      });
      if (result.ok) return result;
      lastError = result.error ?? lastError;
    } catch (e) {
      if (isUserRejected(e)) return { ok: false, error: "Sign-in cancelled" };
      lastError = e instanceof Error ? e.message : lastError;
    }
  }

  return { ok: false, error: lastError };
}

async function signInInsideMiniApp(
  address: string,
  nonce: string,
  message: string,
  connType: ConnectionType
): Promise<{ ok: boolean; error?: string; address?: string }> {
  const quick = await signInWithQuickAuth(address);
  if (quick.ok) return quick;
  if (quick.error === "Sign-in cancelled") return quick;

  // Quick Auth got a token but our server rejected it — try wallet SIWE (passkey smart wallet).
  if (quick.gotToken) {
    const wallet = await tryWalletSiwePaths(address, message, connType);
    if (wallet.ok || wallet.error === "Sign-in cancelled") return wallet;
    return { ok: false, error: wallet.error || quick.error || "Sign-in rejected" };
  }

  const siwf = await signInWithFarcasterSignIn(address, nonce);
  if (siwf.ok) return siwf;
  if (siwf.error === "Sign-in cancelled") return siwf;

  const wallet = await tryWalletSiwePaths(address, message, connType);
  if (wallet.ok || wallet.error === "Sign-in cancelled") return wallet;

  return {
    ok: false,
    error: wallet.error || siwf.error || quick.error || "Base App sign-in failed — try again",
  };
}

export async function signInWithSiwe(
  address: string,
  connType: ConnectionType | null
): Promise<{ ok: boolean; error?: string; address?: string }> {
  try {
    const activeConn =
      (await resolveActiveConnType(connType, address)) ??
      (await inferConnType(address)) ??
      connType;

    if (!activeConn) {
      return { ok: false, error: "Connect wallet first" };
    }

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

    const inMiniApp = await isInsideBaseMiniApp();
    if (inMiniApp || activeConn === "farcaster") {
      return signInInsideMiniApp(address, nonce, message, activeConn);
    }

    return tryWalletSiwePaths(address, message, activeConn);
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
