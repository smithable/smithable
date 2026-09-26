import { spawnSync } from "node:child_process";

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

/** Runs a command with inherited output. Returns its exit code. */
export function exec(command: string, args: string[], cwd: string): number {
  const result = spawnSync(command, args, {
    cwd,
    stdio: childStdio,
    shell: process.platform === "win32",
  });
  return result.status ?? 1;
}
