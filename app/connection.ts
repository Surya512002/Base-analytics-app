import { BrowserProvider, Eip1193Provider, JsonRpcSigner } from "ethers";
import { sdk } from "@farcaster/miniapp-sdk";
import {
  pickCoinbaseExtensionProvider,
  pickMetaMaskProvider,
  pickOtherInjectedProvider,
} from "@/lib/utils/wallet-providers";

export async function getEip1193Provider(
  type: "farcaster" | "baseAccount" | "coinbase" | "metamask" | "injected"
): Promise<Eip1193Provider> {
  if (typeof window === "undefined") throw new Error("Window not found");

  let selectedProvider: Eip1193Provider | undefined;

  if (type === "baseAccount") {
    const { getBaseAccountProvider } = await import("@/lib/base-account");
    return getBaseAccountProvider() as unknown as Eip1193Provider;
  }

  if (type === "coinbase") {
    selectedProvider = pickCoinbaseExtensionProvider();
  } else if (type === "metamask") {
    selectedProvider = pickMetaMaskProvider();
  } else if (type === "injected") {
    selectedProvider = pickOtherInjectedProvider();
  } else if (type === "farcaster") {
    if (sdk?.actions?.ready) {
      await sdk.actions.ready();
    }

    if (!sdk?.wallet?.getEthereumProvider) {
      throw new Error(
        "Mini-app wallet unavailable — open this app inside Base App or Warpcast."
      );
    }

    const fcProvider = await sdk.wallet.getEthereumProvider();
    if (!fcProvider) {
      throw new Error(
        "Mini-app wallet unavailable — open this app inside Base App or Warpcast."
      );
    }

    selectedProvider = fcProvider as unknown as Eip1193Provider;
  }

  if (!selectedProvider) {
    throw new Error("No wallet provider found");
  }

  return selectedProvider;
}

export async function getWalletProvider(
  type: "farcaster" | "baseAccount" | "coinbase" | "metamask" | "injected"
): Promise<BrowserProvider> {
  const selectedProvider = await getEip1193Provider(type);
  return new BrowserProvider(selectedProvider);
}

export async function connectWallet(
  type: "farcaster" | "baseAccount" | "coinbase" | "metamask" | "injected"
): Promise<{ signer: JsonRpcSigner; address: string }> {
  const provider = await getWalletProvider(type);
  const eip1193 = await getEip1193Provider(type);

  const accounts = (await eip1193.request({
    method: "eth_requestAccounts",
  })) as string[];

  const address = accounts?.find((a) => a?.startsWith("0x"));
  if (!address) {
    throw new Error("No wallet account connected");
  }

  const signer = await provider.getSigner(address);
  return { signer, address };
}
