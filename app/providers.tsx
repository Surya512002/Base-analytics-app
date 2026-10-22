'use client';

import ScrollPerf from '@/components/ui/ScrollPerf';
import { ReactNode, useEffect, useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'wagmi/chains';
import { wagmiConfig } from '@/lib/wagmi/config';
import { WalletAppProvider } from '@/hooks/useWalletApp';

const queryClient = new QueryClient();

export function Providers({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const checkTheme = () => {
      if (typeof document === 'undefined') return;
      const hasDark = document.documentElement.classList.contains('dark');
      const dataTheme = document.documentElement.getAttribute('data-theme');
      setIsDark(hasDark || dataTheme === 'dark');
    };

    checkTheme();

    const observer = new MutationObserver(() => {
      checkTheme();
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <OnchainKitProvider
          apiKey={process.env.NEXT_PUBLIC_CDP_API_KEY || ''}
          chain={base}
          analytics={Boolean(process.env.NEXT_PUBLIC_CDP_API_KEY)}
          config={{
            appearance: {
              name: 'Base Analytics',
              mode: isDark ? 'dark' : 'light',
              theme: 'base',
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
