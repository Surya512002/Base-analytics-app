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
  statusCode?: number;
  receipts?: Array<{
    transactionHash?: string;
    transaction_hash?: string;
    hash?: string;
    status?: string | number;
  }>;
  capabilities?: {
    caip345?: { transactionHashes?: string[] };
  };
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

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const o = err as { message?: unknown; details?: unknown; shortMessage?: unknown };
    if (typeof o.message === "string" && o.message) return o.message;
    if (typeof o.shortMessage === "string" && o.shortMessage) return o.shortMessage;
    if (typeof o.details === "string" && o.details) return o.details;
  }
  return String(err ?? "");
}

function errorCode(err: unknown): number | null {
  if (err && typeof err === "object" && "code" in err) {
    const c = (err as { code?: unknown }).code;
    if (typeof c === "number") return c;
    if (typeof c === "string" && /^-?\d+$/.test(c)) return Number(c);
  }
  return null;
}

function isUserRejection(err: unknown): boolean {
  const code = errorCode(err);
  if (code === 4001) return true;
  const msg = errorMessage(err).toLowerCase();
  // Do NOT match bare "denied" — paymasters often return "request denied".
  return (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    msg.includes("user cancelled") ||
    msg.includes("user canceled") ||
    msg.includes("rejected the request") ||
    msg.includes("rejected by user") ||
    msg.includes("denied by the user") ||
    msg.includes("transaction cancelled") ||
    msg.includes("transaction canceled") ||
    msg.includes("4001") ||
    (msg.includes("rejected") && msg.includes("user"))
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
  call: ContractCall,
  opts?: { includeChainId?: boolean }
): Record<string, string> {
  const data = isPreservedCalldataCall(call)
    ? call.data
    : withBuilderSuffix(call.data);
  const params: Record<string, string> = {
    from,
    to: call.to,
    data,
  };
  // Mini-app hosts (Warpcast / some Base shells) reject eth_sendTransaction when
  // chainId is present — chain is already set via wallet_switchEthereumChain.
  if (opts?.includeChainId !== false) {
    params.chainId = BASE_CHAIN_HEX;
  }
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
  const msg = errorMessage(err).toLowerCase();
  const code = errorCode(err);
  return (
    code === 4200 ||
    code === -32601 ||
    msg.includes("not supported") ||
    msg.includes("unsupported") ||
    msg.includes("method not found") ||
    msg.includes("unknown method") ||
    msg.includes("invalid method") ||
    msg.includes("does not exist")
  );
}

/** Errors that mean wallet_sendCalls never broadcast a batch — safe to fall back. */
function isClearlyNotSubmitted(err: unknown): boolean {
  if (isSendCallsUnsupported(err)) return true;
  const code = errorCode(err);
  // Generic RPC / host bridge errors (Farcaster maps unknown codes → this message).
  if (
    code === -32603 ||
    code === -32602 ||
    code === -32600 ||
    code === -32000 ||
    code === -32001 ||
    code === -32002 ||
    code === -32003
  ) {
    return true;
  }
  const msg = errorMessage(err).toLowerCase();
  return (
    msg.includes("unknown provider") ||
    msg.includes("provider rpc") ||
    msg.includes("internal json-rpc") ||
    msg.includes("internal error") ||
    msg.includes("wallet confirmation timed out") ||
    msg.includes("did not return a batch id") ||
    msg.includes("provider not") ||
    msg.includes("invalid params") ||
    msg.includes("invalid argument") ||
    msg.includes("execution reverted") ||
    msg.includes("must be connected") ||
    msg.includes("no wallet") ||
    msg.includes("capabilities") ||
    // Paymaster / sponsorship refused before send
    msg.includes("paymaster") ||
    msg.includes("sponsor") ||
    msg.includes("request denied") ||
    msg.includes("not allowlisted")
  );
}

function formatWalletError(err: unknown): string {
  const msg = errorMessage(err).split("\n")[0]!.trim();
  const lower = msg.toLowerCase();
  if (lower.includes("unknown provider") || lower === "unknown provider rpc error") {
    return "Wallet could not send the transaction — reconnect in Farcaster/Base App and try again";
  }
  return msg || "Transaction failed";
}

function extractCallsId(result: unknown): string | null {
  if (typeof result === "string" && result.startsWith("0x")) return result;
  if (result && typeof result === "object" && "id" in result) {
    const id = (result as { id?: string }).id;
    if (id && typeof id === "string") return id;
  }
  return null;
}

function receiptTxHash(receipt: {
  transactionHash?: string;
  transaction_hash?: string;
  hash?: string;
}): string | null {
  for (const key of ["transactionHash", "transaction_hash", "hash"] as const) {
    const v = receipt[key];
    if (typeof v === "string" && isTxHash(v)) return v;
  }
  return null;
}

function isReceiptSuccess(status: string | number | undefined): boolean | null {
  if (status == null) return null;
  if (typeof status === "number") {
    if (status === 1) return true;
    if (status === 0) return false;
    return null;
  }
  const s = String(status).toLowerCase();
  if (s === "0x1" || s === "1" || s === "success" || s === "ok") return true;
  if (s === "0x0" || s === "0" || s === "reverted" || s === "failed") return false;
  return null;
}

/** Best successful (or first available) tx hash from a wallet_getCallsStatus payload. */
function extractTxHashFromStatus(status: CallsStatus): string | null {
  const hashesFromCaps = status.capabilities?.caip345?.transactionHashes ?? [];
  for (const h of hashesFromCaps) {
    if (typeof h === "string" && isTxHash(h)) return h;
  }

  let first: string | null = null;
  for (const receipt of status.receipts ?? []) {
    const hash = receiptTxHash(receipt);
    if (!hash) continue;
    if (!first) first = hash;
    if (isReceiptSuccess(receipt.status) !== false) return hash;
  }
  return first;
}

/**
 * EIP-5792 numeric codes (100/200/400/500/600) plus legacy string / 1–2 enums
 * some wallets still return.
 */
function normalizeCallsStatus(
  status: CallsStatus["status"] | undefined,
  statusCode?: number
): "pending" | "confirmed" | "failed" | "unknown" {
  const raw = status ?? statusCode;
  if (raw == null) return "unknown";

  if (typeof raw === "number") {
    // Legacy pre-EIP formal codes used by some wallets (1=pending, 2=confirmed).
    if (raw === 1) return "pending";
    if (raw === 2) return "confirmed";
    if (raw >= 100 && raw < 200) return "pending";
    if (raw >= 200 && raw < 300) return "confirmed";
    // 4xx offchain / 5xx full / 6xx partial reverts
    if (raw >= 400) return "failed";
    return "unknown";
  }

  const s = String(raw).toUpperCase();
  if (
    s === "PENDING" ||
    s === "100" ||
    s === "1" ||
    s === "LOADING" ||
    s === "EXECUTING"
  ) {
    return "pending";
  }
  if (
    s === "CONFIRMED" ||
    s === "SUCCESS" ||
    s === "COMPLETE" ||
    s === "COMPLETED" ||
    s === "200" ||
    s === "2"
  ) {
    return "confirmed";
  }
  if (
    s === "FAILED" ||
    s === "REVERTED" ||
    s === "ERROR" ||
    s === "400" ||
    s === "500" ||
    s === "600"
  ) {
    return "failed";
  }
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
    try {
      const receipt = await withRpcRetry(() =>
        pub.getTransactionReceipt({ hash: hash as `0x${string}` })
      );
      if (receipt) return;
    } catch {
      /* not mined yet */
    }
    await new Promise((r) => setTimeout(r, 1_500));
  }
  throw new Error(
    "Transaction was not broadcast on Base — reconnect wallet and check BaseScan"
  );
}

