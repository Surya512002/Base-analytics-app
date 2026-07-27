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
  const eth = w?.ethereum;
  if (!eth) return [];
  if (Array.isArray(eth.providers) && eth.providers.length > 0) {
    return eth.providers;
  }
  return [eth];
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
  const mm = listInjectedProviders().find(
    (p) => p.isMetaMask && !p.isCoinbaseWallet
  );
  if (!mm) {
    throw new Error(
      "MetaMask not found — install the extension or choose Base Wallet (email/passkey)."
    );
  }
  return mm;
}

export function pickCoinbaseExtensionProvider(): InjectedProvider {
  const w = win();
  const cb =
    w?.coinbaseWalletExtension ??
    listInjectedProviders().find(
      (p) => p.isCoinbaseWallet || p.isCoinbaseBrowser
    );
  if (!cb) {
    throw new Error(
      "Coinbase Wallet extension not found — install it or use Base Wallet (email/passkey)."
    );
  }
  return cb;
}

/** Prefer Rabby/Rainbow/Brave over MetaMask when user picks “Other wallet”. */
export function pickOtherInjectedProvider(): InjectedProvider {
  const providers = listInjectedProviders();
  const preferred = providers.find(
    (p) =>
      p.isRabby ||
      p.isBraveWallet ||
      (!p.isMetaMask && !p.isCoinbaseWallet && !p.isCoinbaseBrowser)
  );
  if (preferred) return preferred;

  const eth = win()?.ethereum;
  if (eth && !eth.isMetaMask) return eth;

  throw new Error(
    "No other browser wallet found — try MetaMask or Base Wallet (email/passkey)."
  );
}
