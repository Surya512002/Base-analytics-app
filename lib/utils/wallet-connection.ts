import type { ConnectionType } from "@/lib/types/wallet";

const CONN_TYPE_KEY = "base_conn_type";
const BASE_CHAIN_HEX = "0x2105" as const;

export function persistConnType(type: ConnectionType): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONN_TYPE_KEY, type);
}

export function readConnType(): ConnectionType | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(CONN_TYPE_KEY);
  if (v === "farcaster" || v === "metamask" || v === "coinbase") return v;
  return null;
}

export function clearConnType(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CONN_TYPE_KEY);
}

/** True when running inside Base App / Farcaster mini app with an embedded wallet. */
export async function detectMiniAppConnType(): Promise<ConnectionType | null> {
  if (typeof window === "undefined") return null;
  try {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    const inMiniApp = await sdk.isInMiniApp();
    if (!inMiniApp) return null;
    const provider = await sdk.wallet.getEthereumProvider();
    if (provider) return "farcaster";
  } catch {
    // not in mini app
  }
  return null;
}

/** Best-effort recovery when React state lost connType but wallet is still connected. */
export async function inferConnType(
  address: string
): Promise<ConnectionType | null> {
  const saved = readConnType();
  if (saved === "farcaster") {
    if (await detectMiniAppConnType()) return "farcaster";
    // Stale mini-app conn type on a regular browser — fall through to injected wallet.
  } else if (saved) {
    return saved;
  }

  const mini = await detectMiniAppConnType();
  if (mini) {
    try {
      const { sdk } = await import("@farcaster/miniapp-sdk");
      const provider = await sdk.wallet.getEthereumProvider();
      if (!provider) return null;
      const accounts = (await provider.request({
        method: "eth_accounts",
      })) as string[];
      if (
        accounts?.find((a) => a?.toLowerCase() === address.toLowerCase())
      ) {
        return "farcaster";
      }
    } catch {
      // fall through
    }
  }

  if (typeof window === "undefined") return null;
  const eth = (
    window as unknown as {
      ethereum?: {
        request: (args: { method: string }) => Promise<unknown>;
        isMetaMask?: boolean;
      };
    }
  ).ethereum;
  if (!eth) return null;

  try {
    const accounts = (await eth.request({
      method: "eth_accounts",
    })) as string[];
    const match = accounts?.find(
      (a) => a?.toLowerCase() === address.toLowerCase()
    );
    if (match) return eth.isMetaMask ? "metamask" : "coinbase";
  } catch {
    // ignore
  }
  return null;
}

/** Normalize conn type for onchain txs (avoids mini-app path in a regular browser). */
export async function resolveActiveConnType(
  connType: ConnectionType | null,
  address: string
): Promise<ConnectionType | null> {
  let active = connType ?? (await inferConnType(address));
  if (!active) return null;

  if (active === "farcaster" && !(await detectMiniAppConnType())) {
    active = "metamask";
  }
  return active;
}

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export async function ensureBaseNetwork(provider: Eip1193): Promise<void> {
  const chainId = (await provider.request({ method: "eth_chainId" })) as string;
  const normalized = chainId.toLowerCase();
  if (normalized === BASE_CHAIN_HEX || normalized === "0x2105") return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BASE_CHAIN_HEX }],
    });
  } catch {
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: BASE_CHAIN_HEX,
          chainName: "Base",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://mainnet.base.org"],
          blockExplorerUrls: ["https://basescan.org"],
        },
      ],
    });
  }
}
