import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { appName } from "./build.js";
import type { Io } from "./io.js";
import { S3 } from "./s3.js";

/**
 * Backups (ARCHITECTURE §12): what is irreplaceable in /data, the database (a consistent
 * snapshot with SQLite's VACUUM INTO) and uploads, from the project's development database or
 * a deployed container, to a folder or any S3-compatible bucket. Each backup is a folder
 * named by its time, e.g. acme-crm/20260927-151200/app.db.
 */

interface Target {
  /** Stores a backup's files, given as a local folder. */
  save(name: string, local: string): Promise<void>;
  /** The backups there, oldest first. */
  list(app: string): Promise<string[]>;
  /** Fetches a backup into a local folder. */
  load(name: string, local: string): Promise<void>;
}

function files(root: string): string[] {
  return readdirSync(root, { recursive: true, encoding: "utf8" }).filter((f) =>
    statSync(join(root, f)).isFile(),
  );
}

/** A folder, or s3://bucket/prefix with the credentials in the environment. */
function target(spec: string): Target {
  if (!spec.startsWith("s3://")) {
    const root = resolve(spec);
    return {
      async save(name, local) {
        cpSync(local, join(root, name), { recursive: true });
      },
      async list(app) {
        return existsSync(join(root, app)) ? readdirSync(join(root, app)).sort() : [];
      },
      async load(name, local) {
        cpSync(join(root, name), local, { recursive: true });
      },
    };
  }
  const [bucket = "", ...rest] = spec.slice(5).split("/");
  const prefix = rest.filter(Boolean).join("/");
  const at = (key: string) => (prefix ? `${prefix}/${key}` : key);
  const s3 = new S3();
  return {
    async save(name, local) {
      for (const file of files(local))
        await s3.put(bucket, at(`${name}/${file}`), readFileSync(join(local, file)));
    },
    async list(app) {
      const keys = await s3.list(bucket, at(`${app}/`));
      return [...new Set(keys.map((k) => k.slice(at(`${app}/`).length).split("/")[0] ?? ""))]
        .filter(Boolean)
        .sort();
    },
    async load(name, local) {
      for (const key of await s3.list(bucket, at(`${name}/`))) {
        const path = join(local, safeRelative(key.slice(at(`${name}/`).length)));
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, await s3.get(bucket, key));
      }
    },
  };
}

const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

/** Node in the deployed image (distroless), or on this machine for the project itself. */
const SNAPSHOT = (from: string, to: string) =>
  `const D=require("better-sqlite3");new D(${JSON.stringify(from)},{readonly:true}).exec("VACUUM INTO '"+${JSON.stringify(to.replace(/'/g, "''"))}+"'")`;

/** `smithable backup [dir] --to <folder|s3://…> [--container <name>]`. */
/**
 * A key from a bucket as a path under the restore folder: a bucket's listing is not trusted,
 * so ".." or an absolute path, which would write elsewhere, is refused.
 */
export function safeRelative(key: string): string {
  const parts = key.split(/[\\/]/);
  if (key.startsWith("/") || parts.some((p) => p === ".." || p === ""))
    throw new Error(`The backup has an unsafe file name: ${JSON.stringify(key)}.`);
  return parts.join("/");
}

export async function backup(
  dir: string,
  io: Io,
  options: { to: string; container?: string },
): Promise<number> {
  const app = appName(dir);
  const local = mkdtempSync(join(tmpdir(), "smithable-backup-"));
  const name = `${app}/${stamp()}`;
  try {
    if (options.container) {
      // Snapshot inside the container, then copy it out.
      const inside = `/data/backups/${stamp()}.db`;
      const exec = (args: string[]) => spawnSync("docker", args, { encoding: "utf8" });
      const snap = exec([
        "exec",
        options.container,
        "/nodejs/bin/node",
        "-e",
        `require("fs").mkdirSync("/data/backups",{recursive:true});${SNAPSHOT("/data/db/app.db", inside)}`,
      ]);
      if (snap.status !== 0) throw new Error(`The snapshot failed: ${snap.stderr}`);
      exec(["cp", `${options.container}:${inside}`, join(local, "app.db")]);
      exec([
        "exec",
        options.container,
        "/nodejs/bin/node",
        "-e",
        `require("fs").rmSync(${JSON.stringify(inside)})`,
      ]);
      if (
        exec([
          "exec",
          options.container,
          "/nodejs/bin/node",
          "-e",
          `process.exit(require("fs").existsSync("/data/uploads")?0:1)`,
        ]).status === 0
      )
        exec(["cp", `${options.container}:/data/uploads`, join(local, "uploads")]);
    } else {
      const db = join(dir, "data", "db", "app.db");
      if (!existsSync(db)) throw new Error(`There is no database at ${db}.`);
      const snap = spawnSync("node", ["-e", SNAPSHOT(db, join(local, "app.db"))], {
        cwd: dir,
        encoding: "utf8",
      });
      if (snap.status !== 0) throw new Error(`The snapshot failed: ${snap.stderr}`);
      if (existsSync(join(dir, "data", "uploads")))
        cpSync(join(dir, "data", "uploads"), join(local, "uploads"), { recursive: true });
    }
    if (!existsSync(join(local, "app.db"))) throw new Error("The snapshot was not copied out.");
    await target(options.to).save(name, local);
    io.out(
      `Backed up to ${options.to.replace(/\/$/, "")}/${name} (${files(local).length} file(s)).\n`,
    );
    return 0;
  } catch (error) {
    io.err(`${error instanceof Error ? error.message : String(error)}\nNo backup was made.\n`);
    return 1;
  } finally {
    rmSync(local, { recursive: true, force: true });
  }
}

