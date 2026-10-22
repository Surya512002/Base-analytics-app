/**
 * Web/Next.js stub for optional Solana x402 SVM module.
 *
 * @coinbase/cdp-sdk dynamically references '@x402/svm/exact/client' when initializing
 * multi-chain payment signers. Since this application operates solely on Base (EVM),
 * this stub satisfies Turbopack/Webpack module resolution without pulling unneeded
 * Solana runtime dependencies or triggering 'module not found' build errors.
 */

export const toClientExactSvmScheme = () => ({});
export const registerExactSvmScheme = () => ({});
export const cdpSolanaAccountToSvmSigner = () => ({});

const empty = {
  toClientExactSvmScheme,
  registerExactSvmScheme,
  cdpSolanaAccountToSvmSigner,
};

export default empty;
