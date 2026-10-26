// Smithable app kit: opens the SQLite database under DATA_DIR and applies pending migrations.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { dataDir, demo, visitor } from "#/kit/visitor";
import * as schema from "./schema";

mkdirSync(join(dataDir, "db"), { recursive: true });

const sqlite = new Database(join(dataDir, "db", "app.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const own = drizzle(sqlite, { schema, casing: "snake_case" });
/** The database: the app's own, or in a demo the request's visitor's copy (src/kit/visitor.ts). */
export const db: typeof own = demo ? visitorDb() : own;

// A new version with a migration to apply first keeps a copy of the database as it is
// (db/before-migration.db, the last one only): whoever deploys the app puts it back if this
// version then fails to come up, so a rollback never runs old code on a changed schema.
function pendingMigrations(): boolean {
  const has = sqlite
    .prepare("select 1 from sqlite_master where type = 'table' and name = '__drizzle_migrations'")
    .get();
  if (!has) return false; // a new database: nothing to keep
  const applied = (
    sqlite.prepare("select count(*) as n from __drizzle_migrations").get() as { n: number }
  ).n;
  const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
    entries: unknown[];
  };
  return journal.entries.length > applied;
}
if (pendingMigrations()) {
  const copy = join(dataDir, "db", "before-migration.db");
  if (existsSync(copy)) rmSync(copy);
  sqlite.exec(`VACUUM INTO '${copy.replace(/'/g, "''")}'`);
}

// Some changes rebuild a table (e.g. making a column required). SQLite only lets a migration do
// that with foreign keys off, and ignores switching them off inside the migration's transaction;
// so they are off around it, and every reference is checked afterwards.
sqlite.pragma("foreign_keys = OFF");
try {
  migrate(own, { migrationsFolder: "drizzle" });
  const broken = sqlite.pragma("foreign_key_check") as unknown[];
  if (broken.length > 0) throw new Error(`A migration left ${broken.length} broken references.`);
} finally {
  sqlite.pragma("foreign_keys = ON");
}

/** Open visitor databases at once, the least recently used closed first. */
const OPEN = 100;
/** A visitor idle this long is forgotten, their copy deleted. */
const IDLE = 60 * 60_000;
/** At most this many visitors' copies are kept; the least recently seen go first. */
const KEPT = 500;

/**
 * A demo's database (DEMO_VISITORS=1): every call goes to the request's visitor's copy, made from
 * the app's own (as the seed and the hourly reset leave it) on their first request, kept open for
 * the next; outside a request, the app's own. Visitors idle an hour are deleted.
 */
function visitorDb(): typeof own {
  const root = join(dataDir, "visitors");
  const open = new Map<string, { sqlite: Database.Database; db: typeof own }>();
  const seen = new Map<string, number>();
  const close = (id: string) => {
    open.get(id)?.sqlite.close();
    open.delete(id);
  };
  const forVisitor = (id: string): typeof own => {
    seen.set(id, Date.now());
    const kept = open.get(id);
    if (kept) {
      // The latest used last, so the least recently used are first in line to close.
      open.delete(id);
      open.set(id, kept);
      return kept.db;
    }
    const file = join(root, id, "app.db");
    if (!existsSync(file)) {
      mkdirSync(join(root, id), { recursive: true });
      sqlite.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
    }
    const handle = new Database(file);
    handle.pragma("journal_mode = WAL");
    handle.pragma("foreign_keys = ON");
    const entry = { sqlite: handle, db: drizzle(handle, { schema, casing: "snake_case" }) };
    open.set(id, entry);
    for (const old of open.keys()) {
      if (open.size <= OPEN) break;
      close(old);
    }
    return entry.db;
  };
  setInterval(() => {
    if (!existsSync(root)) return;
    const visitors = readdirSync(root)
      .map((id) => ({ id, at: seen.get(id) ?? statSync(join(root, id)).mtimeMs }))
      .sort((a, b) => b.at - a.at);
    visitors.forEach(({ id, at }, i) => {
      if (i < KEPT && Date.now() - at < IDLE) return;
      close(id);
      seen.delete(id);
      rmSync(join(root, id), { recursive: true, force: true });
    });
  }, 5 * 60_000).unref();
  return new Proxy(own, {
    get(_, key) {
      const id = visitor();
      const target = id ? forVisitor(id) : own;
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}
