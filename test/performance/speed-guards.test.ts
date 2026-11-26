import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { discoverGeckoTrendingBase } from "@/lib/launchpad/gecko-discovery";
import { tokenLogoUrl } from "@/lib/launchpad/token-logo";
import { loadTokenCatalog, peekTokenCatalog } from "@/lib/swap/load-token-catalog";

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sources(p);
    return /\.tsx?$/.test(e.name) && !/\.test\./.test(e.name) ? [p] : [];
  });
}

describe("speed guards", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("only server code imports the 750 KB token catalog directly", () => {
    const server = ["lib/portfolio/indexer.ts", "app/api/token-logo/[address]/route.ts"];
    const importers = ["app", "components", "hooks", "lib", "src"]
      .flatMap(sources)
      .filter((f) => /(from\s+|^import\s+)["'][^"']*(\/token-catalog|verified-base-tokens\.json)["']/m.test(readFileSync(f, "utf8")))
      .map((f) => f.split(path.sep).join("/"))
      .filter((f) => f !== "lib/swap/token-catalog.ts");
    expect(importers.sort()).toEqual(server.sort());
  });

  it("loads the catalog on demand and keeps it", async () => {
    const catalog = await loadTokenCatalog();
    expect(catalog.findVerifiedToken("CLANKER")?.address).toBeTruthy();
    expect(peekTokenCatalog()).toBe(catalog);
  });

  it("logo URLs: a known catalog logo wins over the server proxy", () => {
    const unknown = "0x1234567890123456789012345678901234567890";
    expect(tokenLogoUrl(unknown)).toBe(`/api/token-logo/${unknown}`);
    expect(tokenLogoUrl(unknown, undefined, "https://example.com/a.png")).toBe("https://example.com/a.png");
  });

  it("overlapping GeckoTerminal lookups share requests, later ones fetch again", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [], included: [] })));
    vi.stubGlobal("fetch", fetchMock);
    await Promise.all([discoverGeckoTrendingBase(), discoverGeckoTrendingBase()]);
    const once = fetchMock.mock.calls.length;
    expect(once).toBe(5); // 2 trending pages + 3 volume pages
    await discoverGeckoTrendingBase();
    expect(fetchMock.mock.calls.length).toBe(once * 2);
  });
});
