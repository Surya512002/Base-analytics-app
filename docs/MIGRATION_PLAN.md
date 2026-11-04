# Migration Plan: Decoupling @coinbase/onchainkit & Transitive SDKs

## Executive Summary
This document proposes the lowest-risk migration path to eliminate the deprecated `@coinbase/onchainkit` (1.1.2) dependency and its transitive packages (such as `@metamask/sdk`) from the repository, replacing them with standard, audited Wagmi v2 and Viem native implementations.

---

## Current Architecture & Usage Audit

1. **Usage Scope**:
   - Direct codebase search reveals `@coinbase/onchainkit` is **only imported once**: in `app/providers.tsx` wrapping the application in `<OnchainKitProvider>`.
   - Zero transaction forms, zero swap cards, and zero checkout components in the application rely on OnchainKit UI widgets. All transaction flows use native Viem and Wagmi calls (`sendAppTransactions`, `lib/lending/builder-attribution.ts`, `lib/wagmi/config.ts`).
2. **Transitive Bloat**:
   - Pinned `1.1.2` pulls in `@metamask/sdk` (0.33.1), `@farcaster/miniapp-wagmi-connector`, and legacy internal hooks.
   - npm marks `@coinbase/onchainkit` 1.1.3+ as deprecated.

---

## Recommended Lowest-Risk Migration Path

### Phase A: Native Provider Replacement (Zero Downtime)
- Update `app/providers.tsx` to remove `<OnchainKitProvider>`. The application already uses:
  - `<WagmiProvider config={wagmiConfig}>`
  - `<QueryClientProvider client={queryClient}>`
  - `<WalletAppProvider>`
- Pass CDP configuration (if needed for telemetry) via standard client headers or lightweight fetch wrappers without the bloated SDK.

### Phase B: Wagmi Connectors Standardisation
- Configure native Wagmi connectors in `lib/wagmi/config.ts`:
  ```typescript
  import { createConfig, http } from "wagmi";
  import { base } from "wagmi/chains";
  import { coinbaseWallet, injected } from "wagmi/connectors";

  export const wagmiConfig = createConfig({
    chains: [base],
    connectors: [
      coinbaseWallet({ appName: "Base Terminal", preference: "smartWalletOnly" }),
      injected(),
    ],
    transports: { [base.id]: http() },
    ssr: true,
  });
  ```

### Phase C: Package Uninstallation
- Run `npm uninstall @coinbase/onchainkit`.
- Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` to confirm clean removal.

### Risk & Verification
- **Risk Level**: Extremely Low. Since zero UI components or transaction hooks use OnchainKit, removing the provider only sheds bundle weight.
- **Verification**: Run `npm run build` and `e2e/core-flows.spec.ts` test 1 (wallet modal open & connect).
