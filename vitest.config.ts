import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
    // One timeout for the suite: under load (a gate, main's full run) a test that takes a
    // fraction of a second alone can pass 5 s, and per-file raises only chased the next file
    // (T1481, T1495). A test that is slow alone is still looked at, not covered by this.
    testTimeout: 30_000,
  },
});
