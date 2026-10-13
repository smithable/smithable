import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generate } from "./generate.js";
import type { Io } from "./io.js";

const URL = "http://localhost:3000";

/** `smithable run [dir]`: regenerates if needed, starts the dev server and opens the app. */
export async function runDev(dir: string, io: Io, open: boolean): Promise<number> {
  const code = await generate(dir, io, {
    tools: !existsSync(join(dir, "node_modules")),
    force: false,
  });
  if (code !== 0) return code;
  const server = spawn("pnpm", ["dev"], { cwd: dir, stdio: "inherit" });
  if (open) void waitThenOpen(io);
  return new Promise((resolve) => server.on("exit", (status) => resolve(status ?? 0)));
}

async function waitThenOpen(io: Io): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      if ((await fetch(`${URL}/health`)).ok) {
        openBrowser(URL);
        io.out(`\n${URL} is ready.\n`);
        return;
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

export function openBrowser(url: string): void {
  const wsl =
    process.platform === "linux" &&
    readFileSync("/proc/version", "utf8").toLowerCase().includes("microsoft");
  const [command, args] =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32" || wsl
        ? ["cmd.exe", ["/c", "start", url]]
        : ["xdg-open", [url]];
  spawn(command, args, { stdio: "ignore", detached: true })
    .on("error", () => {})
    .unref();
}
