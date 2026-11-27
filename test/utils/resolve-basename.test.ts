import { afterEach, describe, expect, it, vi } from "vitest";

const readContract = vi.fn();
vi.mock("@/lib/utils/base-rpc", () => ({
  createBasePublicClient: () => ({ readContract }),
  withRpcRetry: (run: () => Promise<unknown>) => run(),
}));

const WALLET = "0x1111111111111111111111111111111111111111";
const NODE = `0x${"ab".repeat(32)}`;

describe("wallet names", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the primary name the owner set on-chain", async () => {
    readContract.mockResolvedValueOnce(NODE).mockResolvedValueOnce("jesse.base.eth");
    const { resolveBasenameClient } = await import("@/lib/utils/resolve-basename");
    expect(await resolveBasenameClient(WALLET)).toBe("jesse.base.eth");
  });

  it("shows no name otherwise, and asks no outside service", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const { resolveBasename, resolveBasenameClient } = await import("@/lib/utils/resolve-basename");
    // The server (gift claim pages, profiles) and the browser follow the same rule.
    for (const lookup of [resolveBasename, resolveBasenameClient]) {
      readContract.mockResolvedValueOnce(NODE).mockResolvedValueOnce("");
      expect(await lookup(WALLET)).toBeNull();
      readContract.mockRejectedValueOnce(new Error("rpc down"));
      expect(await lookup(WALLET)).toBeNull();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
