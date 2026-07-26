import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { getAddress, isAddress } from "viem";

const ROOT = join(__dirname, "..");
const SKIP = new Set(["node_modules", "forge-std", "public", "out", "cache"]);

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    // Dot-directories are build caches and local scratch, never shipped source.
    if (SKIP.has(entry) || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.(ts|tsx|mjs|js)$/.test(entry)) acc.push(full);
  }
  return acc;
}

/**
 * viem throws `InvalidAddressError` on a mixed-case address whose EIP-55
 * checksum does not verify. Call sites usually swallow that in a `catch` and
 * report "no liquidity", so a single wrong-case character can disable a whole
 * DEX route with no visible error.
 */
describe("hardcoded addresses", () => {
  it("all use a valid EIP-55 checksum", () => {
    const offenders: string[] = [];

    for (const file of sourceFiles(ROOT)) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        for (const match of line.matchAll(/0x[a-fA-F0-9]{40}/g)) {
          const address = match[0];
          const isMixedCase =
            address !== address.toLowerCase() && address !== address.toUpperCase();
          if (!isMixedCase || isAddress(address)) continue;
          offenders.push(
            `${relative(ROOT, file)}:${index + 1} ${address} → ${getAddress(
              address.toLowerCase()
            )}`
          );
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