/**
 * Confirm a known submitted hash. Once the wallet returned a hash, never
 * re-prompt / re-submit — RPC flakiness must not turn a mined swap into "failed".
 */
async function waitForOnchainHash(
  hash: string,
  opts?: { softOnTimeout?: boolean }
): Promise<string> {
  if (!isTxHash(hash)) {
    throw new Error("Wallet returned an invalid transaction hash");
  }

  const soft = opts?.softOnTimeout === true;
  const pub = createPublicOnlyBaseClient();

  const readReceipt = async () => {
    try {
      return await withRpcRetry(() =>
        pub.getTransactionReceipt({ hash: hash as `0x${string}` })
      );
    } catch {
      return null;
    }
  };

  const early = await readReceipt();
  if (early) {
    if (early.status === "reverted") {
      throw new Error("Transaction reverted on Base");
    }
    return hash;
  }

  try {
    await assertTxVisibleOnBase(hash);
  } catch (e) {
    // Hash may still mine soon (smart-wallet bundler lag). Soft path keeps success UX.
    if (!soft) throw e;
    const late = await readReceipt();
    if (late?.status === "reverted") {
      throw new Error("Transaction reverted on Base");
    }
    if (late?.status === "success") return hash;
    return hash;
  }

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

    const final = await readReceipt();
    if (final?.status === "reverted") {
      throw new Error("Transaction reverted on Base");
    }
    if (final?.status === "success") return hash;

    // Already submitted — do not surface as a hard swap failure for RPC timeouts.
    if (soft) return hash;

    throw new Error(
      msg.includes("Timeout") || msg.toLowerCase().includes("timed out")
        ? "Transaction sent but not confirmed yet — check BaseScan, then retry the next step"
        : msg.split("\n")[0] ||
            "Could not confirm transaction on Base — retry in a moment"
    );
  }
}

