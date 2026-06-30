import { BrowserProvider, Eip1193Provider, JsonRpcSigner } from "ethers";
import { sdk } from "@farcaster/miniapp-sdk";

// ✅ 1. Omit conflicting properties to satisfy the TS Compiler
// ✅ 2. Disable specific ESLint rule to allow 'any' for these lines only
interface WindowWithEthereum extends Omit<Window, 'ethereum' | 'coinbaseWalletExtension'> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  ethereum?: any;
  coinbaseWalletExtension?: any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export async function getEip1193Provider(
  type: "farcaster" | "coinbase" | "metamask" | "injected"
): Promise<Eip1193Provider> {
  if (typeof window === "undefined") throw new Error("Window not found");

  const win = window as unknown as WindowWithEthereum;
  let selectedProvider: Eip1193Provider | undefined;

  if (type === "coinbase") {
    const cbProvider = win.coinbaseWalletExtension || win.ethereum;
    selectedProvider = cbProvider as Eip1193Provider;

    if (!selectedProvider) {
      throw new Error("Coinbase Wallet not found. Please install or open Coinbase Wallet.");
    }
  } else if (type === "metamask") {
    if (!win.ethereum) {
      throw new Error("MetaMask not found. Please install the extension.");
    }
    const eth = win.ethereum as Eip1193Provider & {
      providers?: Array<Eip1193Provider & { isMetaMask?: boolean; isCoinbaseWallet?: boolean }>;
      isMetaMask?: boolean;
    };
    if (eth.providers?.length) {
      const mm = eth.providers.find((p) => p.isMetaMask && !p.isCoinbaseWallet);
      selectedProvider = (mm ?? eth.providers[0]) as Eip1193Provider;
    } else {
      selectedProvider = eth as Eip1193Provider;
    }
  } else if (type === "injected") {
    if (!win.ethereum) {
      throw new Error(
        "No browser wallet found. Install Rabby, Rainbow, or another EVM wallet extension."
      );
    }
    selectedProvider = win.ethereum as Eip1193Provider;
  } else if (type === "farcaster") {
    if (sdk?.actions?.ready) {
      await sdk.actions.ready();
    }

    if (!sdk?.wallet?.getEthereumProvider) {
      throw new Error("Farcaster SDK wallet not available. Open this inside Warpcast.");
    }

    const fcProvider = await sdk.wallet.getEthereumProvider();
    if (!fcProvider) {
      throw new Error("Farcaster Wallet not found. Please open this Mini App inside Warpcast.");
    }

    selectedProvider = fcProvider as unknown as Eip1193Provider;
  }

  if (!selectedProvider) {
    throw new Error("No wallet provider found");
  }

  return selectedProvider;
}

export async function getWalletProvider(
  type: "farcaster" | "coinbase" | "metamask" | "injected"
): Promise<BrowserProvider> {
  const selectedProvider = await getEip1193Provider(type);
  return new BrowserProvider(selectedProvider);
}

export async function connectWallet(
  type: "farcaster" | "coinbase" | "metamask" | "injected"
): Promise<{ signer: JsonRpcSigner; address: string }> {
  const provider = await getWalletProvider(type);
  const eip1193 = await getEip1193Provider(type);

  // Single wallet prompt — avoid wallet_requestPermissions + getSigner double popup.
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