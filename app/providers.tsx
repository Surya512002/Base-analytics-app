'use client';

import { ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnchainKitProvider } from '@coinbase/onchainkit';

const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(`https://base-mainnet.g.alchemy.com/v2/${process.env.NEXT_PUBLIC_ALCHEMY_KEY || 'mn8s-DCTchMi4q2DEKasm'}`),
  },
  ssr: true,
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_CDP_API_KEY || ''}
          chain={base}
          config={{
            appearance: {
              theme: 'dark',
            },
            paymaster: process.env.NEXT_PUBLIC_PAYMASTER_URL || undefined,
          }}
        >
          {children}
        </OnchainKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
