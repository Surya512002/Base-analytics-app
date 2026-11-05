import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 25_000,
    hookTimeout: 25_000,
    include: ["lib/**/*.test.ts", "test/**/*.test.ts"],
    exclude: ["node_modules", "lib/forge-std", "scratch", "test/fork/**", "**/*.live.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
