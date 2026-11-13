import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { generate } from "./generate.js";
import type { Io } from "./io.js";

const URL = "http://localhost:3000";

/**
 * The app's development server's environment, a little lighter (T736: about 70 MB resident and
 * 200 MB at its peak less, measured on the crm starter): two threads for libuv's pool, and a
 * small young generation for V8. A value the person set themselves is kept as it is.
 */
export function devServerEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const options = env.NODE_OPTIONS ?? "";
  return {
    ...env,
    UV_THREADPOOL_SIZE: env.UV_THREADPOOL_SIZE ?? "2",
    NODE_OPTIONS: /--max-semi-space-size/.test(options)
      ? options
      : `${options} --max-semi-space-size=2`.trim(),
  };
}

/** `smithable run [dir]`: regenerates if needed, starts the dev server and opens the app. */
export async function runDev(dir: string, io: Io, open: boolean): Promise<number> {
  const code = await generate(dir, io, {
    tools: !existsSync(join(dir, "node_modules")),
    force: false,
  });
  if (code !== 0) return code;
  const server = spawn("pnpm", ["dev"], {
    cwd: dir,
    stdio: "inherit",
    env: devServerEnv(process.env),
  });
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
