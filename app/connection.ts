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
  
  // 3. FARCASTER (Aggressive Polling)
  else if (type === 'farcaster') {
    for (let i = 0; i < 20; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((sdk as any).provider) { selectedProvider = (sdk as any).provider; break; }
      if (win.ethereum) { selectedProvider = win.ethereum; break; }
      await sleep(250);
    }
    if (!selectedProvider && win.ethereum) selectedProvider = win.ethereum;
    if (!selectedProvider) throw new Error("Farcaster Wallet not found. Please try again.");
  }

  if (!selectedProvider) throw new Error("No provider found");
  
  return new BrowserProvider(selectedProvider);
}

export async function connectWallet(type: 'farcaster' | 'coinbase' | 'metamask'): Promise<{ signer: JsonRpcSigner, address: string }> {
  try {
    const provider = await getWalletProvider(type);

    // FORCE METAMASK TO SHOW ACCOUNT PICKER
    if (type === 'metamask') {
        try {
            // This forces the "Select Account" popup to open
            await provider.send("wallet_requestPermissions", [{ eth_accounts: {} }]);
        } catch (e) {
            console.log("Permissions request cancelled or not supported", e);
        }
    }

    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    return { signer, address };
  } catch (err) {
    throw err;
  }
} 