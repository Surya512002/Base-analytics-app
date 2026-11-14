/**
 * Guard: every transaction the app sends carries the Base builder code (ERC-8021 suffix).
 * Fails if a new code path sends transactions outside the central sender, or if any batch
 * could leave without attribution.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  buildB20Call,
  buildContractCall,
  buildExternalSwapCall,
  finalizeAppTransactionBatch,
  hasBuilderSuffix,
  isPreservedCalldataCall,
  ZEROX_ALLOWANCE_HOLDER,
} from "@/lib/utils/tx";
import { getSendCallsCapabilities } from "@/lib/utils/paymaster";
import { B20_FACTORY_ADDRESS } from "@/lib/b20/constants";
import { BUILDER_CODE } from "@/lib/constants/env";

const ROOT = path.resolve(__dirname, "../..");
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const SOME_AGGREGATOR = "0x1111111254EEB25477B68fb85Ed929f73A960582" as const;

describe("builder code on every transaction", () => {
  it("uses the app's builder code", () => {
    expect(BUILDER_CODE).toMatch(/^bc_[a-z0-9]+$/);
  });

  it("every normal call in a batch carries the suffix", () => {
    const batch = finalizeAppTransactionBatch([
      { to: USDC, data: "0x095ea7b3" + "00".repeat(64) } as never, // raw approve without suffix
      buildContractCall(USDC, "0xa9059cbb" + "00".repeat(64) as `0x${string}`),
      { to: USDC, data: "0x", value: 1n }, // plain ETH transfer
    ]);
    for (const call of batch) expect(hasBuilderSuffix(call.data)).toBe(true);
  });

  it("0x AllowanceHolder swaps carry the suffix", () => {
    const swap = buildExternalSwapCall(ZEROX_ALLOWANCE_HOLDER, "0x2213bc0b" as `0x${string}`, 0n);
    expect(isPreservedCalldataCall(swap)).toBe(false);
    expect(hasBuilderSuffix(swap.data)).toBe(true);
  });

  it("a batch whose calls must be sent byte-for-byte still gets an attributed call", () => {
    const batch = finalizeAppTransactionBatch([buildExternalSwapCall(SOME_AGGREGATOR, "0x12345678" as `0x${string}`)]);
    expect(batch.some((c) => hasBuilderSuffix(c.data))).toBe(true);
    expect(batch[0].data).toBe("0x12345678"); // the quoted call itself is untouched
  });

  it("B20 launches (factory rejects suffixes) get the attribution companion", () => {
    const batch = finalizeAppTransactionBatch([buildB20Call(B20_FACTORY_ADDRESS as `0x${string}`, "0xabcdef01" as `0x${string}`)]);
    expect(batch.some((c) => hasBuilderSuffix(c.data))).toBe(true);
  });

  it("wallet_sendCalls always asks the wallet to append the builder code", () => {
    for (const skip of [false, true]) {
      for (const skipPaymaster of [false, true]) {
        const caps = getSendCallsCapabilities(skip, { skipPaymaster }) as { dataSuffix?: { value: string } };
        expect(caps.dataSuffix?.value.toLowerCase()).toContain(Buffer.from(BUILDER_CODE).toString("hex"));
      }
    }
  });

  it("nothing sends transactions outside the central sender (or without dataSuffix)", () => {
    const SEND = /eth_sendTransaction|wallet_sendCalls|\.writeContract\(|\.sendTransaction\(|useWriteContract|useSendTransaction|useSendCalls|sendCallsAsync|deployContract\(/;
    // Allowed senders, each of which must attach the builder code.
    const ALLOWED: Record<string, RegExp> = {
      "lib/utils/send-app-tx.ts": /finalizeAppTransactionBatch/,
      "lib/predictions/keeper.ts": /dataSuffix:\s*getBuilderDataSuffix\(\)/,
      "lib/x402-facilitator.ts": /dataSuffix/,
    };
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (/node_modules|\.next|forge-std/.test(full)) continue;
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
          const rel = path.relative(ROOT, full).split(path.sep).join("/");
          const src = readFileSync(full, "utf8")
            .split("\n")
            .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
            .join("\n");
          if (!SEND.test(src)) continue;
          if (ALLOWED[rel]) {
            if (!ALLOWED[rel].test(src)) offenders.push(`${rel} (sender without builder code)`);
          } else if (rel !== "lib/utils/tx.ts" && rel !== "lib/utils/paymaster.ts") {
            offenders.push(rel);
          }
        }
      }
    };
    for (const d of ["app", "components", "hooks", "lib", "src"]) walk(path.join(ROOT, d));
    expect(offenders).toEqual([]);
  });
});
