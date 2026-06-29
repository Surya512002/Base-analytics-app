import { createConfig, http } from "wagmi";
import { base } from "wagmi/chains";
import { ALCHEMY_KEY, BASE_RPC } from "@/lib/constants/env";

export const wagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(
      BASE_RPC ||
        (ALCHEMY_KEY
          ? `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
          : "https://mainnet.base.org")
    ),
  },
  ssr: true,
});
