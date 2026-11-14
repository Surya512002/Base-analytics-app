import { defineConfig } from "vitest/config";
import path from "node:path";

/** Network tests against real Base mainnet (read-only). Run with `npm run test:fork`. */
export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 60_000,
    include: ["test/fork/**/*.test.ts"],
    // One file at a time: the public Base RPC rate-limits bursts (HTTP 429).
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
