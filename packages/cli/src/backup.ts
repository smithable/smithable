import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  cpSync,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { CAPTURE_MS, captureProgram, stopCaptureProgram } from "./backup-capture.js";
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

const MANIFEST = "manifest.json";
const COMPLETE = "complete";
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
function fileDigest(path: string): { size: number; sha256: string } {
  const fd = openSync(path, "r");
  try {
    const hash = createHash("sha256"),
      buffer = Buffer.allocUnsafe(64 * 1024);
    for (;;) {
      const length = readSync(fd, buffer, 0, buffer.length, null);
      if (length === 0) break;
      hash.update(buffer.subarray(0, length));
    }
    return { size: fstatSync(fd).size, sha256: hash.digest("hex") };
  } finally {
    closeSync(fd);
  }
}
function files(root: string): string[] {
  if (lstatSync(root).isSymbolicLink()) throw new Error("Backup root is a symbolic link.");
  return readdirSync(root, { recursive: true, encoding: "utf8" }).filter((f) => {
    const stat = lstatSync(join(root, f));
    if (stat.isSymbolicLink()) throw new Error("Backup data contains a symbolic link.");
    if (!stat.isFile() && !stat.isDirectory())
      throw new Error("Backup data contains an unsupported special file.");
    return stat.isFile();
  });
}
function manifest(root: string): void {
  const entries = files(root).map((path) => {
    return { path: safeRelative(path), ...fileDigest(join(root, path)) };
  });
  writeFileSync(
    join(root, MANIFEST),
    JSON.stringify({
      version: 1,
      capture: { method: "sqlite-writer-hold", maxMs: CAPTURE_MS },
      entries,
    }),
  );
}
export function verifyBackup(root: string): boolean {
  const inventory = files(root);
  if (!existsSync(join(root, MANIFEST))) {
    if (existsSync(join(root, COMPLETE))) throw new Error("Backup manifest is missing.");
    return false;
  } // Explicit legacy compatibility.
  if (!existsSync(join(root, COMPLETE))) throw new Error("Backup is incomplete.");
  const raw = readFileSync(join(root, MANIFEST));
  if (readFileSync(join(root, COMPLETE), "utf8") !== digest(raw))
    throw new Error("Backup manifest checksum mismatch.");
  const doc = JSON.parse(raw.toString("utf8")) as {
    version?: number;
    entries?: { path: string; size: number; sha256: string }[];
  };
  if (doc.version !== 1 || !Array.isArray(doc.entries))
    throw new Error("Unsupported backup manifest.");
  const seen = new Set<string>();
  for (const entry of doc.entries) {
    if (!entry || typeof entry.path !== "string") throw new Error("Invalid backup entry.");
    const path = safeRelative(entry.path);
    if (
      path === MANIFEST ||
      path === COMPLETE ||
      seen.has(path) ||
      !Number.isSafeInteger(entry.size) ||
      entry.size < 0 ||
      !/^[a-f0-9]{64}$/.test(entry.sha256)
    )
      throw new Error("Invalid backup entry.");
    seen.add(path);
    const actual = fileDigest(join(root, path));
    if (actual.size !== entry.size || actual.sha256 !== entry.sha256)
      throw new Error(`Backup checksum mismatch: ${path}`);
  }
  if (
    !seen.has("app.db") ||
    inventory.some((p) => p !== MANIFEST && p !== COMPLETE && !seen.has(safeRelative(p)))
  )
    throw new Error("Backup inventory mismatch.");
  return true;
}

