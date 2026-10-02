import { rmSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// The smoke tests run the app on port 3100 (or SMOKE_PORT) with their own, empty database.
rmSync("data/smoke", { recursive: true, force: true });
const port = Number(process.env.SMOKE_PORT ?? 3100);

export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  workers: 1,
  // A page's first visit compiles it; on a busy machine that alone can take half a minute.
  timeout: 60_000,
  reporter: "list",
  use: { baseURL: `http://localhost:${port}` },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Vite itself, not through pnpm, so it stops when the tests end.
    command: `vite dev --port ${port} --strictPort`,
    url: `http://localhost:${port}/health`,
    env: { DATA_DIR: "data/smoke" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