async function pollCallsStatus(provider: Eip1193, id: string): Promise<string> {
  const deadline = Date.now() + CALLS_POLL_MS;
  let confirmedWithoutHashMs = 0;
  let lastSeenHash: string | null = null;

  while (Date.now() < deadline) {
    let raw: CallsStatus;
    try {
      raw = (await provider.request({
        method: "wallet_getCallsStatus",
        params: [id],
      })) as CallsStatus;
    } catch {
      await new Promise((r) => setTimeout(r, 1200));
      continue;
    }

    const hash = extractTxHashFromStatus(raw);
    if (hash) lastSeenHash = hash;

    const state = normalizeCallsStatus(raw?.status, raw?.statusCode);

    // Receipts with 0x1 win even if the top-level status field is non-standard.
    if (hash) {
      const anyFail = (raw.receipts ?? []).some(
        (r) => isReceiptSuccess(r.status) === false
      );
      const anyOk = (raw.receipts ?? []).some(
        (r) => isReceiptSuccess(r.status) === true
      );
      if (anyOk && !anyFail) {
        return waitForOnchainHash(hash, { softOnTimeout: true });
      }
      if (state === "confirmed") {
        return waitForOnchainHash(hash, { softOnTimeout: true });
      }
      if (!anyFail && state === "unknown") {
        // Some wallets only populate receipts; treat present hash as success path.
        return waitForOnchainHash(hash, { softOnTimeout: true });
      }
    }

    if (state === "confirmed") {
      if (hash) return waitForOnchainHash(hash, { softOnTimeout: true });
      confirmedWithoutHashMs += 1200;
      if (confirmedWithoutHashMs >= 8_000) {
        if (lastSeenHash) {
          return waitForOnchainHash(lastSeenHash, { softOnTimeout: true });
        }
        throw new Error(
          "Wallet confirmed the batch but returned no transaction hash — reopen wallet and check BaseScan"
        );
      }
    }

    if (state === "failed") {
      // Partial batches can still include a successful swap receipt — prefer that over a hard fail.
      if (lastSeenHash) {
        try {
          return await waitForOnchainHash(lastSeenHash, { softOnTimeout: true });
        } catch {
          /* fall through */
        }
      }
      throw new Error("Sponsored transaction failed onchain");
    }

    await new Promise((r) => setTimeout(r, 1200));
  }

  if (lastSeenHash) {
    return waitForOnchainHash(lastSeenHash, { softOnTimeout: true });
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
  const capabilityVariants: Array<Record<string, unknown>> = [capabilities];
  // Farcaster/Warpcast often reject non-empty capabilities with opaque RPC codes.
  if (Object.keys(capabilities).length > 0) {
    capabilityVariants.push({});
  }

  for (const version of ["1.0", "2.0.0"] as const) {
    for (const caps of capabilityVariants) {
      try {
        const paramsBody: Record<string, unknown> = {
          version,
          chainId: BASE_CHAIN_HEX,
          from,
          calls: callPayload,
        };
        if (Object.keys(caps).length > 0) {
          paramsBody.capabilities = caps;
        }
        // EIP-5792 v2 prefers explicit atomicity; ignore if older hosts reject it.
        if (version === "2.0.0") {
          paramsBody.atomicRequired = calls.length > 1;
        }

        const result = await withTimeout(
          provider.request({
            method: "wallet_sendCalls",
            params: [paramsBody],
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
        if (isUserRejection(e)) throw e;
        // try next capability/version variant
      }
    }
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error(formatWalletError(lastErr) || "wallet_sendCalls failed");
}

async function sendViaEthSendTransaction(
  provider: Eip1193,
  from: string,
  call: ContractCall
): Promise<string> {
  const attempt = async (includeChainId: boolean) => {
    const hash = await withTimeout(
      provider.request({
        method: "eth_sendTransaction",
        params: [buildLegacyTxParams(from, call, { includeChainId })],
      }),
      WALLET_PROMPT_MS,
      "Wallet confirmation"
    );
    if (!hash || typeof hash !== "string") {
      throw new Error("Transaction was not submitted");
    }
    return hash;
  };

  try {
    // Prefer omitting chainId first — Base/Warpcast mini-app providers reject extras.
    return await attempt(false);
  } catch (e) {
    if (isUserRejection(e)) throw e;
    try {
      return await attempt(true);
    } catch (e2) {
      if (isUserRejection(e2)) throw e2;
      const msg = formatWalletError(e2);
      throw new Error(msg);
    }
  }
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
      // Fall through for paymaster failures AND host RPC errors (Warpcast).
      if (!isPaymasterDenied(e) && !isClearlyNotSubmitted(e)) {
        // Unknown post-submit failures should not fall through here — rethrow.
        // isClearlyNotSubmitted covers opaque pre-submit host errors.
        throw e;
      }
    }
  }

  try {
    return await sendViaWalletSendCalls(
      provider,
      from,
      calls,
      getSendCallsCapabilities(skipBuilderCap, { skipPaymaster: true })
    );
  } catch (e) {
    if (isUserRejection(e)) throw e;
    // Last sendCalls try: bare batch with no capabilities.
    if (isClearlyNotSubmitted(e) || isSendCallsUnsupported(e)) {
      return sendViaWalletSendCalls(provider, from, calls, {});
    }
    throw e;
  }
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
      // Batch was likely accepted — do not double-submit via eth_sendTransaction.
      if (!isClearlyNotSubmitted(e) && !isSendCallsUnsupported(e)) {
        throw e;
      }
    }
  }

  const hash = await sendViaEthSendTransaction(provider, from, call);
  return waitForOnchainHash(hash, { softOnTimeout: true });
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

  // Once a path has submitted a tx, never fall through to another send path.
  // Confirmation/RPC failures previously re-prompted and marked successful swaps as failed.
  const confirmSubmitted = (hash: string) =>
    waitForOnchainHash(hash, { softOnTimeout: true });

  // Desktop EOAs: try Multical only if eth_call simulates clean — never open a doomed prompt.
  if (multicallable && !opts.preferSendCalls) {
    let submitted: string | null = null;
    try {
      const bundled = bundleCallsViaMulticall3(group);
      const ok = await simulateContractCall(from, bundled);
      if (ok) {
        submitted = await sendViaEthSendTransaction(provider, from, bundled);
        return await confirmSubmitted(submitted);
      }
    } catch (e) {
      if (isUserRejection(e)) throw e;
      if (submitted) return confirmSubmitted(submitted);
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
      // Do not re-submit: sendCalls may already be mined while status polling failed.
      // Only fall through when the wallet clearly never accepted the batch.
      if (!isSendCallsUnsupported(e) && !isClearlyNotSubmitted(e)) {
        throw e;
      }
    }
  }

  if (multicallable) {
    let submitted: string | null = null;
    try {
      const bundled = bundleCallsViaMulticall3(group);
      const ok = await simulateContractCall(from, bundled);
      if (ok) {
        submitted = await sendViaEthSendTransaction(provider, from, bundled);
        return await confirmSubmitted(submitted);
      }
    } catch (e) {
      if (isUserRejection(e)) throw e;
      if (submitted) return confirmSubmitted(submitted);
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
    } else {
      // Final leg: soft-confirm so a mined swap isn't shown as failed on RPC lag.
      await waitForOnchainHash(lastHash, { softOnTimeout: true });
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
      if (!isSendCallsUnsupported(e) && !isClearlyNotSubmitted(e)) {
        throw e;
      }
    }
  }

  const hash = await sendViaEthSendTransaction(provider, from, workBatch[0]!);
  return waitForOnchainHash(hash, { softOnTimeout: true });
}

/** Sends an app contract call — sponsored via paymaster in Base App / Coinbase Wallet. */
export async function sendAppTransaction(
  connType: ConnectionType,
  from: string,
  call: ContractCall
): Promise<string> {
  return sendAppTransactions(connType, from, [call]);
}
