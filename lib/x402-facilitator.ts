import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";

const BUILDER_CODE = process.env.NEXT_PUBLIC_BUILDER_CODE ?? "bc_4uoh9iu2";

function getAlchemyKey(): string {
  const key = process.env.NEXT_PUBLIC_ALCHEMY_KEY ?? "";
  return key.replace(/^["']|["']$/g, "");
}

function getRpcUrl(): string {
  return `https://base-mainnet.g.alchemy.com/v2/${getAlchemyKey()}`;
}

function getBuilderSuffix(): `0x${string}` {
  const cb = new TextEncoder().encode(BUILDER_CODE);
  const hex = Array.from(cb)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}${cb.length.toString(16).padStart(2, "0")}0080218021802180218021802180218021` as `0x${string}`;
}

let _scheme: ExactEvmScheme | null = null;

export function getFacilitatorScheme(): ExactEvmScheme {
  if (_scheme) return _scheme;

  const pk = process.env.X402_FACILITATOR_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error("X402_FACILITATOR_PRIVATE_KEY not set");

  const account = privateKeyToAccount(pk);
  const transport = http(getRpcUrl());
  const publicClient = createPublicClient({ chain: base, transport });
  const walletClient = createWalletClient({ account, chain: base, transport });

  const signer = {
    address: account.address,
    readContract: (args: Parameters<typeof publicClient.readContract>[0]) =>
      publicClient.readContract(args) as Promise<unknown>,
    verifyTypedData: (args: {
      address: `0x${string}`;
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
      signature: `0x${string}`;
    }) =>
      publicClient.verifyTypedData(
        args as Parameters<typeof publicClient.verifyTypedData>[0]
      ),
    writeContract: async (args: {
      address: `0x${string}`;
      abi: readonly unknown[];
      functionName: string;
      args: readonly unknown[];
      gas?: bigint;
      dataSuffix?: `0x${string}`;
    }) =>
      walletClient.writeContract({
        ...(args as Parameters<typeof walletClient.writeContract>[0]),
        dataSuffix: getBuilderSuffix(),
      }),
    sendTransaction: (args: { to: `0x${string}`; data: `0x${string}` }) =>
      walletClient.sendTransaction(args),
    waitForTransactionReceipt: (args: { hash: `0x${string}` }) =>
      publicClient.waitForTransactionReceipt(args) as Promise<{ status: string }>,
    getCode: (args: { address: `0x${string}` }) => publicClient.getCode(args),
  };

  _scheme = new ExactEvmScheme(toFacilitatorEvmSigner(signer));
  return _scheme;
}

export function getFacilitatorAddress(): `0x${string}` {
  const pk = process.env.X402_FACILITATOR_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) return "0x0000000000000000000000000000000000000000";
  return privateKeyToAccount(pk).address;
}

export async function verifyX402Payment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
) {
  const requirements = paymentPayload.accepted ?? paymentRequirements;
  return getFacilitatorScheme().verify(paymentPayload, requirements);
}

export async function settleX402Payment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
) {
  const requirements = paymentPayload.accepted ?? paymentRequirements;
  return getFacilitatorScheme().settle(paymentPayload, requirements);
}
