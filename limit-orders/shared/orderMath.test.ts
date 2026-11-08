import assert from "node:assert/strict";
import {
  parseDecimalInput, parseTriggerPrice, expectedAmountOut, minAmountOut, validateOrder,
  trailingStopPrice, fillFloor, validateTrailing, validateBracket, dcaTotal, validateDca, ORDER_LABEL, ORDER_TYPE_INDEX,
} from "./orderMath";

const S = 18, Q = 6;

// parsing
assert.equal(parseDecimalInput("1.5", 6), 1_500_000n);
assert.equal(parseDecimalInput(".5", 6), 500_000n);
assert.equal(parseDecimalInput("0", 6), null);
assert.equal(parseDecimalInput("", 6), null);
assert.equal(parseDecimalInput("-1", 6), null);
assert.equal(parseDecimalInput("1e5", 6), null);
assert.equal(parseDecimalInput("1.1234567", 6), null); // too many decimals, never round
assert.equal(parseTriggerPrice("123.45"), 12_345_000_000n);

// expected output (matches the contract tests: sell 10 @ $111 = 1110 USDC, buy 900 USDC @ $90 = 10 stock)
assert.equal(expectedAmountOut("LIMIT_SELL", 10n * 10n ** 18n, 111n * 10n ** 8n, S, Q), 1110n * 10n ** 6n);
assert.equal(expectedAmountOut("STOP_LOSS", 10n * 10n ** 18n, 85n * 10n ** 8n, S, Q), 850n * 10n ** 6n);
assert.equal(expectedAmountOut("LIMIT_BUY", 900n * 10n ** 6n, 90n * 10n ** 8n, S, Q), 10n * 10n ** 18n);
assert.equal(expectedAmountOut("LIMIT_BUY", 0n, 90n * 10n ** 8n, S, Q), 0n);

// min out
assert.equal(minAmountOut(1000n, 100), 990n); // 1% slippage
assert.throws(() => minAmountOut(1000n, 10_000));
assert.throws(() => minAmountOut(1000n, -1));

// validation mirrors contract
const base = {
  kind: "STOP_LOSS" as const, amountIn: 10n ** 18n, trigger: 90n * 10n ** 8n, currentPrice: 100n * 10n ** 8n,
  slippageBps: 100, keeperFeeBps: 10, balance: 5n * 10n ** 18n * 10n, maxAmountIn: 1000n * 10n ** 18n,
  expiry: 2_000_000, nowSec: 1_000_000,
};
assert.equal(validateOrder(base), null);
assert.match(validateOrder({ ...base, trigger: 100n * 10n ** 8n })!, /below the current price/);
assert.match(validateOrder({ ...base, kind: "LIMIT_SELL", trigger: 99n * 10n ** 8n })!, /above the current price/);
assert.equal(validateOrder({ ...base, kind: "LIMIT_SELL", trigger: 110n * 10n ** 8n }), null);
assert.match(validateOrder({ ...base, slippageBps: 10 })!, /Slippage/);
assert.match(validateOrder({ ...base, amountIn: 10n ** 30n })!, /balance/);
assert.match(validateOrder({ ...base, expiry: 1_000_000 })!, /future/);
assert.match(validateOrder({ ...base, expiry: 1_000_000 + 91 * 86400 })!, /90 days/);
assert.match(validateOrder({ ...base, amountIn: null })!, /amount/i);
// v2 helpers (values match the contract tests)
assert.equal(trailingStopPrice(120n * 10n ** 8n, 1000), 108n * 10n ** 8n);
assert.equal(trailingStopPrice(100n * 10n ** 8n, 1000), 90n * 10n ** 8n);
assert.equal(fillFloor("STOP_LOSS", 10n * 10n ** 18n, 85n * 10n ** 8n, S, Q, 500), 807_500_000n); // 850 USDC * 95%
assert.equal(fillFloor("LIMIT_BUY", 100n * 10n ** 6n, 100n * 10n ** 8n, S, Q, 500), 95n * 10n ** 16n); // 1 stock * 95%
assert.equal(ORDER_LABEL.LIMIT_SELL, "Take-profit");
assert.equal(ORDER_TYPE_INDEX.TRAILING_STOP, 3);

const sell = { amountIn: 10n ** 18n, slippageBps: 100, keeperFeeBps: 10, balance: 10n ** 20n, maxAmountIn: 10n ** 21n, expiry: 2_000_000, nowSec: 1_000_000 };
assert.equal(validateTrailing({ ...sell, trailBps: 1000 }), null);
assert.match(validateTrailing({ ...sell, trailBps: 49 })!, /0.5% and 50%/);
assert.match(validateTrailing({ ...sell, trailBps: 5001 })!, /0.5% and 50%/);
assert.match(validateTrailing({ ...sell, trailBps: 1000, amountIn: null })!, /amount/i);

const br = { ...sell, takeProfit: 110n * 10n ** 8n, stopLoss: 90n * 10n ** 8n, currentPrice: 100n * 10n ** 8n };
assert.equal(validateBracket(br), null);
assert.match(validateBracket({ ...br, stopLoss: 110n * 10n ** 8n })!, /below take-profit/);
assert.match(validateBracket({ ...br, takeProfit: 95n * 10n ** 8n })!, /above the current price/);
assert.match(validateBracket({ ...br, stopLoss: 105n * 10n ** 8n })!, /below the current price/);
assert.match(validateBracket({ ...br, takeProfit: null })!, /take-profit/i);

assert.equal(dcaTotal(100n * 10n ** 6n, 5), 500n * 10n ** 6n);
const dca = { amountPerBuy: 100n * 10n ** 6n, buys: 5, intervalSec: 3600, maxPrice: null, balance: 10n ** 12n, maxQuoteIn: 10n ** 12n };
assert.equal(validateDca(dca), null);
assert.match(validateDca({ ...dca, buys: 0 })!, /between 1 and 365/);
assert.match(validateDca({ ...dca, buys: 366 })!, /between 1 and 365/);
assert.match(validateDca({ ...dca, intervalSec: 3599 })!, /1 hour/);
assert.match(validateDca({ ...dca, balance: 1n })!, /balance/);
assert.match(validateDca({ ...dca, maxQuoteIn: 1n })!, /limit/);
assert.match(validateDca({ ...dca, amountPerBuy: null })!, /amount/i);
console.log("orderMath: all assertions passed");