/**
 * `smithable restore [dir] --from <folder|s3://…> [--backup <time>] [--container <name>]`:
 * the newest backup (or the one named) replaces the data. A container is stopped, its volume
 * is filled by a one-off container of the same image (the same user owns the files), and it
 * starts again.
 */
export async function restore(
  dir: string,
  io: Io,
  options: { from: string; backup?: string; container?: string },
): Promise<number> {
  const app = appName(dir);
  const local = mkdtempSync(join(tmpdir(), "smithable-restore-"));
  try {
    const source = target(options.from);
    // Only the backups' own folders (named by their time); anything else under the app's
    // prefix, e.g. a folder an earlier --to nested there, is not a backup.
    const backups = (await source.list(app)).filter((name) => /^\d{8}-\d{6}$/.test(name));
    const chosen = options.backup ?? backups.at(-1);
    if (!chosen || !backups.includes(chosen))
      throw new Error(
        `No backup${options.backup ? ` ${options.backup}` : ""} of ${app} at ${options.from}.`,
      );
    await source.load(`${app}/${chosen}`, local);
    if (!existsSync(join(local, "app.db"))) throw new Error("The backup has no database.");
    if (options.container) {
      const docker = (args: string[]) => spawnSync("docker", args, { encoding: "utf8" });
      const inspect = docker([
        "inspect",
        "-f",
        '{{.Config.Image}}|{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}',
        options.container,
      ]);
      const [image, volume] = inspect.stdout.trim().split("|");
      if (inspect.status !== 0 || !image || !volume)
        throw new Error(`${options.container} is not a container with a /data volume.`);
      docker(["stop", options.container]);
      // Root in this one-off container reads the private restore folder; the files then go
      // to the image's own user (distroless nonroot, 65532), so the app can write them.
      const copy = docker([
        "run",
        "--rm",
        "--user",
        "0",
        "-v",
        `${volume}:/data`,
        "-v",
        `${local}:/restore:ro`,
        "--entrypoint",
        "/nodejs/bin/node",
        image,
        "-e",
        `const fs=require("fs");fs.mkdirSync("/data/db",{recursive:true});for(const f of ["app.db-wal","app.db-shm"])fs.rmSync("/data/db/"+f,{force:true});fs.copyFileSync("/restore/app.db","/data/db/app.db");if(fs.existsSync("/restore/uploads"))fs.cpSync("/restore/uploads","/data/uploads",{recursive:true});const own=(p)=>{fs.chownSync(p,65532,65532);if(fs.statSync(p).isDirectory())for(const e of fs.readdirSync(p))own(p+"/"+e)};own("/data");`,
      ]);
      if (copy.status !== 0) throw new Error(`Copying into the volume failed: ${copy.stderr}`);
      docker(["start", options.container]);
    } else {
      const db = join(dir, "data", "db");
      mkdirSync(db, { recursive: true });
      for (const f of ["app.db-wal", "app.db-shm"]) rmSync(join(db, f), { force: true });
      cpSync(join(local, "app.db"), join(db, "app.db"));
      if (existsSync(join(local, "uploads")))
        cpSync(join(local, "uploads"), join(dir, "data", "uploads"), { recursive: true });
    }
    io.out(
      `Restored ${app}/${chosen} (${files(local).map((f) => relative(local, join(local, f))).length} file(s)).\n`,
    );
    return 0;
  } catch (error) {
    io.err(`${error instanceof Error ? error.message : String(error)}\nNothing was restored.\n`);
    return 1;
  } finally {
    rmSync(local, { recursive: true, force: true });
  }
}
