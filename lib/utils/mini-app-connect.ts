import type { ConnectionType } from "@/lib/types/wallet";
import {
  detectMiniAppConnType,
  ensureBaseNetwork,
} from "@/lib/utils/wallet-connection";
import { connectWallet, getEip1193Provider } from "@/app/connection";

const CONNECT_TIMEOUT_MS = 55_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out — try again`)), ms)
    ),
  ]);
}

/**
 * Inside Base App / Farcaster mini apps the embedded smart wallet is exposed
 * via the miniapp SDK — not via @base-org/account (browser passkey flow).
 */
export async function resolveConnectType(
  requested: ConnectionType
): Promise<ConnectionType> {
  const mini = await detectMiniAppConnType();
  if (!mini) return requested;

  if (requested === "baseAccount" || requested === "coinbase") {
    return "farcaster";
  }
  return requested;
}

export async function connectAppWallet(
  requested: ConnectionType
): Promise<{ address: string; connType: ConnectionType }> {
  const connType = await resolveConnectType(requested);

  if (connType === "farcaster") {
    const { sdk } = await import("@farcaster/miniapp-sdk");
    if (sdk?.actions?.ready) {
      try {
        sdk.actions.ready();
      } catch {
        // ignore
      }
    }
    const provider = await sdk.wallet.getEthereumProvider();
    if (!provider) {
      throw new Error("Base App wallet not available — open inside Base App");
    }
    const accounts = (await withTimeout(
      provider.request({ method: "eth_requestAccounts" }) as Promise<string[]>,
      CONNECT_TIMEOUT_MS,
      "Wallet connection"
    )) as string[];
    const address = accounts?.find((a) => a?.startsWith("0x"));
    if (!address) throw new Error("No wallet account connected");
    await ensureBaseNetwork(provider);
    return { address, connType: "farcaster" };
  }

  if (connType === "baseAccount") {
    const { connectBaseAccount } = await import("@/lib/base-account");
    const connected = await withTimeout(
      connectBaseAccount(),
      CONNECT_TIMEOUT_MS,
      "Base Wallet connection"
    );
    return { address: connected.address, connType: "baseAccount" };
  }

  const { address } = await withTimeout(
    connectWallet(connType),
    CONNECT_TIMEOUT_MS,
    "Wallet connection"
  );
  const provider = await getEip1193Provider(connType);
  await ensureBaseNetwork(provider);
  return { address, connType };
}

export async function isInsideBaseMiniApp(): Promise<boolean> {
  return Boolean(await detectMiniAppConnType());
}
