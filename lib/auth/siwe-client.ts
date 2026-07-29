"use client";

import { getEip1193Provider } from "@/app/connection";
import type { ConnectionType } from "@/lib/types/wallet";
import { isInsideBaseMiniApp } from "@/lib/utils/mini-app-connect";
import { createWalletClient, custom } from "viem";
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
    else writeLocalSiweAddress(null);
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
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const account = (accounts.find((a) => a.toLowerCase() === address.toLowerCase()) ??
    accounts[0]) as `0x${string}`;

  const walletClient = createWalletClient({
    chain: base,
    transport: custom(provider),
  });

  return walletClient.signMessage({
    account,
    message,
  });
}

async function signInWithFarcasterMiniApp(
  address: string,
  nonce: string
): Promise<{ ok: boolean; error?: string }> {
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

    const verifyRes = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        message: result.message,
        signature: result.signature,
        address,
        authMethod: "farcaster",
      }),
    });

    if (!verifyRes.ok) {
      const err = (await verifyRes.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error ?? "Sign-in rejected" };
    }

    const data = (await verifyRes.json()) as { address?: string };
    if (data.address) writeLocalSiweAddress(data.address);
    return { ok: true };
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    const msg = e instanceof Error ? e.message : "Sign-in failed";
    if (name === "SignIn.RejectedByUser" || /reject|denied|cancel/i.test(msg)) {
      return { ok: false, error: "Sign-in cancelled" };
    }
    return { ok: false, error: msg };
  }
}

export async function signInWithSiwe(
  address: string,
  connType: ConnectionType
): Promise<{ ok: boolean; error?: string }> {
  try {
    const nonceRes = await fetch(
      `/api/auth/nonce?address=${encodeURIComponent(address)}`,
      { cache: "no-store", credentials: "include" }
    );
    if (!nonceRes.ok) return { ok: false, error: "Could not start sign-in" };
    const { nonce, message } = (await nonceRes.json()) as { nonce?: string; message?: string };
    if (!nonce || !message) return { ok: false, error: "Invalid sign-in challenge" };

    const inMiniApp = await isInsideBaseMiniApp();
    if (inMiniApp || connType === "farcaster") {
      return signInWithFarcasterMiniApp(address, nonce);
    }

    const signature = await signMessageWithWallet(address, connType, message);

    const verifyRes = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ message, signature, address, authMethod: "siwe" }),
    });

    if (!verifyRes.ok) {
      const err = (await verifyRes.json().catch(() => ({}))) as { error?: string };
      return { ok: false, error: err.error ?? "Sign-in rejected" };
    }

    const data = (await verifyRes.json()) as { address?: string };
    if (data.address) writeLocalSiweAddress(data.address);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sign-in failed";
    if (/reject|denied|cancel/i.test(msg)) return { ok: false, error: "Sign-in cancelled" };
    return { ok: false, error: msg };
  }
}

export async function signOutSiwe(): Promise<void> {
  writeLocalSiweAddress(null);
  await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
}
