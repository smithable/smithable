// Serialize cooperating writers across requests and processes. This database holds no app data.
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const turns = new Map<string, Promise<void>>();
/** Another writer holds the project: this change is refused for now, and may be asked again. */
export class ProjectBusyError extends Error {}
/**
 * The lock itself cannot be set up (its folder or file is not what it must be, the database does
 * not open): asking again changes nothing until someone fixes it, so not a ProjectBusyError.
 */
export class ProjectLockError extends Error {}

/**
 * Takes the project's turn. Every way the lock cannot be taken is a refusal of this one change,
 * said with its reason (an error the callers answer with), never an error that would fail every
 * operation the same way without saying why.
 */
function lock(root: string, wait: number): DatabaseSync {
  // Coordination only, never durable project state or a tracked file. Do not unlink lock files:
  // other processes may hold their inodes. OS locks release on crash/reboot automatically.
  const data = join(tmpdir(), `sm-project-mutation-locks-${process.getuid?.() ?? "user"}`);
  const path = join(data, `${createHash("sha256").update(root).digest("hex")}.db`);
  let database: DatabaseSync;
  try {
    mkdirSync(data, { recursive: true, mode: 0o700 });
    const owner = lstatSync(data);
    if (
      !owner.isDirectory() ||
      owner.isSymbolicLink() ||
      (process.getuid && (owner.uid !== process.getuid() || (owner.mode & 0o077) !== 0))
    )
      throw new Error(
        `the coordination folder ${data} is not a private folder of this user (a symbolic link, another owner or open permissions). Fix or remove it, then retry.`,
      );
    // lstat, not exists: a dangling symbolic link is there too, and is refused.
    const file = lstatSync(path, { throwIfNoEntry: false });
    if (file && (!file.isFile() || file.isSymbolicLink()))
      throw new Error(
        `the coordination file ${path} is not a regular file. Remove it, then retry.`,
      );
    database = new DatabaseSync(path);
  } catch (error) {
    throw new ProjectLockError(
      `This project cannot be changed right now: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
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
