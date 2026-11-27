/**
 * Browser wallets (MetaMask, Rabby…) sign one call at a time, so a router swap batch
 * [approve, swap, fee transfer(s)] means 3–5 separate prompts. If the swap reverts after the
 * approval is mined, the approval stays behind.
 *
 * This wraps such a batch into one Beefy Zap Router order (the same audited router the
 * vault zaps use): at most one exact approval to its TokenManager, then a single atomic
 * transaction that runs the swap (or a basket's several swaps) and the fee transfers. Each
 * swap's own minimum output and recipient (the user) are unchanged; unspent input comes back.
 *
 * Deliberately narrow: only plain ERC-20 approve / transfer, native transfers and calls to
 * contracts the batch approved (the swap router) are accepted. Anything else returns null and
 * the caller sends the batch as before.
 */
import { decodeFunctionData, erc20Abi, type Address } from "viem";
import { encodeContractCall, stripBuilderSuffix, isPreservedCalldataCall, type ContractCall } from "@/lib/utils/tx";
import { BEEFY_TOKEN_MANAGER, BEEFY_ZAP_ROUTER, ZAP_ROUTER_ABI, zapRouterAvailable, type ZapStep } from "@/lib/lending/zap/zap-router";
import type { ZapClient } from "@/lib/lending/zap/clm-zap";

const NATIVE = "0x0000000000000000000000000000000000000000" as Address;
const lc = (a: string) => a.toLowerCase();

type Decoded =
  | { kind: "approve"; token: Address; spender: Address; amount: bigint }
  | { kind: "transfer"; token: Address; to: Address; amount: bigint }
  | { kind: "native"; to: Address; value: bigint }
  | { kind: "call"; to: Address; value: bigint; data: `0x${string}` };

function decode(call: ContractCall): Decoded {
  const data = stripBuilderSuffix(call.data);
  const value = call.value ?? BigInt(0);
  if (data === "0x") return { kind: "native", to: call.to, value };
  if (value === BigInt(0)) {
    try {
      const d = decodeFunctionData({ abi: erc20Abi, data });
      if (d.functionName === "approve") return { kind: "approve", token: call.to, spender: d.args[0], amount: d.args[1] };
      if (d.functionName === "transfer") return { kind: "transfer", token: call.to, to: d.args[0], amount: d.args[1] };
    } catch {
      /* not an ERC-20 call */
    }
  }
  return { kind: "call", to: call.to, value, data };
}

export type ZapWrapResult = { calls: ContractCall[]; inputs: Array<{ token: Address; amount: bigint }> };

/** Build the router order for a batch, or null when it can't (or shouldn't) be wrapped. */
export function buildSwapZapOrder(user: Address, batch: ContractCall[]): { route: ZapStep[]; inputs: Array<{ token: Address; amount: bigint }> } | null {
  if (batch.length < 2 || batch.some(isPreservedCalldataCall)) return null;
  const decoded = batch.map(decode);
  const approvals = new Map<string, { token: Address; amount: bigint }>(); // spender → approval
  const inputs = new Map<string, { token: Address; amount: bigint }>();
  const addInput = (token: Address, amount: bigint) => {
    const k = lc(token);
    inputs.set(k, { token, amount: (inputs.get(k)?.amount ?? BigInt(0)) + amount });
  };
  for (const d of decoded) {
    if (d.kind !== "approve") continue;
    if (approvals.has(lc(d.spender))) return null; // one approval per spender keeps it unambiguous
    approvals.set(lc(d.spender), { token: d.token, amount: d.amount });
  }
  const route: ZapStep[] = [];
  let calls = 0;
  for (const d of decoded) {
    if (d.kind === "approve") continue;
    if (d.kind === "transfer") {
      route.push({ target: d.token, value: BigInt(0), data: encodeContractCall(d.token, erc20Abi, "transfer", [d.to, d.amount]).data, tokens: [] });
      addInput(d.token, d.amount);
    } else if (d.kind === "native") {
      route.push({ target: d.to, value: d.value, data: "0x", tokens: [] });
      addInput(NATIVE, d.value);
    } else {
      // Only a contract the batch approved (a swap router), or a native-value swap.
      const approved = approvals.get(lc(d.to));
      if (!approved && d.value === BigInt(0)) return null;
      calls++;
      route.push({ target: d.to, value: d.value, data: d.data, tokens: approved ? [{ token: approved.token, index: -1 }] : [] });
      if (d.value > BigInt(0)) addInput(NATIVE, d.value);
    }
  }
  if (calls < 1) return null;
  // Each approval is pulled from the user once, however many swaps share that router.
  for (const [spender, a] of approvals) {
    if (decoded.some((d) => d.kind === "call" && lc(d.to) === spender)) addInput(a.token, a.amount);
  }
  // Route steps carry no builder suffix (the user's own call to the router does).
  for (const s of route) s.data = stripBuilderSuffix(s.data);
  void user;
  return { route, inputs: [...inputs.values()] };
}

/**
 * Wrap a swap batch for a browser wallet: [approve(TokenManager) if needed, executeOrder].
 * Returns null when the batch doesn't qualify or the router is unavailable.
 */
export async function wrapSwapBatchForBrowserWallet(client: ZapClient, user: Address, batch: ContractCall[]): Promise<ZapWrapResult | null> {
  const built = buildSwapZapOrder(user, batch);
  if (!built) return null;
  if (!(await zapRouterAvailable(client))) return null;
  const erc20Inputs = built.inputs.filter((i) => lc(i.token) !== lc(NATIVE));
  if (erc20Inputs.length > 1) return null;
  const nativeValue = built.inputs.find((i) => lc(i.token) === lc(NATIVE))?.amount ?? BigInt(0);
  const calls: ContractCall[] = [];
  for (const i of erc20Inputs) {
    const allowance = (await client.readContract({ address: i.token, abi: erc20Abi, functionName: "allowance", args: [user, BEEFY_TOKEN_MANAGER] })) as bigint;
    if (allowance < i.amount) calls.push(encodeContractCall(i.token, erc20Abi, "approve", [BEEFY_TOKEN_MANAGER, i.amount]));
  }
  calls.push(
    encodeContractCall(
      BEEFY_ZAP_ROUTER,
      ZAP_ROUTER_ABI as never,
      "executeOrder",
      [
        {
          inputs: built.inputs,
          // Unspent input (if any) comes straight back; the swap pays the user directly.
          outputs: built.inputs.map((i) => ({ token: i.token, minOutputAmount: BigInt(0) })),
          relay: { target: NATIVE, value: BigInt(0), data: "0x" },
          user,
          recipient: user,
        },
        built.route,
      ],
      nativeValue > BigInt(0) ? nativeValue : undefined
    )
  );
  return { calls, inputs: built.inputs };
}
