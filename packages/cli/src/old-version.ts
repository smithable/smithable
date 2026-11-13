// Looking at an old version (docs/design/old-version-preview.md): the app as it was at an earlier
// change, run as a copy with its own folder, its own data, its own port and an environment that
// holds nothing with which it could reach outside. Closing it removes all of it. The project's
// own folder, branch, packages and data are never touched.
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { tool } from "./io.js";

/** Uploads are copied for the old version only up to this size in all; above it, none. */
export const UPLOADS_MAX = 200 * 1024 * 1024;

/**
 * The copy's host name: another than the preview's (localhost), so the two do not share one
 * cookie jar (ports do not separate cookies) and signing in to one never signs out the other.
 */
export const OLD_HOST = "127.0.0.1";

/**
 * Whether old versions are offered and opened: not by a Studio behind a proxy (`host`, a hosted
 * workspace), whose visitor's localhost is their own machine and whose container has no room
 * for a second dev server, until the service passes a second port (old-version-preview.md §6).
 */
export const oldVersionsOffered = (host: string | undefined): boolean => !host;

/** Why an opening stopped before it was done: a newer one was asked for, or it was closed. */
export const SUPERSEDED = "Another version was asked for, or it was closed.";

/** What is open, kept beside Studio's state so a crash's leftovers are found at the next start. */
export interface OldVersion {
  commit: string;
  folder: string;
  home: string;
  port: number;
  pid?: number;
  /** "then": the data as it was at that version (its snapshot); "samples": made new and seeded. */
  data: "then" | "samples";
  /** Whether today's pictures were copied ("today"), or none because there were too many ("none"). */
  pictures: "today" | "none";
}

const recordPath = (dir: string) => join(dir, "data", ".smithable", "old-version.json");

/**
 * What this process is doing for an old version, per project: the opening under way (its abort
 * and the commands it runs) and the server it started. Closing stops these directly, by the
 * process groups this process started, on every system.
 */
const running = new Map<string, { abort: AbortController; children: Set<ChildProcess> }>();

/** Git in the project, with its hooks switched off for the command. */
const git = (dir: string, args: string[]): string =>
  execFileSync("git", ["-c", "core.hooksPath=/dev/null", ...args], {
    cwd: dir,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  })
    .toString("utf8")
    .trim();

/** Studio's own folder for old versions, outside the project: under the user's cache. */
function base(): string {
  return join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "smithable", "old-versions");
}

/** The snapshot holding the data as it was while `commit` was the newest change, if it is kept. */
export function snapshotAfter(dir: string, commit: string): string | undefined {
  // The change after it: its snapshot was taken just before it was made.
  const next = git(dir, ["rev-list", "--reverse", "--ancestry-path", `${commit}..HEAD`]).split(
    "\n",
  )[0];
  if (!next) return undefined;
  const id = git(dir, ["log", "-1", "--format=%(trailers:key=Smithable-Snapshot,valueonly)", next]);
  if (!id || id === "none" || !/^[\w-]+$/.test(id)) return undefined;
  const file = join(dir, "data", ".smithable", "snapshots", `${id}.db`);
  return existsSync(file) ? file : undefined;
}

/** The size of a folder's files in all, stopping once it passes `limit`. */
function sizeOf(folder: string, limit: number): number {
  let total = 0;
  const walk = (at: string) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      if (total > limit) return;
      const path = join(at, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) total += statSync(path).size;
    }
  };
  if (existsSync(folder)) walk(folder);
  return total;
}

/** A free port on this machine. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, OLD_HOST, () => {
      const address = server.address();
      server.close(() => resolve(typeof address === "object" && address ? address.port : 0));
    });
  });
}

/**
 * The old version's environment: a list of what is allowed, never today's minus some. No mail
 * server, SMS provider, payment keys, other services' addresses or secrets, mailbox or assistant
 * key: the app's own fallbacks then write mail and texts into its outbox and skip the calls.
 * `store` is the project's package store, so the copy's packages come from it and nothing is
 * downloaded again into a new one under the empty home.
 */
