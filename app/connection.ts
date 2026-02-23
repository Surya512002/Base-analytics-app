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

export async function getWalletProvider(
  type: "farcaster" | "coinbase" | "metamask"
): Promise<BrowserProvider> {
  if (typeof window === "undefined") throw new Error("Window not found");

  const win = window as unknown as WindowWithEthereum;
  let selectedProvider: Eip1193Provider | undefined;

  // 1. COINBASE WALLET
  if (type === "coinbase") {
    const cbProvider = win.coinbaseWalletExtension || win.ethereum;
    selectedProvider = cbProvider as Eip1193Provider;
    
    if (!selectedProvider) {
      throw new Error("Coinbase Wallet not found. Please install or open Coinbase Wallet.");
    }
  }

  // 2. METAMASK
  else if (type === "metamask") {
    if (!win.ethereum) {
      throw new Error("MetaMask not found. Please install the extension.");
    }
    selectedProvider = win.ethereum as Eip1193Provider;
  }

  // 3. FARCASTER MINI APP WALLET
  else if (type === "farcaster") {
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

  return new BrowserProvider(selectedProvider);
}

export async function connectWallet(
  type: "farcaster" | "coinbase" | "metamask"
): Promise<{ signer: JsonRpcSigner; address: string }> {
  const provider = await getWalletProvider(type);

  if (type === "metamask") {
    try {
      await provider.send("wallet_requestPermissions", [{ eth_accounts: {} }]);
    } catch (e) {
      console.log("MetaMask permission request skipped or rejected", e);
    }
  }

  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { signer, address };
} 