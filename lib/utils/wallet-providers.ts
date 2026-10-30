import type { Eip1193Provider } from "ethers";

type InjectedProvider = Eip1193Provider & {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isCoinbaseBrowser?: boolean;
  isRabby?: boolean;
  isBraveWallet?: boolean;
  providers?: InjectedProvider[];
};

type WindowWithEthereum = Window & {
  ethereum?: InjectedProvider;
  coinbaseWalletExtension?: InjectedProvider;
};

export type BrowserWalletAvailability = {
  /** Base smart wallet (passkey / email) — always available in a normal browser tab. */
  baseAccount: boolean;
  metamask: boolean;
  coinbase: boolean;
  /** Rabby, Rainbow, Brave, etc. */
  otherInjected: boolean;
};

function win(): WindowWithEthereum | undefined {
  if (typeof window === "undefined") return undefined;
  return window as WindowWithEthereum;
}

/** All EIP-1193 providers exposed on `window.ethereum` (multi-wallet browsers). */
export function listInjectedProviders(): InjectedProvider[] {
  const w = win();
  const list: InjectedProvider[] = [];
  if (w?.coinbaseWalletExtension) {
    list.push(w.coinbaseWalletExtension);
  }
  const eth = w?.ethereum;
  if (eth) {
    if (Array.isArray(eth.providers) && eth.providers.length > 0) {
      for (const p of eth.providers) {
        if (!list.includes(p)) list.push(p);
      }
    } else if (!list.includes(eth)) {
      list.push(eth);
    }
  }
  return list;
}

export function detectBrowserWalletAvailability(): BrowserWalletAvailability {
  const w = win();
  const providers = listInjectedProviders();
  const metamask = providers.some((p) => p.isMetaMask && !p.isCoinbaseWallet);
  const coinbase = Boolean(
    w?.coinbaseWalletExtension ||
      providers.some((p) => p.isCoinbaseWallet || p.isCoinbaseBrowser)
  );
  const otherInjected = providers.some(
    (p) => !p.isMetaMask && !p.isCoinbaseWallet && !p.isCoinbaseBrowser
  );

  return {
    baseAccount: typeof window !== "undefined",
    metamask,
    coinbase,
    otherInjected,
  };
}

export function pickMetaMaskProvider(): InjectedProvider {
  const providers = listInjectedProviders();
  const mm =
    providers.find((p) => p.isMetaMask && !p.isCoinbaseWallet) ??
    providers.find((p) => p.isMetaMask);
  if (mm) return mm;
  const eth = win()?.ethereum;
  if (eth) return eth;
  throw new Error(
    "MetaMask not found — install the extension or choose Base Wallet (email/passkey)."
  );
}

export function pickCoinbaseExtensionProvider(): InjectedProvider {
  const w = win();
  const cb =
    w?.coinbaseWalletExtension ??
    listInjectedProviders().find(
      (p) => p.isCoinbaseWallet || p.isCoinbaseBrowser
    ) ??
    (w?.ethereum?.isCoinbaseWallet ? w.ethereum : undefined);
  if (cb) return cb;
  if (w?.ethereum) return w.ethereum;
  throw new Error(
    "Coinbase Wallet extension not found — install it or use Base Wallet (email/passkey)."
  );
}

/** Prefer Rabby/Rainbow/Brave over MetaMask when user picks “Other wallet”, with safe fallbacks. */
export function pickOtherInjectedProvider(): InjectedProvider {
  const providers = listInjectedProviders();
  const preferred = providers.find(
    (p) =>
      p.isRabby ||
      p.isBraveWallet ||
      (!p.isMetaMask && !p.isCoinbaseWallet && !p.isCoinbaseBrowser)
  );
  if (preferred) return preferred;

  // Safe fallback to any available injected provider (Coinbase extension, MetaMask, or standard window.ethereum)
  const w = win();
  if (w?.coinbaseWalletExtension) return w.coinbaseWalletExtension;
  if (w?.ethereum) return w.ethereum;
  if (providers.length > 0) return providers[0];

  throw new Error(
    "No browser wallet found — install MetaMask, Coinbase Wallet, or use Base Wallet (email/passkey)."
  );
}