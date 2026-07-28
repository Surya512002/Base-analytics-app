"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchSiweSession,
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
    const session = await fetchSiweSession();
    setSessionAddress(session.address);
    const match =
      Boolean(session.authenticated) &&
      Boolean(walletAddress) &&
      session.address === walletAddress!.toLowerCase();
    setAuthenticated(match);
    setChecked(true);
    return match;
  }, [walletAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!walletAddress) {
      setAuthenticated(false);
      setSessionAddress(null);
      writeLocalSiweAddress(null);
    } else if (sessionAddress && sessionAddress !== walletAddress.toLowerCase()) {
      setAuthenticated(false);
      void signOutSiwe();
    }
  }, [walletAddress, sessionAddress]);

  const signIn = useCallback(async () => {
    if (!walletAddress || !connType) {
      return { ok: false as const, error: "Connect wallet first" };
    }
    setSigningIn(true);
    try {
      const result = await signInWithSiwe(walletAddress, connType);
      if (result.ok) {
        await refresh();
      }
      return result;
    } finally {
      setSigningIn(false);
    }
  }, [walletAddress, connType, refresh]);

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
