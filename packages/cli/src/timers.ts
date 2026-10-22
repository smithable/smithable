import { timerText } from "@smithable/core";
import { exec, type Io } from "./io.js";
import { loadSpec } from "./validate.js";

/**
 * `smithable timers`: the app's timers, each in its sentence (docs/design/timed-actions.md §5).
 * `smithable timers run <name> [--at <time>]`: runs one as if its time had come, in the app's
 * own code (a Vite server without a page, so the modules read import.meta.env as they do when
 * served), which is how a test sees a reminder land in the outbox.
 */
export function timers(dir: string, io: Io, args: string[], at?: string): number {
  const { ir } = loadSpec(dir, io);
  if (!ir) return 1;
  if (args[0] !== "run") {
    if (!ir.timers.length) io.out("The app has no timers.\n");
    for (const t of ir.timers) io.out(`${t.name}: ${timerText(t)}\n`);
    return 0;
  }
  const name = args[1];
  const timer = ir.timers.find((t) => t.name === name);
  if (!timer) {
    io.err(
      `There is no timer ${name ?? ""}: ${ir.timers.map((t) => t.name).join(", ") || "the app has none"}.\n`,
    );
    return 2;
  }
  const when = at ? new Date(at) : new Date();
  if (Number.isNaN(when.getTime())) {
    io.err(`--at takes a time, like 2026-10-22T08:00:00Z, not "${at}".\n`);
    return 2;
  }
  const script = `
const { createServer } = await import("vite");
const server = await createServer({
  configFile: false,
  root: process.cwd(),
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true, hmr: false, watch: null },
});
try {
  const timers = await server.ssrLoadModule("/src/generated/timers.server.ts");
  await timers.runTimer(${JSON.stringify(timer.name)}, new Date(${JSON.stringify(when.toISOString())}));
} finally {
  await server.close();
}`;
  const code = exec("node", ["--input-type=module", "-e", script], dir);
  if (code === 0) io.out(`Ran the timer ${timer.name} as of ${when.toISOString()}.\n`);
  return code;
}
