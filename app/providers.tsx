'use client';

import ScrollPerf from '@/components/ui/ScrollPerf';
import { ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { MotionConfig } from 'motion/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/wagmi/config';
import { WalletAppProvider } from '@/hooks/useWalletApp';
import { I18nProvider } from '@/lib/i18n/context';

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <WalletAppProvider>
            <I18nProvider>
              <ScrollPerf />
              {children}
            </I18nProvider>
          </WalletAppProvider>
        </MotionConfig>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