export function oldEnvironment(
  from: NodeJS.ProcessEnv,
  own: {
    home: string;
    dataDir: string;
    url: string;
    lookKey?: string;
    doorSecret: string;
    store?: string;
  },
): NodeJS.ProcessEnv {
  const kept = Object.fromEntries(
    Object.entries(from).filter(
      ([name]) =>
        ["PATH", "LANG", "LC_ALL", "TZ", "TERM", "TMPDIR"].includes(name) ||
        // Node's own, and where the machine's package store is.
        (name.startsWith("NODE_") && name !== "NODE_OPTIONS") ||
        /^(pnpm_config_store_dir|pnpm_config_virtual_store_dir|PNPM_HOME)$/.test(name),
    ),
  );
  return {
    ...kept,
    ...(own.store ? { pnpm_config_store_dir: own.store } : {}),
    HOME: own.home,
    DATA_DIR: own.dataDir,
    BETTER_AUTH_URL: own.url,
    DEV_DOOR_SECRET: own.doorSecret,
    ...(own.lookKey ? { SMITHABLE_LOOK_KEY: own.lookKey } : {}),
    NO_COLOR: "1",
  };
}

/** Stops a process this process started, with its whole group. */
const stop = (child: ChildProcess) => {
  if (child.pid && child.exitCode === null && child.signalCode === null)
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {}
};

/**
 * Runs a command to its end without holding Studio up, as the leader of its own process group so
 * an abort stops it and everything it started. Its output, when it is wanted.
 */
function run(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  children: Set<ChildProcess>,
  signal: AbortSignal,
): Promise<string> {
  signal.throwIfAborted();
  return new Promise((done, fail) => {
    const child = spawn(command, args, { cwd, env, detached: true, stdio: "pipe" });
    children.add(child);
    let out = "";
    let err = "";
    child.stdout?.on("data", (d) => {
      out += d;
    });
    child.stderr?.on("data", (d) => {
      err = `${err}${d}`.slice(-4000);
    });
    child.once("error", (error) => {
      children.delete(child);
      fail(signal.aborted ? signal.reason : error);
    });
    child.once("close", (code) => {
      children.delete(child);
      if (signal.aborted) fail(signal.reason);
      else if (code === 0) done(out.trim());
      else
        fail(new Error(`${command} ${args[0]} failed: ${err.trim().split("\n").at(-1) ?? code}`));
    });
  });
}

/**
 * Opens the app as it was at `commit`: the code in a worktree of Studio's own, its packages from
 * the project's store with its own lockfile, the data as it was then (else its samples), and its
 * dev server on a free port. Any old version already open, or being opened, is closed first: a
 * newer request stops the older one's commands before its folders go.
 */
