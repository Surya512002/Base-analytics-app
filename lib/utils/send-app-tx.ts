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
import {
  detectMiniAppConnType,
  ensureBaseNetwork,
} from "@/lib/utils/wallet-connection";
import { gasLimitForB20Target } from "@/lib/b20/preflight";
import { createBasePublicClient } from "@/lib/utils/base-rpc";

const BASE_CHAIN_HEX = "0x2105" as const;
const WALLET_PROMPT_MS = 120_000;
const CALLS_POLL_MS = 120_000;
const BROADCAST_DETECT_MS = 30_000;
const ONCHAIN_WAIT_MS = 180_000;

type Eip1193 = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type CallsStatus = {
  status?: string | number;
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

function isTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
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
    if (receipt.transactionHash?.startsWith("0x")) {
      return receipt.transactionHash;
    }
  }
  return null;
}

/** EIP-5792 uses numeric codes (100/200/500); some wallets still send strings. */
function normalizeCallsStatus(
  status: CallsStatus["status"]
): "pending" | "confirmed" | "failed" | "unknown" {
  if (status == null) return "unknown";
  if (typeof status === "number") {
    if (status >= 100 && status < 200) return "pending";
    if (status >= 200 && status < 300) return "confirmed";
    if (status >= 400) return "failed";
    return "unknown";
  }
  const s = String(status).toUpperCase();
  if (s === "PENDING" || s === "100") return "pending";
  if (s === "CONFIRMED" || s === "200") return "confirmed";
  if (s === "FAILED" || s === "REVERTED" || s === "500") return "failed";
  return "unknown";
}

/** Fail fast when the wallet returns a hash that never hits the mempool (common in Base App). */
async function assertTxVisibleOnBase(hash: string): Promise<void> {
  const pub = createBasePublicClient();
  const deadline = Date.now() + BROADCAST_DETECT_MS;
  while (Date.now() < deadline) {
    try {
      const pending = await pub.getTransaction({ hash: hash as `0x${string}` });
      if (pending) return;
    } catch {
      /* not indexed yet */
    }
    await new Promise((r) => setTimeout(r, 1_500));
  }
  throw new Error(
    "Launch was not broadcast on Base — reconnect wallet and retry with a new salt"
  );
}

/** Wait until the tx is mined — more reliable than getTransaction alone for smart wallets. */
async function waitForOnchainHash(hash: string): Promise<string> {
  if (!isTxHash(hash)) {
    throw new Error("Wallet returned an invalid transaction hash");
  }
  await assertTxVisibleOnBase(hash);
  const pub = createBasePublicClient();
  try {
    const receipt = await pub.waitForTransactionReceipt({
      hash: hash as `0x${string}`,
      timeout: ONCHAIN_WAIT_MS,
      pollingInterval: 2_000,
    });
    if (receipt.status !== "success") {
      throw new Error("Transaction reverted on Base");
    }
    return hash;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("revert")) throw e;
    if (msg.includes("not broadcast")) throw e;
    throw new Error(
      "Launch was not confirmed on Base — ensure you have enough ETH for gas, reconnect wallet, and retry with a new salt"
    );
  }
}

async function pollCallsStatus(provider: Eip1193, id: string): Promise<string> {
  const deadline = Date.now() + CALLS_POLL_MS;
  while (Date.now() < deadline) {
    const raw = (await provider.request({
      method: "wallet_getCallsStatus",
      params: [id],
    })) as CallsStatus & { status?: string | number };

    const state = normalizeCallsStatus(raw?.status);
    if (state === "confirmed") {
      const hash = extractTxHashFromStatus(raw);
      if (hash) return hash;
    }
    if (state === "failed") {
      throw new Error("Sponsored transaction failed onchain");
    }

    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error("Sponsored transaction timed out waiting for confirmation");
}

async function sendViaWalletSendCalls(
  provider: Eip1193,
  from: string,
  calls: ContractCall[],
  capabilities: Record<string, unknown>
): Promise<string> {
  const callPayload = prepareCallsForWalletSendCalls(calls).map((call) => {
    const valueHex =
      call.value && call.value > BigInt(0)
        ? `0x${call.value.toString(16)}`
        : "0x0";
    const entry: Record<string, string> = {
      to: call.to,
      data: call.data,
      value: valueHex,
    };
    if (call.gas && call.gas > BigInt(0)) {
      entry.gas = `0x${call.gas.toString(16)}`;
    }
    return entry;
  });

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

      // Some wallets return a tx hash directly instead of a batch id.
      if (isTxHash(id)) {
        try {
          return await pollCallsStatus(provider, id);
        } catch {
          return id;
        }
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

/** B20 precompiles cannot use paymaster — user wallet pays gas. */
async function sendB20Launch(
  provider: Eip1193,
  from: string,
  call: ContractCall,
  connType: ConnectionType,
  inMiniApp: boolean
): Promise<string> {
  const errors: string[] = [];

  // Desktop browser wallets (MetaMask, Rabby, Coinbase extension) must use
  // eth_sendTransaction — wallet_sendCalls often returns ghost hashes outside Base App.
  const useSendCallsFirst =
    inMiniApp &&
    (connType === "farcaster" ||
      connType === "baseAccount" ||
      connType === "coinbase");

  const attempts: Array<() => Promise<string>> = useSendCallsFirst
    ? [
        () => sendViaWalletSendCalls(provider, from, [call], {}),
        () => sendViaEthSendTransaction(provider, from, call),
      ]
    : [() => sendViaEthSendTransaction(provider, from, call)];

  for (const attempt of attempts) {
    try {
      const hash = await attempt();
      return await waitForOnchainHash(hash);
    } catch (e) {
      if (isUserRejection(e)) throw e;
      errors.push(e instanceof Error ? e.message.split("\n")[0]! : "Launch submit failed");
    }
  }

  throw new Error(
    errors[0] ||
      "B20 launch failed — reconnect wallet, ensure ≥0.0001 ETH on Base, and retry with a new salt"
  );
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

  if (b20Only) {
    const inMiniApp = Boolean(await detectMiniAppConnType());
    return sendB20Launch(provider, from, batch[0]!, connType, inMiniApp);
  }

  const b20InBatch = batchUsesB20Precompile(batch);
  const sendCallsCaps = getSendCallsCapabilities(b20InBatch, {
    skipPaymaster: b20InBatch,
  });

  if (trySponsored) {
    try {
      return await sendViaWalletSendCalls(provider, from, batch, sendCallsCaps);
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
