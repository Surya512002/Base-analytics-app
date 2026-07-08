/** Map x402 facilitator error codes to short user-facing copy. */
export function formatX402PaymentError(
  code?: string,
  detail?: string
): string {
  const map: Record<string, string> = {
    invalid_exact_evm_insufficient_balance:
      "Not enough USDC on Base — add at least the payment amount",
    invalid_exact_evm_transaction_failed:
      "USDC transfer failed on-chain — check USDC balance and retry",
    invalid_exact_evm_nonce_already_used:
      "Payment already used — refresh and try again",
    invalid_exact_evm_payload_authorization_valid_before:
      "Payment authorization expired — try again",
    invalid_exact_evm_signature: "Wallet signature invalid — reconnect and retry",
    eip6492_factory_not_allowed:
      "Smart wallet not supported for x402 yet — try MetaMask or Rabby",
    invalid_exact_evm_transaction_simulation_failed:
      "Could not simulate payment — check USDC balance on Base",
  };
  if (code && map[code]) return map[code];
  if (code && detail) return `${code}: ${detail}`;
  return code || detail || "Payment failed";
}
