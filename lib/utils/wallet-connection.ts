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

/** Best-effort recovery when React state lost connType but wallet is still connected. */
export async function inferConnType(
  address: string
): Promise<ConnectionType | null> {
  const saved = readConnType();
  if (saved) return saved;

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
