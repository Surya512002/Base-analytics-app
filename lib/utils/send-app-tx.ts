import { getEip1193Provider } from "@/app/connection";
import type { ConnectionType } from "@/lib/types/wallet";
import {
  getSendCallsCapabilities,
  supportsPaymaster,
} from "@/lib/utils/paymaster";
import type { ContractCall } from "@/lib/utils/tx";
import {
  prepareCallsForWalletSendCalls,
  withBuilderSuffix,
  isB20PrecompileAddress,
  isPreservedCalldataCall,
  finalizeAppTransactionBatch,
  canBundleViaMulticall3,
  bundleCallsViaMulticall3,
  hasBuilderSuffix,
  stripBuilderSuffix,
  batchCanUseWalletDataSuffix,
  isErc20ApproveCall as isErc20ApproveCallData,
} from "@/lib/utils/tx";
import {
  detectMiniAppConnType,
  ensureBaseNetwork,
} from "@/lib/utils/wallet-connection";
import { gasLimitForB20Target } from "@/lib/b20/preflight";
import { createPublicOnlyBaseClient, withRpcRetry } from "@/lib/utils/base-rpc";

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
  const data = isPreservedCalldataCall(call)
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
  const pub = createPublicOnlyBaseClient();
  const deadline = Date.now() + BROADCAST_DETECT_MS;
  while (Date.now() < deadline) {
    try {
      const pending = await withRpcRetry(() =>
        pub.getTransaction({ hash: hash as `0x${string}` })
      );
      if (pending) return;
    } catch {
      /* not indexed yet or RPC hiccup */
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
  const pub = createPublicOnlyBaseClient();
  try {
    const receipt = await withRpcRetry(() =>
      pub.waitForTransactionReceipt({
        hash: hash as `0x${string}`,
        timeout: ONCHAIN_WAIT_MS,
        pollingInterval: 2_000,
      })
    );
    if (receipt.status !== "success") {
      throw new Error("Transaction reverted on Base");
    }
    return hash;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.toLowerCase().includes("revert")) throw e;
    if (msg.includes("not broadcast")) throw e;
    // Do not soft-succeed: sequential approve→LP / auto-seed must wait for a real receipt.
    throw new Error(
      msg.includes("Timeout") || msg.toLowerCase().includes("timed out")
        ? "Transaction sent but not confirmed yet — check BaseScan, then retry the next step"
        : msg.split("\n")[0] || "Could not confirm transaction on Base — retry in a moment"
    );
  }
}

