import { BrowserProvider, Eip1193Provider, JsonRpcSigner } from 'ethers';
import { sdk } from "@farcaster/miniapp-sdk";

interface WindowWithEthereum extends Window {
  ethereum?: Eip1193Provider;
  coinbaseWalletExtension?: Eip1193Provider;
}

// Helper to wait (sleep)
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function getWalletProvider(type: 'farcaster' | 'coinbase' | 'metamask'): Promise<BrowserProvider> {
  if (typeof window === 'undefined') throw new Error("Window not found");
  
  const win = window as unknown as WindowWithEthereum;
  let selectedProvider: Eip1193Provider | undefined;

  // 1. COINBASE
  if (type === 'coinbase') {
    selectedProvider = win.coinbaseWalletExtension || win.ethereum;
  }
  
  // 2. METAMASK
  else if (type === 'metamask') {
    if (!win.ethereum) throw new Error("MetaMask not found. Please install the extension.");
    selectedProvider = win.ethereum;
  }
  
  // 3. FARCASTER (Robust Logic)
  else if (type === 'farcaster') {
    // Attempt 1: Check SDK directly (bypassing TS types)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sdkProvider = (sdk as any).provider;
    
    if (sdkProvider) {
      selectedProvider = sdkProvider;
    } 
    // Attempt 2: Check window.ethereum (Standard Frame v2)
    else if (win.ethereum) {
      selectedProvider = win.ethereum;
    } 
    // Attempt 3: Poll for 3 seconds (Fixes Race Condition)
    else {
      console.log("Polling for Farcaster wallet...");
      for (let i = 0; i < 6; i++) { // Try 6 times (3 seconds total)
        await sleep(500);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((sdk as any).provider) { selectedProvider = (sdk as any).provider; break; }
        if (win.ethereum) { selectedProvider = win.ethereum; break; }
      }
    }

    if (!selectedProvider) {
      throw new Error("Farcaster Wallet not found. Are you sure you are inside Warpcast?");
    }
  }

  if (!selectedProvider) throw new Error("No provider found");
  
  return new BrowserProvider(selectedProvider);
}

export async function connectWallet(type: 'farcaster' | 'coinbase' | 'metamask'): Promise<{ signer: JsonRpcSigner, address: string }> {
  try {
    const provider = await getWalletProvider(type);
    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    return { signer, address };
  } catch (err) {
    throw err;
  }
} 