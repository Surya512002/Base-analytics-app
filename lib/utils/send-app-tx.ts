import { getEip1193Provider } from "@/app/connection";
import type { ConnectionType } from "@/lib/types/wallet";
import {
  getSendCallsCapabilities,
  supportsPaymaster,
} from "@/lib/utils/paymaster";
import {
  isMetaMaskFeeDisplayError,
  METAMASK_FEE_DISPLAY_HINT,
} from "@/lib/utils/metamask-errors";
import type { ContractCall } from "@/lib/utils/tx";
import {
  prepareCallsForWalletSendCalls,
  withBuilderSuffix,
} from "@/lib/utils/tx";
import { ensureBaseNetwork } from "@/lib/utils/wallet-connection";

const BASE_CHAIN_HEX = "0x2105" as const;
const WALLET_PROMPT_MS = 120_000;
const CALLS_POLL_MS = 120_000;
/** Safe fallback when eth_estimateGas is unavailable (app contract calls). */
const DEFAULT_GAS_HEX = "0x7a120" as const;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function buildLegacyTxBase(
  from: string,
  call: ContractCall
): Record<string, string> {
  const params: Record<string, string> = {
    from,
    to: call.to,
    data: withBuilderSuffix(call.data),
    chainId: BASE_CHAIN_HEX,
  };
  if (call.value && call.value > BigInt(0)) {
    params.value = `0x${call.value.toString(16)}`;
  }
  return params;
}

/** Pre-set gas as hex so MetaMask skips broken float fee math on fresh sessions. */
async function buildLegacyTxParams(
  provider: Eip1193,
  from: string,
  call: ContractCall
): Promise<Record<string, string>> {
  const params = buildLegacyTxBase(from, call);
  try {
    const estimated = await provider.request({
      method: "eth_estimateGas",
      params: [params],
    });
    const gas = BigInt(String(estimated));
    const buffered = (gas * 130n) / 100n;
    params.gas = `0x${buffered.toString(16)}`;
  } catch {
    params.gas = DEFAULT_GAS_HEX;
  }
  return params;
}

async function waitForBaseChain(
  provider: Eip1193,
  attempts = 24
): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    const chainId = (await provider.request({ method: "eth_chainId" })) as string;
    if (chainId.toLowerCase() === BASE_CHAIN_HEX) return;
    await sleep(125);
  }
  throw new Error(
    "Could not switch to Base — select Base network in your wallet and retry"
  );
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
  call: ContractCall,
  attempt = 0
): Promise<string> {
  try {
    const params = await buildLegacyTxParams(provider, from, call);
    const hash = await withTimeout(
      provider.request({
        method: "eth_sendTransaction",
        params: [params],
      }),
      WALLET_PROMPT_MS,
      "Wallet confirmation"
    );

    if (!hash || typeof hash !== "string") {
      throw new Error("Transaction was not submitted");
    }
    return hash;
  } catch (e) {
    if (attempt < 1 && isMetaMaskFeeDisplayError(e)) {
      await sleep(500);
      return sendViaEthSendTransaction(provider, from, call, attempt + 1);
    }
    if (isMetaMaskFeeDisplayError(e)) {
      throw new Error(METAMASK_FEE_DISPLAY_HINT);
    }
    throw e;
  }
}

/** Sends one or more app contract calls — sponsored via paymaster in Base App / Coinbase Wallet. */
export async function sendAppTransactions(
  connType: ConnectionType,
  from: string,
  calls: ContractCall[]
): Promise<string> {
  if (calls.length === 0) {
    throw new Error("No transactions to send");
  }

  const provider = (await getEip1193Provider(connType)) as unknown as Eip1193;

  await ensureBaseNetwork(provider);
  await ensureActiveAccount(provider, from);

  const trySponsored = supportsPaymaster(connType);

  if (trySponsored) {
    try {
      return await sendViaWalletSendCalls(provider, from, calls);
    } catch (e) {
      if (isUserRejection(e)) throw e;
      if (calls.length === 1) {
        return sendViaEthSendTransaction(provider, from, calls[0]);
      }
      throw e;
    }
  }

  let lastHash = "";
  for (const call of calls) {
    lastHash = await sendViaEthSendTransaction(provider, from, call);
  }
  return lastHash;
}

/** Sends an app contract call — sponsored via paymaster in Base App / Coinbase Wallet. */
export async function sendAppTransaction(
  connType: ConnectionType,
  from: string,
  call: ContractCall
): Promise<string> {
  return sendAppTransactions(connType, from, [call]);
}
