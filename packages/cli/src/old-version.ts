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
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(typeof address === "object" && address ? address.port : 0));
    });
  });
}

/**
 * The old version's environment: a list of what is allowed, never today's minus some. No mail
 * server, SMS provider, payment keys, other services' addresses or secrets, mailbox or assistant
 * key: the app's own fallbacks then write mail and texts into its outbox and skip the calls.
 */
export function oldEnvironment(
  from: NodeJS.ProcessEnv,
  own: { home: string; dataDir: string; url: string; lookKey?: string; doorSecret: string },
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
    HOME: own.home,
    DATA_DIR: own.dataDir,
    BETTER_AUTH_URL: own.url,
    DEV_DOOR_SECRET: own.doorSecret,
    ...(own.lookKey ? { SMITHABLE_LOOK_KEY: own.lookKey } : {}),
    NO_COLOR: "1",
  };
}

/** Runs a command to its end in the old version's folder, with its environment. */
function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): void {
  execFileSync(command, args, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

/**
 * Opens the app as it was at `commit`: the code in a worktree of Studio's own, its packages from
 * the machine's store with its own lockfile, the data as it was then (else its samples), and its
 * dev server on a free port. Any old version already open is closed first.
 */
export async function openOldVersion(
  dir: string,
  commit: string,
  options: { lookKey?: string; log?: (line: string) => void; host?: string } = {},
): Promise<OldVersion & { child: ChildProcess }> {
  closeOldVersion(dir);
  const sha = git(dir, ["rev-parse", "--verify", `${commit}^{commit}`]);
  const project = createHash("sha256").update(realpathSync(dir)).digest("hex").slice(0, 12);
  const folder = join(base(), `${project}-${sha.slice(0, 12)}`);
  const home = `${folder}.home`;
  const port = await freePort();
  // Recorded before anything is made, so a crash or a second open finds it and removes it.
  const record: OldVersion = { commit: sha, folder, home, port, data: "samples", pictures: "none" };
  mkdirSync(join(dir, "data", ".smithable"), { recursive: true });
  writeFileSync(recordPath(dir), JSON.stringify(record));
  rmSync(folder, { recursive: true, force: true });
  rmSync(home, { recursive: true, force: true });
  mkdirSync(base(), { recursive: true });
  git(dir, ["worktree", "add", "--detach", folder, sha]);
  mkdirSync(home, { recursive: true });
  const url = `http://${options.host ?? "localhost"}:${port}`;
  const dataDir = join(folder, "data");
  const env = oldEnvironment(process.env, {
    home,
    dataDir,
    url,
    ...(options.lookKey ? { lookKey: options.lookKey } : {}),
    doorSecret: randomBytes(24).toString("hex"),
  });
  try {
    options.log?.("Installing the old version's packages.\n");
    run("pnpm", ["install", "--frozen-lockfile", "--prefer-offline"], folder, env);
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
    } else run("pnpm", ["db:seed"], folder, env);
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
    // The worktree's own vite, started directly so it leads its process group and closing stops
    // it: pnpm exec would start it in a group of its own, out of reach.
    const child = spawn(...tool(folder, "vite", ["dev", "--port", String(port), "--strictPort"]), {
      cwd: folder,
      env,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (d) => options.log?.(String(d)));
    child.stderr?.on("data", (d) => options.log?.(String(d)));
    if (child.pid) record.pid = child.pid;
    writeFileSync(recordPath(dir), JSON.stringify(record));
    return { ...record, child };
  } catch (error) {
    closeOldVersion(dir);
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
 * Closes the old version (and any a crash left behind): its server with its whole process group,
 * its worktree (also from Git's list), its packages, data and home folder.
 */
export function closeOldVersion(dir: string): void {
  const open = openVersion(dir);
  if (!open) return;
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
  // Its server, only while that process is still the one started in the copy: after a restart
  // of the machine the number may be another program's.
  if (open.pid && inside(open.folder))
    try {
      if (realpathSync(`/proc/${open.pid}/cwd`).startsWith(resolve(open.folder)))
        process.kill(-open.pid, "SIGKILL");
    } catch {}
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
}
