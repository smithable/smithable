import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/** Where commands write their output; tests capture it. */
export interface Io {
  out(text: string): void;
  err(text: string): void;
}

export const processIo: Io = {
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
};

/**
 * Where child processes write. The MCP server speaks JSON-RPC on stdout, so there they
 * write to stderr and never read stdin.
 */
let childStdio: "inherit" | ["ignore", 2, 2] = "inherit";

export function keepStdoutForProtocol(): void {
  childStdio = ["ignore", 2, 2];
}

/**
 * The command for one of the app's own tools (drizzle-kit, tsr, tsx, vite): its binary in
 * node_modules/.bin, run directly. `pnpm exec` would start pnpm and check the dependencies
 * first, which costs about 1.5 s per call in a sandboxed hosted workspace. On Windows, and
 * before the first install, through pnpm.
 */
export function tool(dir: string, name: string, args: string[]): [string, string[]] {
  const bin = join(resolve(dir), "node_modules", ".bin", name);
  return process.platform !== "win32" && existsSync(bin)
    ? [bin, args]
    : ["pnpm", ["exec", name, ...args]];
}

/**
 * With SMITHABLE_TIMINGS set, how long each step since the last took, on stderr: for finding
 * where an operation spends its time (e.g. in a sandboxed hosted workspace).
 */
let lapStart = Date.now();
export function lap(step: string): void {
  if (!process.env.SMITHABLE_TIMINGS) return;
  process.stderr.write(`[time] ${step}: ${Date.now() - lapStart} ms\n`);
  lapStart = Date.now();
}
/** Starts the clock again: the first step of a new piece of work is not the wait before it. */
export function lapFrom(): void {
  lapStart = Date.now();
}
/** One timing of its own, beside the laps (e.g. how long the preview took to answer). */
export function timed(what: string, since: number): void {
  if (process.env.SMITHABLE_TIMINGS)
    process.stderr.write(`[time] ${what}: ${Date.now() - since} ms\n`);
}

function shellOptions(command: string, args: string[]): { shell?: boolean } {
  if (process.platform === "win32") {
    if (!/^[a-zA-Z0-9._-]+$/.test(command)) throw new Error(`Unsafe command: ${command}`);
    if (args.every((a) => !/[&|<>^()$%]/.test(a))) return { shell: true };
  }
  return {};
}

/** Runs a command and shows its output only when it fails (a tool that talks while it works). */
export function execQuiet(command: string, args: string[], cwd: string): number {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    ...shellOptions(command, args),
  });
  if (result.status !== 0) process.stderr.write(`${result.stdout ?? ""}${result.stderr ?? ""}`);
  return result.status ?? 1;
}

/** Runs a command with inherited output. Returns its exit code. */
export function exec(command: string, args: string[], cwd: string): number {
  const result = spawnSync(command, args, {
    cwd,
    stdio: childStdio,
    ...shellOptions(command, args),
  });
  return result.status ?? 1;
}
