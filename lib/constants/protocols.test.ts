import { describe, expect, it } from "vitest";
import {
  BRIDGE_CONTRACTS,
  DEFI_PROTOCOLS,
  DEX_ROUTERS,
  PROTOCOL_NAMES,
} from "@/lib/constants/protocols";

const ALL = [
  ...DEX_ROUTERS,
  ...BRIDGE_CONTRACTS,
  ...DEFI_PROTOCOLS,
  ...Object.keys(PROTOCOL_NAMES),
];

/**
 * These lists are matched against transfer counterparties with `Set.has`, so a
 * typo produces silently wrong analytics instead of an error. Truncated or
 * over-long addresses were a real source of that, hence the strict length check.
 */
describe("protocol address registry", () => {
  it("only contains well-formed 20-byte addresses", () => {
    const malformed = ALL.filter((a) => !/^0x[0-9a-f]{40}$/.test(a));
    expect(malformed).toEqual([]);
  });

  it("is lowercase so Set lookups match normalised input", () => {
    expect(ALL.filter((a) => a !== a.toLowerCase())).toEqual([]);
  });

  it("names every routed protocol", () => {
    const unnamed = [...DEX_ROUTERS].filter((a) => !PROTOCOL_NAMES[a]);
    expect(unnamed).toEqual([]);
  });
});