/** A folder, or s3://bucket/prefix with the credentials in the environment. */
function target(spec: string): Target {
  if (!spec.startsWith("s3://")) {
    const root = resolve(spec);
    return {
      async save(name, local) {
        const destination = join(root, name);
        mkdirSync(dirname(destination), { recursive: true });
        const pending = join(dirname(destination), `.pending-${randomUUID()}`);
        try {
          cpSync(local, pending, { recursive: true });
          writeFileSync(join(pending, COMPLETE), digest(readFileSync(join(pending, MANIFEST))));
          renameSync(pending, destination);
        } finally {
          rmSync(pending, { recursive: true, force: true });
        }
      },
      async list(app) {
        return existsSync(join(root, app))
          ? readdirSync(join(root, app))
              .filter(
                (n) =>
                  !n.startsWith(".") &&
                  (!existsSync(join(root, app, n, MANIFEST)) ||
                    existsSync(join(root, app, n, COMPLETE))),
              )
              .sort()
          : [];
      },
      async load(name, local) {
        files(join(root, name));
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
      // Publish metadata first so an interrupted v1 upload cannot look like a legacy backup.
      await s3.put(bucket, at(`${name}/${MANIFEST}`), readFileSync(join(local, MANIFEST)));
      for (const file of files(local).filter((f) => f !== MANIFEST))
        await s3.put(bucket, at(`${name}/${file}`), readFileSync(join(local, file)));
      await s3.put(
        bucket,
        at(`${name}/${COMPLETE}`),
        Buffer.from(digest(readFileSync(join(local, MANIFEST)))),
      );
    },
    async list(app) {
      const keys = await s3.list(bucket, at(`${app}/`));
      return [...new Set(keys.map((k) => k.slice(at(`${app}/`).length).split("/")[0] ?? ""))]
        .filter(Boolean)
        .filter(
          (n) =>
            !keys.includes(at(`${app}/${n}/${MANIFEST}`)) ||
            keys.includes(at(`${app}/${n}/${COMPLETE}`)),
        )
        .sort();
    },
    async load(name, local) {
      const seen = new Set<string>();
      for (const key of await s3.list(bucket, at(`${name}/`))) {
        const relative = safeRelative(key.slice(at(`${name}/`).length));
        if (seen.has(relative)) throw new Error("Backup object paths alias each other.");
        seen.add(relative);
        const path = join(local, relative);
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, await s3.get(bucket, key));
      }
    },
  };
}

const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);

/** `smithable backup [dir] --to <folder|s3://…> [--container <name>]`. */
/**
 * A key from a bucket as a path under the restore folder: a bucket's listing is not trusted,
 * so ".." or an absolute path, which would write elsewhere, is refused.
 */
