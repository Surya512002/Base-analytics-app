import { describe, expect, it } from "vitest";
import { neynarProxyRequest } from "@/lib/api/neynar-proxy";

const A = "0x00000000000000000000000000000000000a11ce";
const q = (s: string) => new URLSearchParams(s);

describe("neynar proxy", () => {
  it("forwards only the bulk-by-address lookup, rebuilt from validated parts", () => {
    const r = neynarProxyRequest(q(`path=v2/farcaster/user/bulk-by-address&addresses=${A.toUpperCase().replace("0X", "0x")}&extra=1`));
    expect(r).toEqual({ url: `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${A}` });
  });

  it("refuses the path-traversal trick that reached other Neynar endpoints", () => {
    for (const path of ["v2/farcaster/../../admin", "v2/farcaster/%2e%2e/%2e%2e/admin", "v2/farcaster/user/bulk-by-address/../../x", "v2/farcaster/cast", "/v2/farcaster/user/bulk-by-address", ""]) {
      expect(neynarProxyRequest(q(`path=${encodeURIComponent(path)}&addresses=${A}`)), path).toEqual({ error: "Invalid path" });
    }
  });

  it("needs 1 to 25 real addresses", () => {
    const p = "path=v2/farcaster/user/bulk-by-address";
    expect(neynarProxyRequest(q(p))).toHaveProperty("error");
    expect(neynarProxyRequest(q(`${p}&addresses=nope`))).toHaveProperty("error");
    expect(neynarProxyRequest(q(`${p}&addresses=${A},oops`))).toHaveProperty("error");
    const many = Array.from({ length: 26 }, (_, i) => `0x${String(i + 1).padStart(40, "0")}`).join(",");
    expect(neynarProxyRequest(q(`${p}&addresses=${many}`))).toHaveProperty("error");
    expect(neynarProxyRequest(q(`${p}&addresses=${A},0x${"2".repeat(40)}`))).toHaveProperty("url");
  });
});
