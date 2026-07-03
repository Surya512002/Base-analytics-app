import { createConfig, http, fallback } from "wagmi";
import { base } from "wagmi/chains";
import { BASE_PUBLIC_RPC, BASE_RPC } from "@/lib/constants/env";

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

export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: baseTransport,
  },
  ssr: true,
});