export async function openOldVersion(
  dir: string,
  commit: string,
  options: { lookKey?: string; log?: (line: string) => void } = {},
): Promise<OldVersion & { child: ChildProcess; url: string }> {
  closeOldVersion(dir);
  const abort = new AbortController();
  const children = new Set<ChildProcess>();
  running.set(dir, { abort, children });
  const { signal } = abort;
  // Everything from here is undone by closing when it fails, the worktree's making included.
  try {
    const sha = git(dir, ["rev-parse", "--verify", `${commit}^{commit}`]);
    const project = createHash("sha256").update(realpathSync(dir)).digest("hex").slice(0, 12);
    const folder = join(base(), `${project}-${sha.slice(0, 12)}`);
    const home = `${folder}.home`;
    const port = await freePort();
    signal.throwIfAborted();
    // Recorded before anything is made, so a crash or a second open finds it and removes it.
    const record: OldVersion = {
      commit: sha,
      folder,
      home,
      port,
      data: "samples",
      pictures: "none",
    };
    mkdirSync(join(dir, "data", ".smithable"), { recursive: true });
    writeFileSync(recordPath(dir), JSON.stringify(record));
    rmSync(folder, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
    mkdirSync(base(), { recursive: true });
    git(dir, ["worktree", "add", "--detach", folder, sha]);
    mkdirSync(home, { recursive: true });
    const url = `http://${OLD_HOST}:${port}`;
    const dataDir = join(folder, "data");
    // The project's own store, asked as the project runs pnpm (its environment, not the copy's).
    const store = await run("pnpm", ["store", "path"], dir, process.env, children, signal).catch(
      (error) => {
        if (signal.aborted) throw error;
        return undefined;
      },
    );
    const env = oldEnvironment(process.env, {
      home,
      dataDir,
      url,
      ...(options.lookKey ? { lookKey: options.lookKey } : {}),
      doorSecret: randomBytes(24).toString("hex"),
      ...(store ? { store } : {}),
    });
    options.log?.("Installing the old version's packages.\n");
    await run(
      "pnpm",
      ["install", "--frozen-lockfile", "--prefer-offline"],
      folder,
      env,
      children,
      signal,
    );
    mkdirSync(join(dataDir, "db"), { recursive: true });
    // The data as it was then: the snapshot, read only and copied whole; else made new and seeded.
    const snapshot = snapshotAfter(dir, sha);
    if (snapshot) {
      const db = new DatabaseSync(snapshot, { readOnly: true });
      try {
        db.exec(`VACUUM INTO '${join(dataDir, "db", "app.db").replaceAll("'", "''")}'`);
      } finally {
        db.close();
      }
      record.data = "then";
    } else await run("pnpm", ["db:seed"], folder, env, children, signal);
    // Today's pictures, copied (never linked: the old app may delete or replace a record's file).
    const uploads = join(dir, "data", "uploads");
    if (existsSync(uploads) && sizeOf(uploads, UPLOADS_MAX) <= UPLOADS_MAX) {
      // Files only: a link is neither counted nor followed (it could point anywhere, any size).
      cpSync(uploads, join(dataDir, "uploads"), {
        recursive: true,
        filter: (source) => !lstatSync(source).isSymbolicLink(),
      });
      record.pictures = "today";
    }
    signal.throwIfAborted();
    // The worktree's own vite, started directly so it leads its process group and closing stops
    // it: pnpm exec would start it in a group of its own, out of reach. On the copy's own host.
    const child = spawn(
      ...tool(folder, "vite", ["dev", "--host", OLD_HOST, "--port", String(port), "--strictPort"]),
      { cwd: folder, env, detached: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    children.add(child);
    child.stdout?.on("data", (d) => options.log?.(String(d)));
    child.stderr?.on("data", (d) => options.log?.(String(d)));
    if (child.pid) record.pid = child.pid;
    writeFileSync(recordPath(dir), JSON.stringify(record));
    return { ...record, child, url };
  } catch (error) {
    // Only this opening's own: a newer one has already closed it and started its own.
    if (running.get(dir)?.abort === abort) closeOldVersion(dir);
    throw error;
  }
}

/** The old version open now, as recorded, if any. */
export function openVersion(dir: string): OldVersion | undefined {
  try {
    return JSON.parse(readFileSync(recordPath(dir), "utf8")) as OldVersion;
  } catch {
    return undefined;
  }
}

/**
 * Closes the old version (and any a crash left behind): an opening under way is stopped first,
 * then its server with its whole process group, its worktree (also from Git's list), its packages,
 * data and home folder. Returns a leftover server it could not tell was its own: a crash's, on a
 * system without /proc (macOS), whose port the caller may try and tell the person about.
 */
export function closeOldVersion(dir: string): { unstopped?: { pid: number; port: number } } {
  // This process's own: stopped directly, whatever the system, before any folder is removed, so
  // an install still running cannot make the folder again after the clean-up.
  const own = running.get(dir);
  running.delete(dir);
  if (own) {
    own.abort.abort(new Error(SUPERSEDED));
    for (const child of own.children) stop(child);
  }
  const open = openVersion(dir);
  if (!open) return {};
  // Only folders under Studio's own, by the shape it names them, resolved first: nothing else is
  // ever removed.
  const inside = (path: string) => {
    const full = resolve(path);
    return (
      full.startsWith(`${resolve(base())}/`) &&
      /\/[0-9a-f]{12}-[0-9a-f]{12}(\.home)?$/.test(full) &&
      dirname(full) === resolve(base())
    );
  };
  // A crash's server: stopped only while that process is still the one started in the copy (after
  // a restart of the machine the number may be another program's). Without /proc that cannot be
  // told, so it is left and named.
  let unstopped: { pid: number; port: number } | undefined;
  if (!own && open.pid && inside(open.folder)) {
    if (existsSync("/proc"))
      try {
        if (realpathSync(`/proc/${open.pid}/cwd`).startsWith(resolve(open.folder)))
          process.kill(-open.pid, "SIGKILL");
      } catch {}
    else unstopped = { pid: open.pid, port: open.port };
  }
  if (inside(open.folder)) {
    try {
      git(dir, ["worktree", "remove", "--force", open.folder]);
    } catch {}
    rmSync(open.folder, { recursive: true, force: true });
  }
  if (inside(open.home)) rmSync(open.home, { recursive: true, force: true });
  try {
    git(dir, ["worktree", "prune"]);
  } catch {}
  rmSync(recordPath(dir), { force: true });
  return unstopped ? { unstopped } : {};
}
