// Smithable app kit: opens the SQLite database under DATA_DIR and applies pending migrations.
import { mkdirSync } from "node:fs";
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
