import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, parseAbi, type TransactionReceipt } from "viem";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";
import { launchReceiptError } from "@/lib/b20/launch-receipt";

const TOKEN = "0x2222222222222222222222222222222222222222";
const CREATOR = "0x00000000000000000000000000000000c0ffee00";
const abi = parseAbi(["event B20Created(address indexed token, uint8 indexed variant, string name, string symbol, uint8 decimals, bytes variantEventParams)"]);

function receipt(over: Partial<TransactionReceipt> = {}, token = TOKEN): TransactionReceipt {
  const topics = encodeEventTopics({ abi, eventName: "B20Created", args: { token: token as `0x${string}`, variant: 0 } });
  const data = encodeAbiParameters([{ type: "string" }, { type: "string" }, { type: "uint8" }, { type: "bytes" }], ["T", "T", 18, "0x"]);
  return { status: "success", from: CREATOR, logs: [{ address: B20_FACTORY_ADDRESS, topics, data }], ...over } as unknown as TransactionReceipt;
}

describe("launchReceiptError", () => {
  it("accepts the creator's own successful launch of this token", () => {
    expect(launchReceiptError(receipt(), TOKEN, CREATOR)).toBeNull();
  });
  it("refuses a different token, a failed tx and another wallet's launch", () => {
    expect(launchReceiptError(receipt({}, "0x3333333333333333333333333333333333333333"), TOKEN, CREATOR)).toMatch(/did not launch/);
    expect(launchReceiptError(receipt({ status: "reverted" }), TOKEN, CREATOR)).toMatch(/failed/);
    expect(launchReceiptError(receipt({ from: "0x0000000000000000000000000000000000000bad" }), TOKEN, CREATOR)).toMatch(/not sent/);
  });
});
