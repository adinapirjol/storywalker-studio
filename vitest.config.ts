import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    maxWorkers: 2,
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage/javascript",
      include: ["lib/**/*.ts", "app/**/*.ts", "app/**/*.tsx", "components/**/*.ts", "components/**/*.tsx"],
      exclude: ["**/*.test.ts", "**/*.d.ts", "**/*-contract.ts"],
      reporter: ["text-summary", "json-summary", "cobertura"],
      thresholds: { lines: 50 },
    },
    include: ["lib/**/*.test.ts", "scripts/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname,
    },
  },
});
