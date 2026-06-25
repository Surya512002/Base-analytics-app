import { x402Client, x402HTTPClient } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm";
import { createWalletClient, custom } from "viem";
import { base } from "viem/chains";

type EIP1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export async function getX402Fetch(provider: EIP1193Provider) {
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const address = accounts[0] as `0x${string}`;

  const walletClient = createWalletClient({
    chain: base,
    transport: custom(provider),
  });

  const signer = {
    address,
    signTypedData: (msg: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    }) =>
      walletClient.signTypedData({
        account: address,
        domain: msg.domain,
        types: msg.types,
        primaryType: msg.primaryType,
        message: msg.message,
      } as Parameters<typeof walletClient.signTypedData>[0]),
  };

  const client = new x402Client().register(
    "eip155:8453",
    new ExactEvmScheme(signer)
  );
  const httpClient = new x402HTTPClient(client);

  return async (url: string, init: RequestInit): Promise<Response> => {
    const probe = await fetch(url, init);
    if (probe.status !== 402) return probe;

    let body: unknown;
    try {
      body = await probe.json();
    } catch {
      body = {};
    }

    const paymentRequired = httpClient.getPaymentRequiredResponse(
      (name: string) => probe.headers.get(name),
      body
    );

    const paymentPayload = await client.createPaymentPayload(paymentRequired);
    const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

    return fetch(url, {
      ...init,
      headers: {
        ...((init.headers as Record<string, string>) ?? {}),
        ...paymentHeaders,
      },
    });
  };
}
