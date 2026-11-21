import { describe, expect, it } from "vitest";
import { feeAmountError, receiptError, tokenCreatorError } from "@/lib/launchpad/fee-verify";

const TRADER = "0x00000000000000000000000000000000000a11ce";
const TOKEN = "0x2222222222222222222222222222222222222222";
const CREATOR = "0x00000000000000000000000000000000c0ffee00";
const topicOf = (a: string) => `0x${a.replace("0x", "").padStart(64, "0")}`;

describe("fee event checks", () => {
  it("only credits the creator the launch registry names for that token", () => {
    const registry = [{ address: TOKEN.toUpperCase().replace("0X", "0x"), creator: CREATOR }];
    expect(tokenCreatorError(registry, TOKEN, CREATOR)).toBeNull();
    expect(tokenCreatorError(registry, TOKEN, "0x0000000000000000000000000000000000000bad")).toMatch(/Creator/);
    expect(tokenCreatorError(registry, "0x3333333333333333333333333333333333333333", CREATOR)).toMatch(/Unknown/);
  });

  it("bounds the fee amount and refuses zero or negative", () => {
    expect(feeAmountError("eth", BigInt(1_000_000_000_000_000))).toBeNull();
    expect(feeAmountError("eth", BigInt(0))).toMatch(/above zero/);
    expect(feeAmountError("eth", BigInt("3000000000000000000"))).toMatch(/maximum/);
    expect(feeAmountError("usdc", BigInt(60_000_000_000))).toMatch(/maximum/);
    expect(feeAmountError("usdc", BigInt(2_500_000))).toBeNull();
    expect(feeAmountError("token", BigInt("99999999999999999999999"))).toBeNull(); // unknown decimals: no cap
  });

  it("accepts a successful transaction the trader sent, or that names them in a log (smart wallet)", () => {
    expect(receiptError({ status: "success", from: TRADER, logs: [] }, TRADER, TOKEN)).toBeNull();
    const viaBundler = { status: "success", from: "0x0000000000000000000000000000000000b00b00", logs: [{ address: "0x4444444444444444444444444444444444444444", topics: ["0xabc", topicOf(TRADER)] }] };
    expect(receiptError(viaBundler, TRADER, TOKEN)).toBeNull();
    const tokenTouched = { status: "success", from: "0x0000000000000000000000000000000000b00b00", logs: [{ address: TOKEN, topics: ["0xabc"] }] };
    expect(receiptError(tokenTouched, TRADER, TOKEN)).toBeNull();
  });

  it("refuses failed transactions and ones that have nothing to do with the trader", () => {
    expect(receiptError({ status: "reverted", from: TRADER, logs: [] }, TRADER, TOKEN)).toMatch(/failed/);
    const stranger = { status: "success", from: "0x0000000000000000000000000000000000b00b00", logs: [{ address: "0x4444444444444444444444444444444444444444", topics: ["0xabc", topicOf(CREATOR)] }] };
    expect(receiptError(stranger, TRADER, TOKEN)).toMatch(/doesn't involve/);
  });
});
