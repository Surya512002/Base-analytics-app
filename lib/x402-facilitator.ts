import { createWalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import { toFacilitatorEvmSigner } from "@x402/evm";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";

import {
  createBaseHttpTransport,
  createBasePublicClient,
  withRpcRetry,
} from "@/lib/utils/base-rpc";

/** Coinbase Smart Wallet factories — needed for Base App / Farcaster EIP-6492 deploy-before-settle. */
const EIP6492_ALLOWED_FACTORIES: `0x${string}`[] = [
  "0xBA5ED110eFDBa3D005bfC882d75358ACBbB85842",
  "0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a",
];

let _scheme: ExactEvmScheme | null = null;

export function getFacilitatorScheme(): ExactEvmScheme {
  if (_scheme) return _scheme;

  const pk = process.env.X402_FACILITATOR_PRIVATE_KEY as `0x${string}` | undefined;
  if (!pk) throw new Error("X402_FACILITATOR_PRIVATE_KEY not set");

  const account = privateKeyToAccount(pk);
  const transport = createBaseHttpTransport();
  const publicClient = createBasePublicClient();
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
    writeContract: (args: Parameters<typeof walletClient.writeContract>[0]) =>
      walletClient.writeContract(args),
    sendTransaction: (args: Parameters<typeof walletClient.sendTransaction>[0]) =>
      walletClient.sendTransaction(args),
    waitForTransactionReceipt: (args: { hash: `0x${string}` }) =>
      publicClient.waitForTransactionReceipt(args) as Promise<{ status: string }>,
    getCode: (args: { address: `0x${string}` }) => publicClient.getCode(args),
  };

  _scheme = new ExactEvmScheme(toFacilitatorEvmSigner(signer), {
    eip6492AllowedFactories: EIP6492_ALLOWED_FACTORIES,
  });
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
  return withRpcRetry(() =>
    getFacilitatorScheme().verify(paymentPayload, requirements)
  );
}

export async function settleX402Payment(
  paymentPayload: PaymentPayload,
  paymentRequirements: PaymentRequirements
) {
  const requirements = paymentPayload.accepted ?? paymentRequirements;
  return withRpcRetry(() =>
    getFacilitatorScheme().settle(paymentPayload, requirements)
  );
}
