import { defineConfig } from "vitest/config";
import path from "node:path";

/** Network tests against real Base mainnet (read-only). Run with `npm run test:fork`. */
export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 60_000,
    include: ["test/fork/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
