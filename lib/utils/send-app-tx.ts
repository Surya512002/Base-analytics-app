import { getEip1193Provider } from "@/app/connection";
import type { ConnectionType } from "@/lib/types/wallet";
import type { ContractCall } from "@/lib/utils/tx";
import { ensureBaseNetwork } from "@/lib/utils/wallet-connection";

const BASE_CHAIN_HEX = "0x2105" as const;
const WALLET_PROMPT_MS = 120_000;

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out — check MetaMask for a pending prompt`)),
      ms
    );
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

async function ensureActiveAccount(
  provider: Eip1193,
  from: string
): Promise<void> {
  const read = (await provider.request({ method: "eth_accounts" })) as string[];
  let match = read?.find((a) => a?.toLowerCase() === from.toLowerCase());
  if (match) return;

  const requested = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  match = requested?.find((a) => a?.toLowerCase() === from.toLowerCase());
  if (!match) {
    throw new Error(
      "Connected wallet does not match your profile — reconnect MetaMask"
    );
  }
}

function buildTxParams(
  from: string,
  call: ContractCall,
  connType: ConnectionType
): Record<string, string> {
  const params: Record<string, string> = {
    from,
    to: call.to,
    data: call.data,
  };
  if (call.value && call.value > BigInt(0)) {
    params.value = `0x${call.value.toString(16)}`;
  }
  if (connType === "farcaster") {
    params.chainId = BASE_CHAIN_HEX;
  }
  return params;
}

/** One code path for every wallet — direct eth_sendTransaction on the real provider. */
export async function sendAppTransaction(
  connType: ConnectionType,
  from: string,
  call: ContractCall
): Promise<string> {
  const provider = (await getEip1193Provider(connType)) as unknown as Eip1193;

  await ensureBaseNetwork(provider);
  await ensureActiveAccount(provider, from);

  try {
    const hash = await withTimeout(
      provider.request({
        method: "eth_sendTransaction",
        params: [buildTxParams(from, call, connType)],
      }),
      WALLET_PROMPT_MS,
      "Wallet confirmation"
    );

    if (!hash || typeof hash !== "string") {
      throw new Error("Transaction was not submitted");
    }
    return hash;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg.toLowerCase().includes("insufficient funds") ||
      msg.toLowerCase().includes("gas")
    ) {
      throw new Error(
        "Need a small amount of ETH on Base for gas — or open in Base App for sponsored txs"
      );
    }
    throw e;
  }
}
