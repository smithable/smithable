import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** The development database, as the app's src/db/index.ts opens it. */
export function databasePath(dir: string): string {
  return join(dir, "data", "db", "app.db");
}

function snapshotPath(dir: string, id: string): string {
  return join(dir, "data", ".smithable", "snapshots", `${id}.db`);
}

/** Saves a consistent copy of the dev database (if there is one). Returns whether it did. */
export function snapshotDatabase(dir: string, id: string): boolean {
  if (!existsSync(databasePath(dir))) return false;
  const target = snapshotPath(dir, id);
  mkdirSync(join(target, ".."), { recursive: true });
  rmSync(target, { force: true });
  const db = new DatabaseSync(databasePath(dir));
  try {
    db.exec(`VACUUM INTO '${target.replaceAll("'", "''")}'`);
  } finally {
    db.close();
  }
  return true;
}

/** Puts a snapshot back as the dev database. Returns whether the snapshot existed. */
export function restoreDatabase(dir: string, id: string): boolean {
  const source = snapshotPath(dir, id);
  if (!existsSync(source)) return false;
  const target = databasePath(dir);
  for (const suffix of ["-wal", "-shm"]) rmSync(`${target}${suffix}`, { force: true });
  copyFileSync(source, target);
  return true;
}

/**
 * Deletes the snapshots undo can no longer reach: all but those `keep` names (the snapshots of
 * the latest changes). Returns how many it deleted.
 */
export function pruneSnapshots(dir: string, keep: Set<string>): number {
  const folder = join(dir, "data", ".smithable", "snapshots");
  if (!existsSync(folder)) return 0;
  const old = readdirSync(folder).filter((f) => f.endsWith(".db") && !keep.has(f.slice(0, -3)));
  for (const f of old) rmSync(join(folder, f), { force: true });
  return old.length;
}

/** How many rows of a table have a value (or no value) in a column; undefined without a database. */
export function countValues(
  dir: string,
  table: string,
  column: string,
): { total: number; filled: number } | undefined {
  if (!existsSync(databasePath(dir))) return undefined;
  const db = new DatabaseSync(databasePath(dir), { readOnly: true });
  try {
    const row = db
      .prepare(`SELECT count(*) AS total, count("${column}") AS filled FROM "${table}"`)
      .get() as { total: number; filled: number };
    return { total: Number(row.total), filled: Number(row.filled) };
  } catch {
    return undefined;
  } finally {
    db.close();
  }
}
