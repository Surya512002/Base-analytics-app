'use client';

import ScrollPerf from '@/components/ui/ScrollPerf';
import { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'wagmi/chains';
import { wagmiConfig } from '@/lib/wagmi/config';
import { WalletAppProvider } from '@/hooks/useWalletApp';

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_CDP_API_KEY || ''}
          chain={base}
          analytics={Boolean(process.env.NEXT_PUBLIC_CDP_API_KEY)}
          config={{
            appearance: {
              theme: 'light',
            },
            paymaster: process.env.NEXT_PUBLIC_PAYMASTER_URL || undefined,
          }}
        >
          <WalletAppProvider>
            <ScrollPerf />
            {children}
          </WalletAppProvider>
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
