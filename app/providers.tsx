"use client";

import React, { ReactNode } from "react";
import { NeynarContextProvider, Theme } from "@neynar/react";
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 1. Wagmi Config setup
const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(
      `https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY || 'mn8s-DCTchMi4q2DEKasm'}`
    ),
  },
  ssr: true,
});

// 2. Query Client setup
const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  // Safe fallback for Paymaster
  const paymasterUrl = process.env.NEXT_PUBLIC_PAYMASTER_URL || undefined;

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
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
          <OnchainKitProvider 
            chain={base} 
            config={{ 
              paymaster: paymasterUrl, 
            }}
          >
            {children}
          </OnchainKitProvider>
        </NeynarContextProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
} 