async function pollCallsStatus(provider: Eip1193, id: string): Promise<string> {
  const deadline = Date.now() + CALLS_POLL_MS;
  let confirmedWithoutHashMs = 0;
  while (Date.now() < deadline) {
    const raw = (await provider.request({
      method: "wallet_getCallsStatus",
      params: [id],
    })) as CallsStatus & { status?: string | number };

    const state = normalizeCallsStatus(raw?.status);
    if (state === "confirmed") {
      const hash = extractTxHashFromStatus(raw);
      if (hash) return hash;
      confirmedWithoutHashMs += 1200;
      // Confirmed batch without a hash is a dead end — fail before hanging the full timeout.
      if (confirmedWithoutHashMs >= 8_000) {
        throw new Error(
          "Wallet confirmed the batch but returned no transaction hash — reopen wallet and check BaseScan"
        );
      }
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

async function waitForTxMined(hash: string): Promise<void> {
  await waitForOnchainHash(hash);
}

function isErc20ApproveCall(call: ContractCall): boolean {
  if (isB20PrecompileAddress(call.to)) return false;
  return isErc20ApproveCallData(call);
}

/** Approve is isolated for legacy sequential wallets; atomic batches keep one on-chain tx. */
function groupCallsForExecution(
  calls: ContractCall[],
  atomic: boolean
): ContractCall[][] {
  if (atomic) return [calls];

  const groups: ContractCall[][] = [];
  let i = 0;
  while (i < calls.length) {
    if (isErc20ApproveCall(calls[i]!)) {
      groups.push([calls[i]!]);
      i++;
      continue;
    }
    const batch: ContractCall[] = [];
    while (i < calls.length && !isErc20ApproveCall(calls[i]!)) {
      batch.push(calls[i]!);
      i++;
    }
    if (batch.length) groups.push(batch);
  }
  return groups;
}

function isPaymasterDenied(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("paymaster") ||
    msg.includes("sponsor") ||
    msg.includes("request denied") ||
    msg.includes("not allowlisted") ||
    msg.includes("-32001")
  );
}

/** B20 precompile legs must run first; router/fee legs can be paymaster-sponsored. */
function partitionB20PreflightCalls(calls: ContractCall[]): {
  preflight: ContractCall[];
  main: ContractCall[];
} {
  const preflight: ContractCall[] = [];
  const main: ContractCall[] = [];
  for (const call of calls) {
    if (isB20PrecompileAddress(call.to)) preflight.push(call);
    else main.push(call);
  }
  return { preflight, main };
}

/** Zero-value builder attribution companion(s) appended after B20 create. */
function isAttributionCompanionBatch(calls: ContractCall[]): boolean {
  if (calls.length === 0) return false;
  return calls.every((c) => {
    const bare = hasBuilderSuffix(c.data) ? stripBuilderSuffix(c.data) : c.data;
    return (
      bare === "0x" &&
      (!c.value || c.value === BigInt(0)) &&
      !isB20PrecompileAddress(c.to)
    );
  });
}

function batchCanTryPaymaster(calls: ContractCall[]): boolean {
  if (calls.length === 0) return false;
  return !calls.every((c) => isB20PrecompileAddress(c.to));
}

async function sendWalletCallsWithPaymasterFallback(
  provider: Eip1193,
  from: string,
  calls: ContractCall[],
  tryPaymaster: boolean
): Promise<string> {
  // Only use wallet dataSuffix capability when every leg can accept rewrite.
  // Mixed 0x/preserve batches keep builder in-calldata (prepare does not strip).
  const skipBuilderCap = !batchCanUseWalletDataSuffix(calls);

  if (tryPaymaster) {
    try {
      return await sendViaWalletSendCalls(
        provider,
        from,
        calls,
        getSendCallsCapabilities(skipBuilderCap, { skipPaymaster: false })
      );
    } catch (e) {
      if (isUserRejection(e)) throw e;
      if (!isPaymasterDenied(e)) throw e;
    }
  }

  return sendViaWalletSendCalls(
    provider,
    from,
    calls,
    getSendCallsCapabilities(skipBuilderCap, { skipPaymaster: true })
  );
}

async function sendSingleCall(
  provider: Eip1193,
  from: string,
  call: ContractCall,
  opts: { preferSendCalls: boolean }
): Promise<string> {
  const tryPaymaster = !isB20PrecompileAddress(call.to);

  if (opts.preferSendCalls) {
    try {
      return await sendWalletCallsWithPaymasterFallback(
        provider,
        from,
        [call],
        tryPaymaster
      );
    } catch (e) {
      if (isUserRejection(e)) throw e;
    }
  }

  return sendViaEthSendTransaction(provider, from, call);
}

async function simulateContractCall(
  from: string,
  call: ContractCall
): Promise<boolean> {
  try {
    const pub = createPublicOnlyBaseClient();
    await withRpcRetry(() =>
      pub.call({
        account: from as `0x${string}`,
        to: call.to,
        data: call.data,
        ...(call.value && call.value > BigInt(0) ? { value: call.value } : {}),
      })
    );
    return true;
  } catch {
    return false;
  }
}

async function sendCallGroup(
  provider: Eip1193,
  from: string,
  group: ContractCall[],
  opts: { preferSendCalls: boolean; atomicBatch: boolean }
): Promise<string> {
  if (group.length === 0) {
    throw new Error("No calls in group");
  }
  if (group.length === 1) {
    return sendSingleCall(provider, from, group[0]!, opts);
  }

  const tryPaymaster = batchCanTryPaymaster(group);
  const multicallable = opts.atomicBatch && canBundleViaMulticall3(group);

  // Desktop EOAs: try Multical only if eth_call simulates clean — never open a doomed prompt.
  if (multicallable && !opts.preferSendCalls) {
    try {
      const bundled = bundleCallsViaMulticall3(group);
      const ok = await simulateContractCall(from, bundled);
      if (ok) {
        const hash = await sendViaEthSendTransaction(provider, from, bundled);
        return waitForOnchainHash(hash);
      }
    } catch (e) {
      if (isUserRejection(e)) throw e;
    }
  }

  // Base App / Coinbase / Farcaster — true batching + optional paymaster.
  if (opts.preferSendCalls || opts.atomicBatch) {
    try {
      return await sendWalletCallsWithPaymasterFallback(
        provider,
        from,
        group,
        tryPaymaster && opts.preferSendCalls
      );
    } catch (e) {
      if (isUserRejection(e)) throw e;
    }
  }

  if (multicallable) {
    try {
      const bundled = bundleCallsViaMulticall3(group);
      const ok = await simulateContractCall(from, bundled);
      if (ok) {
        const hash = await sendViaEthSendTransaction(provider, from, bundled);
        return waitForOnchainHash(hash);
      }
    } catch (e) {
      if (isUserRejection(e)) throw e;
    }
  }

  // Sequential fallback: required for ERC20 fee transfers (Multicall3 can't
  // transferFrom the user's balance via token.transfer), and when Multical / sendCalls fail.
  // Always wait for each leg to mine before the next — otherwise approve+LP after
  // B20 launch races (LP simulates with allowance still 0 and reverts).
  let lastHash = "";
  for (let i = 0; i < group.length; i++) {
    lastHash = await sendSingleCall(provider, from, group[i]!, opts);
    if (i < group.length - 1) {
      await waitForTxMined(lastHash);
    }
  }
  return lastHash;
}

async function sendGroupedAppCalls(
  provider: Eip1193,
  from: string,
  calls: ContractCall[],
  opts: { preferSendCalls: boolean; atomicBatch: boolean }
): Promise<string> {
  const useAtomic = opts.atomicBatch;
  const groups = groupCallsForExecution(calls, useAtomic);
  let lastHash = "";
  for (let g = 0; g < groups.length; g++) {
    lastHash = await sendCallGroup(provider, from, groups[g]!, opts);
    if (!useAtomic && g < groups.length - 1) {
      await waitForTxMined(lastHash);
    }
  }
  return lastHash;
}

function prefersWalletSendCalls(
  connType: ConnectionType,
  inMiniApp: boolean
): boolean {
  if (inMiniApp) return true;
  return (
    connType === "farcaster" ||
    connType === "baseAccount" ||
    connType === "coinbase"
  );
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
  /**
   * Skip treasury companion after B20-only batches.
   * Prefer leaving this unset — companion is required for builder attribution on creates.
   */
  skipBuilderCompanion?: boolean;
  /** When true (default), approve + swap + fee transfers run in one wallet_sendCalls batch. */
  atomicBatch?: boolean;
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
  const inMiniApp = Boolean(await detectMiniAppConnType());
  const preferSendCalls = prefersWalletSendCalls(connType, inMiniApp);
  const atomicBatch = options?.atomicBatch !== false;

  const { preflight, main } = partitionB20PreflightCalls(batch);
  let workBatch = batch;

  if (preflight.length > 0 && main.length > 0) {
    const b20CreateOnly =
      preflight.length === 1 && isB20PrecompileAddress(preflight[0]!.to);

    const createHash = b20CreateOnly
      ? await sendB20Launch(provider, from, preflight[0]!, connType, inMiniApp)
      : await sendGroupedAppCalls(provider, from, preflight, {
          preferSendCalls,
          atomicBatch,
        });

    if (!b20CreateOnly) {
      await waitForTxMined(createHash);
    }

    // B20 create + builder companion: attribute, but return the create hash for registration.
    if (isAttributionCompanionBatch(main)) {
      try {
        await sendGroupedAppCalls(provider, from, main, {
          preferSendCalls,
          atomicBatch: true,
        });
      } catch (e) {
        if (!isUserRejection(e)) {
          console.warn("[builder] attribution companion failed after B20 create", e);
        }
      }
      return createHash;
    }

    workBatch = main;
  }

  const b20Only =
    workBatch.length === 1 && isB20PrecompileAddress(workBatch[0]!.to);

  if (b20Only) {
    return sendB20Launch(provider, from, workBatch[0]!, connType, inMiniApp);
  }

  if (workBatch.length > 1) {
    return sendGroupedAppCalls(provider, from, workBatch, {
      preferSendCalls,
      atomicBatch,
    });
  }

  if (trySponsored || preferSendCalls) {
    try {
      return await sendWalletCallsWithPaymasterFallback(
        provider,
        from,
        workBatch,
        batchCanTryPaymaster(workBatch)
      );
    } catch (e) {
      if (isUserRejection(e)) throw e;
      return sendViaEthSendTransaction(provider, from, workBatch[0]!);
    }
  }

  return sendViaEthSendTransaction(provider, from, workBatch[0]!);
}

/** Sends an app contract call — sponsored via paymaster in Base App / Coinbase Wallet. */
export async function sendAppTransaction(
  connType: ConnectionType,
  from: string,
  call: ContractCall
): Promise<string> {
  return sendAppTransactions(connType, from, [call]);
}
