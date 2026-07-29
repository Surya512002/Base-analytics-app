"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchSiweSession,
  readLocalSiweAddress,
  signInWithSiwe,
  signOutSiwe,
  writeLocalSiweAddress,
} from "@/lib/auth/siwe-client";
import type { ConnectionType } from "@/lib/types/wallet";

export function useSiweAuth(walletAddress: string | undefined, connType: ConnectionType | null) {
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionAddress, setSessionAddress] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    const wallet = walletAddress?.toLowerCase();
    const session = await fetchSiweSession();

    if (session.authenticated && session.address && wallet && session.address === wallet) {
      setSessionAddress(session.address);
      setAuthenticated(true);
      setChecked(true);
      return true;
    }

    // Cookie missing/blocked (iframe) but local marker matches — keep UX unlocked;
    // server routes still enforce the httpOnly cookie when present.
    const local = readLocalSiweAddress();
    if (wallet && local === wallet) {
      setSessionAddress(local);
      setAuthenticated(true);
      setChecked(true);
      return true;
    }

    setSessionAddress(session.address);
    setAuthenticated(false);
    setChecked(true);
    return false;
  }, [walletAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!walletAddress) {
      // Wallet can be null briefly before silent resume — do not wipe the local
      // SIWE marker here. Explicit disconnect calls siweSignOut().
      setAuthenticated(false);
      setSessionAddress(null);
      return;
    }
    const wallet = walletAddress.toLowerCase();
    if (sessionAddress && sessionAddress !== wallet) {
      setAuthenticated(false);
      void signOutSiwe();
    }
  }, [walletAddress, sessionAddress]);

  const signIn = useCallback(async () => {
    if (!walletAddress) {
      return { ok: false as const, error: "Connect wallet first" };
    }
    setSigningIn(true);
    try {
      const result = await signInWithSiwe(walletAddress, connType);
      if (result.ok) {
        const addr = (result.address ?? walletAddress).toLowerCase();
        writeLocalSiweAddress(addr);
        setSessionAddress(addr);
        setAuthenticated(true);
        void fetchSiweSession();
      }
      return result;
    } finally {
      setSigningIn(false);
    }
  }, [walletAddress, connType]);

  const signOut = useCallback(async () => {
    await signOutSiwe();
    setAuthenticated(false);
    setSessionAddress(null);
  }, []);

  return {
    siweAuthenticated: authenticated,
    siweSessionChecked: checked,
    siweSigningIn: signingIn,
    siweSignIn: signIn,
    siweSignOut: signOut,
    refreshSiweSession: refresh,
  };
}
