"use client";

import React from "react";
import { NeynarContextProvider, Theme } from "@neynar/react";
// ✅ Import OnchainKit requirements
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'viem/chains';

export function Providers({ children }: { children: React.ReactNode }) {
  // ✅ Safe fallback to undefined to prevent Vercel build crashes
  const paymasterUrl = process.env.NEXT_PUBLIC_PAYMASTER_URL || undefined;

  return (
    <NeynarContextProvider
      settings={{
        clientId: process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID || "83749266-9041-4541-a675-9c94625574e4",
        defaultTheme: Theme.Light,
        eventsCallbacks: {
          onAuthSuccess: () => {},
          onSignout: () => {},
        },
      }}
    >
      {/* ✅ Add the OnchainKit Provider here to enable gasless transactions */}
      <OnchainKitProvider 
        chain={base} 
        config={{ 
          paymaster: paymasterUrl, 
        }}
      >
        {children}
      </OnchainKitProvider>
    </NeynarContextProvider>
  );
} 