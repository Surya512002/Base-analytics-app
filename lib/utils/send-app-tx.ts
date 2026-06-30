import { getEip1193Provider } from "@/app/connection";
import type { ConnectionType } from "@/lib/types/wallet";
import {
  getSendCallsCapabilities,
  supportsPaymaster,
} from "@/lib/utils/paymaster";
import type { ContractCall } from "@/lib/utils/tx";
import { stripBuilderSuffix, withBuilderSuffix } from "@/lib/utils/tx";
import { ensureBaseNetwork, detectMiniAppConnType } from "@/lib/utils/wallet-connection";

const BASE_CHAIN_HEX = "0x2105" as const;
const WALLET_PROMPT_MS = 120_000;
const CALLS_POLL_MS = 120_000;

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type CallsStatus = {
  status?: string;
  receipts?: Array<{ transactionHash?: string; status?: string }>;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out — check your wallet for a pending prompt`)),
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
      "Connected wallet does not match your profile — reconnect your wallet"
    );
  }
}

function buildLegacyTxParams(
  from: string,
  call: ContractCall,
  connType: ConnectionType
): Record<string, string> {
  const params: Record<string, string> = {
    from,
    to: call.to,
    data: withBuilderSuffix(call.data),
  };
  if (call.value && call.value > BigInt(0)) {
    params.value = `0x${call.value.toString(16)}`;
  }
  if (connType === "farcaster") {
    params.chainId = BASE_CHAIN_HEX;
  }
  return params;
}

function isSendCallsUnsupported(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("not supported") ||
    msg.includes("unsupported") ||
    msg.includes("method not found") ||
    msg.includes("unknown method") ||
    msg.includes("invalid method")
  );
}

function extractCallsId(result: unknown): string | null {
  if (typeof result === "string" && result.startsWith("0x")) return result;
  if (result && typeof result === "object" && "id" in result) {
    const id = (result as { id?: string }).id;
    if (id && typeof id === "string") return id;
  }
  return null;
}

function extractTxHashFromStatus(status: CallsStatus): string | null {
  for (const receipt of status.receipts ?? []) {
    if (receipt.transactionHash) return receipt.transactionHash;
  }
  return null;
}

async function pollCallsStatus(provider: Eip1193, id: string): Promise<string> {
  const deadline = Date.now() + CALLS_POLL_MS;
  while (Date.now() < deadline) {
    const raw = (await provider.request({
      method: "wallet_getCallsStatus",
      params: [id],
    })) as CallsStatus;

    const normalized = raw?.status?.toUpperCase();
    if (normalized === "CONFIRMED") {
      const hash = extractTxHashFromStatus(raw);
      if (hash) return hash;
    }
    if (normalized === "FAILED" || normalized === "REVERTED") {
      throw new Error("Sponsored transaction failed onchain");
    }

    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error("Sponsored transaction timed out waiting for confirmation");
}

async function sendViaWalletSendCalls(
  provider: Eip1193,
  from: string,
  call: ContractCall
): Promise<string> {
  const calldata = stripBuilderSuffix(call.data);
  const valueHex =
    call.value && call.value > BigInt(0)
      ? `0x${call.value.toString(16)}`
      : "0x0";

  const capabilities = getSendCallsCapabilities();
  let lastErr: unknown;

  for (const version of ["1.0", "2.0.0"] as const) {
    try {
      const result = await withTimeout(
        provider.request({
          method: "wallet_sendCalls",
          params: [
            {
              version,
              chainId: BASE_CHAIN_HEX,
              from,
              calls: [
                {
                  to: call.to,
                  data: calldata,
                  value: valueHex,
                },
              ],
              capabilities,
            },
          ],
        }),
        WALLET_PROMPT_MS,
        "Wallet confirmation"
      );

      const id = extractCallsId(result);
      if (!id) {
        throw new Error("wallet_sendCalls did not return a batch id");
      }
      return pollCallsStatus(provider, id);
    } catch (e) {
      lastErr = e;
      if (version === "1.0" && isSendCallsUnsupported(e)) continue;
      throw e;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("wallet_sendCalls failed");
}

async function sendViaEthSendTransaction(
  provider: Eip1193,
  from: string,
  call: ContractCall,
  connType: ConnectionType
): Promise<string> {
  const hash = await withTimeout(
    provider.request({
      method: "eth_sendTransaction",
      params: [buildLegacyTxParams(from, call, connType)],
    }),
    WALLET_PROMPT_MS,
    "Wallet confirmation"
  );

  if (!hash || typeof hash !== "string") {
    throw new Error("Transaction was not submitted");
  }
  return hash;
}

/** Sends an app contract call — sponsored via paymaster in Base App / Coinbase Wallet. */
export async function sendAppTransaction(
  connType: ConnectionType,
  from: string,
  call: ContractCall
): Promise<string> {
  const provider = (await getEip1193Provider(connType)) as unknown as Eip1193;

  await ensureBaseNetwork(provider);
  await ensureActiveAccount(provider, from);

  let effectiveConn = connType;
  if (!supportsPaymaster(effectiveConn)) {
    const mini = await detectMiniAppConnType();
    if (mini) effectiveConn = mini;
  }

  const trySponsored = supportsPaymaster(effectiveConn);

  try {
    if (trySponsored) {
      return await sendViaWalletSendCalls(provider, from, call);
    }
    return await sendViaEthSendTransaction(provider, from, call, effectiveConn);
  } catch (e: unknown) {
    if (trySponsored && isSendCallsUnsupported(e)) {
      return sendViaEthSendTransaction(provider, from, call, effectiveConn);
    }

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
