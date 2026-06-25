import { x402Client, x402HTTPClient } from "@x402/core/client";
import { ExactEvmScheme } from "@x402/evm";

type EIP1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export async function getX402Fetch(provider: EIP1193Provider) {
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  const address = accounts[0] as `0x${string}`;

  // signTypedData must match viem's signature: { domain, types, primaryType, message }
  const signer = {
    address,
    signTypedData: async (msg: {
      domain: Record<string, unknown>;
      types: Record<string, unknown[]>;
      primaryType: string;
      message: Record<string, unknown>;
    }) => {
      return (await provider.request({
        method: "eth_signTypedData_v4",
        params: [address, JSON.stringify(msg)],
      })) as `0x${string}`;
    },
  };

  // Register ExactEvmScheme (same class used client-side with a signer)
  const client = new x402Client().register(
    "eip155:8453",
    new ExactEvmScheme(signer)
  );
  const httpClient = new x402HTTPClient(client);

  return async (url: string, init: RequestInit): Promise<Response> => {
    // Step 1: probe — expect 402
    const probe = await fetch(url, init);
    if (probe.status !== 402) return probe;

    // Step 2: parse payment requirements
    // getPaymentRequiredResponse(headerGetter, body)
    let body: unknown;
    try { body = await probe.json(); } catch { body = {}; }

    const paymentRequired = httpClient.getPaymentRequiredResponse(
      (name: string) => probe.headers.get(name),
      body
    );

    // Step 3: create EIP-3009 signed payment payload — this triggers wallet signature
    const paymentPayload = await client.createPaymentPayload(paymentRequired);

    // Step 4: encode into X-PAYMENT header
    const paymentHeaders = httpClient.encodePaymentSignatureHeader(paymentPayload);

    // Step 5: retry with payment
    return fetch(url, {
      ...init,
      headers: {
        ...(init.headers as Record<string, string> ?? {}),
        ...paymentHeaders,
      },
    });
  };
} 