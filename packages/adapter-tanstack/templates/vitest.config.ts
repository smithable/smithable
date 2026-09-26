import { rmSync } from "node:fs";
import { defineConfig } from "vitest/config";

// Tests use their own database, never the development data, and start from an empty one.
rmSync("data/test", { recursive: true, force: true });

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
    env: { DATA_DIR: "data/test" },
    // The test files share one database, so they run one after another.
    fileParallelism: false,
  },
});
