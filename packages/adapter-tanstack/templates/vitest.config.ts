import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  // Tests use their own database, never the development data.
  test: { include: ["src/**/*.test.ts"], passWithNoTests: true, env: { DATA_DIR: "data/test" } },
});
