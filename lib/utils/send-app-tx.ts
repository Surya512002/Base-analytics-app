import { getEip1193Provider } from "@/app/connection";
import type { ConnectionType } from "@/lib/types/wallet";
import {
  getSendCallsCapabilities,
  supportsPaymaster,
  batchUsesB20Precompile,
} from "@/lib/utils/paymaster";
import type { ContractCall } from "@/lib/utils/tx";
import {
  prepareCallsForWalletSendCalls,
  withBuilderSuffix,
  isB20PrecompileAddress,
  finalizeAppTransactionBatch,
} from "@/lib/utils/tx";
import { ensureBaseNetwork } from "@/lib/utils/wallet-connection";
import { gasLimitForB20Target } from "@/lib/b20/preflight";

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

function isUserRejection(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("reject") ||
    msg.includes("denied") ||
    msg.includes("cancel") ||
    msg.includes("4001")
  );
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
  call: ContractCall
): Record<string, string> {
  const data = isB20PrecompileAddress(call.to)
    ? call.data
    : withBuilderSuffix(call.data);
  const params: Record<string, string> = {
    from,
    to: call.to,
    data,
    chainId: BASE_CHAIN_HEX,
  };
  if (call.value && call.value > BigInt(0)) {
    params.value = `0x${call.value.toString(16)}`;
  }
  if (isB20PrecompileAddress(call.to)) {
    const gas = call.gas ?? gasLimitForB20Target(call.to);
    params.gas = `0x${gas.toString(16)}`;
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
  calls: ContractCall[]
): Promise<string> {
  const callPayload = prepareCallsForWalletSendCalls(calls).map((call) => {
    const valueHex =
      call.value && call.value > BigInt(0)
        ? `0x${call.value.toString(16)}`
        : "0x0";
    return {
      to: call.to,
      data: call.data,
      value: valueHex,
    };
  });

  const capabilities = getSendCallsCapabilities(
    batchUsesB20Precompile(calls)
  );
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
              calls: callPayload,
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
  call: ContractCall
): Promise<string> {
  const hash = await withTimeout(
    provider.request({
      method: "eth_sendTransaction",
      params: [buildLegacyTxParams(from, call)],
    }),
    WALLET_PROMPT_MS,
    "Wallet confirmation"
  );

  if (!hash || typeof hash !== "string") {
    throw new Error("Transaction was not submitted");
  }
  return hash;
}

async function sendViaEthSendTransactionBatch(
  provider: Eip1193,
  from: string,
  calls: ContractCall[]
): Promise<string> {
  let lastHash = "";
  for (const call of calls) {
    lastHash = await sendViaEthSendTransaction(provider, from, call);
  }
  return lastHash;
}

export type SendAppTxOptions = {
  /** B20 factory calls must not be paired with a companion attribution tx (breaks paymaster batches). */
  skipBuilderCompanion?: boolean;
};

/** Sends one or more app contract calls — sponsored via paymaster in Base App / Coinbase Wallet. */
export async function sendAppTransactions(
  connType: ConnectionType,
  from: string,
  calls: ContractCall[],
  options?: SendAppTxOptions
): Promise<string> {
  if (calls.length === 0) {
    throw new Error("No transactions to send");
  }

  const batch = finalizeAppTransactionBatch(calls, {
    skipCompanion: options?.skipBuilderCompanion,
  });

  const provider = (await getEip1193Provider(connType)) as unknown as Eip1193;

  await ensureBaseNetwork(provider);
  await ensureActiveAccount(provider, from);

  const trySponsored = supportsPaymaster(connType);
  const b20Only =
    batch.length === 1 && isB20PrecompileAddress(batch[0]!.to);

  // B20 precompiles need explicit gas — legacy eth_sendTransaction is most reliable.
  if (b20Only) {
    try {
      return await sendViaEthSendTransaction(provider, from, batch[0]!);
    } catch (e) {
      if (isUserRejection(e)) throw e;
      if (!trySponsored) throw e;
    }
  }

  if (trySponsored) {
    try {
      return await sendViaWalletSendCalls(provider, from, batch);
    } catch (e) {
      if (isUserRejection(e)) throw e;
      return sendViaEthSendTransactionBatch(provider, from, batch);
    }
  }

  return sendViaEthSendTransactionBatch(provider, from, batch);
}

/** Sends an app contract call — sponsored via paymaster in Base App / Coinbase Wallet. */
export async function sendAppTransaction(
  connType: ConnectionType,
  from: string,
  call: ContractCall
): Promise<string> {
  return sendAppTransactions(connType, from, [call]);
}
