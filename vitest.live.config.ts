import { defineConfig } from "vitest/config";
import path from "node:path";

/** Live tests (real networks, opt-in env vars): `npm run test:live`. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.live.test.ts"],
    exclude: ["node_modules/**", "lib/forge-std/**"],
    testTimeout: 600_000,
    hookTimeout: 600_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
