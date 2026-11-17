import { createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";

import { getBuilderDataSuffix } from "@/lib/utils/tx";
import {
  createBaseHttpTransport,
  createBasePublicClient,
  withRpcRetry,
} from "@/lib/utils/base-rpc";
import { x402PolicyViolation, X402_NETWORK } from "@/lib/x402-policy";

let _scheme: ExactEvmScheme | null = null;

export function getFacilitatorScheme(): ExactEvmScheme {
  if (_scheme) return _scheme;

  const pk = process.env.X402_FACILITATOR_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error("X402_FACILITATOR_PRIVATE_KEY not set");

  const account = privateKeyToAccount(pk);
  const transport = createBaseHttpTransport();
  const publicClient = createBasePublicClient();
  const walletClient = createWalletClient({ account, chain: base, transport });
  const builderSuffix = getBuilderDataSuffix();

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
        dataSuffix: builderSuffix,
      }),
    sendTransaction: (args: { to: `0x${string}`; data: `0x${string}` }) =>
      walletClient.sendTransaction({ ...args, dataSuffix: builderSuffix }),
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
  const requirements = paymentPayload?.accepted ?? paymentRequirements;
  const refused = x402PolicyViolation(requirements) ?? (paymentRequirements && paymentPayload?.accepted ? x402PolicyViolation(paymentRequirements) : null);
  if (refused) return { isValid: false, invalidReason: refused };
  return withRpcRetry(() =>
    getFacilitatorScheme().verify(paymentPayload, requirements)
  );
}

export async function settleX402Payment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
) {
  const requirements = paymentPayload?.accepted ?? paymentRequirements;
  // Never spend the hot wallet's gas on a payment that isn't to us (see lib/x402-policy.ts).
  const refused = x402PolicyViolation(requirements) ?? (paymentRequirements && paymentPayload?.accepted ? x402PolicyViolation(paymentRequirements) : null);
  if (refused) return { success: false, errorReason: refused, transaction: "", network: X402_NETWORK };
  return withRpcRetry(() =>
    getFacilitatorScheme().settle(paymentPayload, requirements)
  );
}
