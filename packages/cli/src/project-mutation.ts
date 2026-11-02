// Serialize cooperating writers across requests and processes. This database holds no app data.
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const turns = new Map<string, Promise<void>>();
export class ProjectBusyError extends Error {}

function lock(root: string, wait: number): DatabaseSync {
  // Coordination only, never durable project state or a tracked file. Do not unlink lock files:
  // other processes may hold their inodes. OS locks release on crash/reboot automatically.
  const data = join(tmpdir(), `sm-project-mutation-locks-${process.getuid?.() ?? "user"}`);
  mkdirSync(data, { recursive: true, mode: 0o700 });
  const owner = lstatSync(data);
  if (
    !owner.isDirectory() ||
    owner.isSymbolicLink() ||
    (process.getuid && (owner.uid !== process.getuid() || (owner.mode & 0o077) !== 0))
  )
    throw new Error("The project coordination folder is not private to this user.");
  const path = join(data, `${createHash("sha256").update(root).digest("hex")}.db`);
  if (existsSync(path) && (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink()))
    throw new Error("The project coordination database must be a regular file.");
  const database = new DatabaseSync(path);
  try {
    database.exec(`PRAGMA busy_timeout = ${wait}`);
    database.exec("BEGIN IMMEDIATE");
    return database;
  } catch {
    database.close();
    throw new ProjectBusyError("Another process is changing this project. Retry when it finishes.");
  }
}

export async function withProjectMutation<T>(
  dir: string,
  work: (root: string) => Promise<T>,
): Promise<T> {
  const root = realpathSync(dir);
  const prior = turns.get(root) ?? Promise.resolve();
  let release!: () => void;
  const held = new Promise<void>((done) => {
    release = done;
  });
  const tail = prior.then(() => held);
  turns.set(root, tail);
  await prior;
  let database: DatabaseSync | undefined;
  try {
    database = lock(root, 10000);
    try {
      const result = await work(root);
      database.exec("COMMIT");
      return result;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  } finally {
    database?.close();
    release();
    if (turns.get(root) === tail) turns.delete(root);
  }
}

/** Preserve synchronous Undo's public contract. It must refuse promptly, never block its own
 * event loop while an asynchronous writer needs that loop to release the lock. */
export function withProjectMutationSync<T>(dir: string, work: (root: string) => T): T {
  const root = realpathSync(dir);
  if (turns.has(root))
    throw new ProjectBusyError("Another request is changing this project. Retry when it finishes.");
  const database = lock(root, 0);
  try {
    const result = work(root);
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}
