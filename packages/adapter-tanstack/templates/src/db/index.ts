// Smithable app kit: opens the SQLite database under DATA_DIR and applies pending migrations.
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

const dataDir = process.env.DATA_DIR ?? "data";
mkdirSync(join(dataDir, "db"), { recursive: true });

const sqlite = new Database(join(dataDir, "db", "app.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema, casing: "snake_case" });

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
  migrate(db, { migrationsFolder: "drizzle" });
  const broken = sqlite.pragma("foreign_key_check") as unknown[];
  if (broken.length > 0) throw new Error(`A migration left ${broken.length} broken references.`);
} finally {
  sqlite.pragma("foreign_keys = ON");
}
