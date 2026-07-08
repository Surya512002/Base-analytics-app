/** MetaMask extension bug when fee fiat math uses floats with >15 significant digits. */
export function isMetaMaskFeeDisplayError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("bignumber error") ||
    msg.includes("15 significant digits") ||
    msg.includes("significant digits")
  );
}

export const METAMASK_FEE_DISPLAY_HINT =
  "MetaMask fee display glitch — confirm in the wallet popup, or refresh once and retry.";
