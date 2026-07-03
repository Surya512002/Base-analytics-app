import { createBaseAccountSDK } from "@base-org/account";
import { base } from "viem/chains";
import { PAYMASTER_URL } from "@/lib/constants/env";
import { ensureBaseNetwork } from "@/lib/utils/wallet-connection";

type BaseAccountSdk = ReturnType<typeof createBaseAccountSDK>;

let sdk: BaseAccountSdk | null = null;

function getBaseAccountSdk(): BaseAccountSdk {
  if (sdk) return sdk;
  sdk = createBaseAccountSDK({
    appName: "Base Analytics",
    appLogoUrl:
      typeof window !== "undefined"
        ? `${window.location.origin}/icon.png`
        : "https://base-analytics-app.vercel.app/icon.png",
    appChainIds: [base.id],
    preference: {
      telemetry: false,
      attribution: { auto: true },
    },
    ...(PAYMASTER_URL
      ? { paymasterUrls: { [base.id]: PAYMASTER_URL } }
      : {}),
  });
  return sdk;
}

/** EIP-1193 provider for Coinbase Base smart wallet (web / passkey). */
export function getBaseAccountProvider() {
  return getBaseAccountSdk().getProvider();
}

export async function connectBaseAccount(): Promise<{ address: string }> {
  const provider = getBaseAccountProvider();
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const address = accounts?.find((a) => a?.startsWith("0x"));
  if (!address) {
    throw new Error("No wallet account connected");
  }
  await ensureBaseNetwork(provider);
  return { address };
}
