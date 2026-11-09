import { createConfig, http, fallback } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { BASE_PUBLIC_RPC, BASE_RPC } from "@/lib/constants/env";
import { isLimitOrdersFeatureEnabled } from "@/src/lib/limitOrders/featureFlag";

const primaryRpc = BASE_RPC || BASE_PUBLIC_RPC;
const baseTransport =
  primaryRpc === BASE_PUBLIC_RPC
    ? http(BASE_PUBLIC_RPC, { retryCount: 2, timeout: 20_000 })
    : fallback(
        [
          http(primaryRpc, { retryCount: 2, timeout: 20_000 }),
          http(BASE_PUBLIC_RPC, { retryCount: 2, timeout: 20_000 }),
        ],
        { rank: false, retryCount: 1 }
      );

// Support Base Sepolia when limit orders flag is enabled or in non-production environments
export const isOrdersFlagOn = isLimitOrdersFeatureEnabled();

const sepoliaRpc =
  process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ||
  process.env.BASE_SEPOLIA_RPC_URL ||
  "https://sepolia.base.org";

const sepoliaTransport = http(sepoliaRpc, { retryCount: 2, timeout: 20_000 });

export const wagmiConfig = isOrdersFlagOn
  ? createConfig({
      chains: [base, baseSepolia],
      transports: {
        [base.id]: baseTransport,
        [baseSepolia.id]: sepoliaTransport,
      },
      ssr: true,
    })
  : createConfig({
      chains: [base],
      transports: {
        [base.id]: baseTransport,
      },
      ssr: true,
    });
