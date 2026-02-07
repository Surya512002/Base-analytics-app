import { BrowserProvider, Eip1193Provider, JsonRpcSigner } from 'ethers';
import { sdk } from "@farcaster/miniapp-sdk";

interface WindowWithEthereum extends Window {
  ethereum?: Eip1193Provider;
  coinbaseWalletExtension?: Eip1193Provider;
}

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
  
  // 3. FARCASTER (Aggressive Polling Fix)
  else if (type === 'farcaster') {
    
    // RETRY LOOP: Try to find the wallet for 5 seconds (20 checks)
    for (let i = 0; i < 20; i++) {
      
      // Check 1: Farcaster SDK Provider (Primary)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((sdk as any).provider) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        selectedProvider = (sdk as any).provider;
        console.log("Found SDK Provider");
        break;
      }

      // Check 2: Window.ethereum (Standard Injection)
      if (win.ethereum) {
        selectedProvider = win.ethereum;
        console.log("Found Window Ethereum");
        break;
      }

      // Wait 250ms before trying again
      await sleep(250);
    }

    if (!selectedProvider) {
      // Final desperate check
      if (win.ethereum) selectedProvider = win.ethereum;
      else {
        throw new Error("Farcaster Wallet still loading... Please tap the button again.");
      }
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