export function safeRelative(key: string): string {
  const parts = key.split(/[\\/]/);
  if (/^([a-z]:|[\\/])/i.test(key) || parts.some((p) => p === ".." || p === "." || p === ""))
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
  const name = `${app}/${stamp()}-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  try {
    if (options.container) {
      // Snapshot inside the container, then copy it out.
      const inside = `/data/backups/${name.split("/").at(-1)}.db`;
      const insideUploads = `${inside}.uploads`;
      const control = `${inside}.control`;
      const token = randomUUID();
      const exec = (args: string[], step: string, absent = false) => {
        const result = spawnSync("docker", args, {
          encoding: "utf8",
          timeout: step === "The snapshot" ? CAPTURE_MS + 5000 : undefined,
        });
        if (
          !result.error &&
          !result.signal &&
          (result.status === 0 || (absent && result.status === 3))
        )
          return result;
        throw new Error(
          `${step} failed: ${
            result.error?.message ||
            result.stderr ||
            result.signal ||
            `exit status ${result.status}`
          }`,
        );
      };
      let failure: unknown;
      try {
        exec(
          [
            "exec",
            options.container,
            "/nodejs/bin/node",
            "-e",
            captureProgram({
              from: "/data/db/app.db",
              to: inside,
              uploads: "/data/uploads",
              toUploads: insideUploads,
              control,
              token,
            }),
          ],
          "The snapshot",
        );
        exec(["cp", `${options.container}:${inside}`, join(local, "app.db")], "The database copy");
        // Exit 3 means confirmed absence. Exceptions and Docker errors must fail backup.
        const probe = exec(
          [
            "exec",
            options.container,
            "/nodejs/bin/node",
            "-e",
            `const fs=require("fs");try{fs.statSync(${JSON.stringify(insideUploads)})}catch(e){if(e.code==="ENOENT")process.exit(3);throw e}`,
          ],
          "The uploads probe",
          true,
        );
        if (probe.status === 0)
          exec(
            ["cp", `${options.container}:${insideUploads}`, join(local, "uploads")],
            "The uploads copy",
          );
      } catch (error) {
        failure = error;
      }
      try {
        const stopped = exec(
          ["exec", options.container, "/nodejs/bin/node", "-e", stopCaptureProgram(control, token)],
          "Snapshot cleanup",
        );
        const state = stopped.stdout?.trim();
        if (state !== "finished" && state !== "pending")
          throw new Error("Snapshot cleanup failed: capture exit is unknown");
        exec(
          [
            "exec",
            options.container,
            "/nodejs/bin/node",
            "-e",
            `const fs=require("fs");fs.rmSync(${JSON.stringify(inside)},{force:true});fs.rmSync(${JSON.stringify(insideUploads)},{recursive:true,force:true});${state === "finished" ? `fs.rmSync(${JSON.stringify(control)},{force:true});fs.rmSync(${JSON.stringify(`${control}.cancel`)},{force:true})` : ""}`,
          ],
          "Snapshot cleanup",
        );
      } catch (error) {
        if (!failure) failure = error;
        else io.err(`${error instanceof Error ? error.message : String(error)}\n`);
      }
      if (failure) throw failure;
    } else {
      const db = join(dir, "data", "db", "app.db");
      if (!existsSync(db)) throw new Error(`There is no database at ${db}.`);
      const snap = spawnSync(
        "node",
        [
          "-e",
          captureProgram({
            from: db,
            to: join(local, "app.db"),
            uploads: join(dir, "data", "uploads"),
            toUploads: join(local, "uploads"),
          }),
        ],
        {
          cwd: dir,
          encoding: "utf8",
          timeout: CAPTURE_MS + 5000,
        },
      );
      if (snap.error || snap.signal || snap.status !== 0)
        throw new Error(
          `The snapshot failed: ${snap.error?.message || snap.stderr || snap.signal || `exit status ${snap.status}`}`,
        );
    }
    if (!existsSync(join(local, "app.db"))) throw new Error("The snapshot was not copied out.");
    manifest(local);
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
    const backups = (await source.list(app)).filter((name) =>
      /^\d{8}-\d{6}(-[a-f0-9]{12})?$/.test(name),
    );
    const chosen =
      options.backup ?? backups.filter((n) => /-[a-f0-9]{12}$/.test(n)).at(-1) ?? backups.at(-1);
    if (!chosen || !backups.includes(chosen))
      throw new Error(
        `No backup${options.backup ? ` ${options.backup}` : ""} of ${app} at ${options.from}.`,
      );
    await source.load(`${app}/${chosen}`, local);
    if (!existsSync(join(local, "app.db"))) throw new Error("The backup has no database.");
    if (/-[a-f0-9]{12}$/.test(chosen) && !existsSync(join(local, MANIFEST)))
      throw new Error("Versioned backup manifest is missing.");
    if (!verifyBackup(local))
      io.err("Legacy backup: no manifest or checksum verification is available.\n");
    if (options.container) {
      const docker = (args: string[]) => {
        const result = spawnSync("docker", args, { encoding: "utf8" });
        if (result.error || result.signal || result.status !== 0)
          throw new Error(
            `Docker ${args[0]} failed: ${result.error?.message || result.stderr || result.signal || `exit status ${result.status}`}`,
          );
        return result;
      };
      const inspect = docker([
        "inspect",
        "-f",
        '{{.Config.Image}}|{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}',
        options.container,
      ]);
      const [image, volume] = inspect.stdout.trim().split("|");
      if (!image || !volume)
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
    io.err(
      `${error instanceof Error ? error.message : String(error)}\nRestore did not finish; data may already have been replaced.\n`,
    );
    return 1;
  } finally {
    rmSync(local, { recursive: true, force: true });
  }
}
