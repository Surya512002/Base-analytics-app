/**
 * Error decoding and mapping for LimitOrderBook and wallet interactions.
 * Translates custom Solidity reverts and RPC errors into plain language.
 */

export const ERROR_MESSAGES: Record<string, string> = {
  MarketDisabled: "This stock isn't available for orders yet.",
  AlreadyTriggered: "Your trigger price is already met. Choose a price further from the current price.",
  InvalidBracket: "Take-profit must be above stop-loss.",
  AmountTooLarge: "That's above the beta limit.",
  InvalidExpiry: "Choose an expiry between now and 90 days.",
  InvalidParams: "Check the amounts and settings and try again.",
  EnforcedPause: "Orders are paused right now. You can still cancel and withdraw.",
  StalePrice: "The price feed isn't updating (the market may be closed).",
  NotTriggered: "The trigger price hasn't been reached yet.",
  Slippage: "The pool price was worse than your minimum. The order stays open.",
  FillBelowOracleBound: "The pool price was too far from the market price, so the fill was blocked to protect you. The order stays open.",
  NotOpen: "This order can't be changed right now.",
  NotOwner: "This order can't be changed right now.",
  NotExpired: "This order can't be changed right now.",
  OrderHasExpired: "This order can't be changed right now.",
  NotTrailing: "Nothing to update.",
  NoTrailUpdate: "Nothing to update.",
  TooEarly: "The next buy isn't due yet.",
  PriceAboveCeiling: "The price is above your ceiling, so this buy is skipped.",
  FeeTooHigh: "Keeper fee exceeds maximum permitted.",
  BadPrice: "Oracle price is invalid.",
  FeeOnTransferUnsupported: "Tokens with transfer fees are not supported.",
  OnlyOrderBook: "Only the order book contract can call the adapter.",
  NoPool: "No liquidity pool found for this stock.",
  OwnableUnauthorizedAccount: "Only the contract owner can perform this action.",
  SafeERC20FailedOperation: "Token transfer failed. Check token balance and allowance.",
  ERC20InsufficientBalance: "Insufficient token balance for this transaction.",
  ERC20InsufficientAllowance: "Token allowance is insufficient. Please approve the token first.",
};

const KNOWN_ERROR_NAMES = Object.keys(ERROR_MESSAGES);

/**
 * Maps any transaction error, contract revert, or wallet rejection into a clear user-facing message.
 */
export function mapOrderError(error: unknown): string {
  if (!error) return "Something went wrong. Nothing was charged except network fees.";

  const errStr = (error instanceof Error ? error.message : String(error)).toLowerCase();

  // 1. User rejection
  if (
    errStr.includes("user rejected") ||
    errStr.includes("user denied") ||
    errStr.includes("rejected the request") ||
    errStr.includes("action_rejected") ||
    errStr.includes("4001")
  ) {
    return "You cancelled the transaction in your wallet.";
  }

  // 2. Check for viem ContractFunctionRevertedError with errorName
  const maybeRevert = error as { data?: { errorName?: string }; errorName?: string };
  const errorName = maybeRevert?.errorName || maybeRevert?.data?.errorName;
  if (errorName && ERROR_MESSAGES[errorName]) {
    return ERROR_MESSAGES[errorName];
  }

  // 3. Scan the error string for contract custom error names
  for (const name of KNOWN_ERROR_NAMES) {
    // Regex matches the error name as a distinct identifier or word
    const regex = new RegExp(`\\b${name}\\b`, "i");
    if (regex.test(errStr)) {
      return ERROR_MESSAGES[name];
    }
  }

  // 4. Insufficient allowance / funds
  if (errStr.includes("insufficient funds") || errStr.includes("exceeds balance")) {
    return "Insufficient token balance for this transaction.";
  }

  // 5. Fallback message specified by instructions
  return "Something went wrong. Nothing was charged except network fees.";
}
