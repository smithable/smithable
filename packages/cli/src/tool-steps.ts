// The app's own tools run in this process (T991): the route generator, drizzle-kit's API on the
// app's schema, and its migrator, each loaded from the project. Studio holding a secret never
// calls these itself: they run in the project worker (project-worker.ts), a child without them.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  choiceValueSql,
  dropTakenColumn,
  quoteReferences,
  renameColumnSql,
  renameInSnapshot,
  renameModelInSnapshot,
  renameModelSql,
} from "@smithable/adapter-tanstack";
import type { MigrationPlan } from "./generate.js";

/** Where a step says why it failed. */
export interface Say {
  err(text: string): void;
}

/**
 * A package's ES module entry (its exports' "import"), where `resolve` gives the CommonJS one:
 * TanStack's CommonJS build warns of a circular require on every command that loads it.
 */
function esmEntry(from: string, name: string): string {
  const load = createRequire(from);
  const manifest = load.resolve(`${name}/package.json`);
  const entry = JSON.parse(readFileSync(manifest, "utf8")).exports?.["."]?.import;
  const file = typeof entry === "string" ? entry : entry?.default;
  return file ? join(dirname(manifest), file) : load.resolve(name);
}

/**
 * Writes the route tree in this process with the app's own router generator (what `tsr
 * generate` runs; tsr.config.json is read the same way): about 0.05 s instead of 2 s for a
 * process in a sandbox. False if it can't be loaded here, so the caller runs tsr.
 */
export async function routeTree(dir: string, io: Say): Promise<boolean> {
  const root = resolve(dir);
  let generator: string;
  try {
    const cli = createRequire(join(root, "package.json")).resolve(
      "@tanstack/router-cli/package.json",
    );
    generator = esmEntry(cli, "@tanstack/router-generator");
  } catch {
    return false;
  }
  try {
    const { Generator, getConfig } = (await import(pathToFileURL(generator).href)) as {
      Generator: new (options: { config: unknown; root: string }) => { run(): Promise<void> };
      getConfig(inline: object, root: string): unknown;
    };
    await new Generator({ config: getConfig({}, root), root }).run();
    return true;
  } catch (error) {
    // The generator's own reason, before tsr tries the same and usually says less.
    io.err(
      `The route generator failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    return false;
  }
}

/**
 * Creates the migration for an operation's schema change in this process, with the app's own
 * drizzle-kit: its programmatic API gives the same SQL and snapshot as its command line,
 * which costs about 2 s to start in a sandboxed hosted workspace. The files are the ones the
 * command line writes (SQL, snapshot, journal), so drizzle-kit carries on after detach.
 * Renames are the same custom SQL as on the command line. Undefined when this doesn't apply
 * (a project's first migration, a full generate) or didn't work here: the caller then runs
 * the command line.
 */
let schemaVersion = 0;

/**
 * The app's schema, fresh each time (the file has just changed). Node strips its types itself,
 * and a new query string makes a new module while drizzle-orm stays loaded: milliseconds, where
 * tsx takes a quarter of a second (seconds in a sandbox). tsx remains for a schema Node cannot
 * load that way.
 */
async function importSchema(load: NodeJS.Require, path: string): Promise<unknown> {
  const url = pathToFileURL(path).href;
  try {
    return await import(`${url}?v=${++schemaVersion}`);
  } catch {
    const { tsImport } = (await import(pathToFileURL(load.resolve("tsx/esm/api")).href)) as {
      tsImport(url: string, parent: string): Promise<unknown>;
    };
    return tsImport(url, import.meta.url);
  }
}

/**
 * Loads what an operation's tools use (drizzle-kit's API, drizzle-orm through the schema, the
 * router generator) ahead of the first operation, which otherwise pays seconds for it in a
 * sandbox. Studio calls it once it has started; failures only mean no head start.
 */
export async function warmTools(dir: string): Promise<void> {
  const root = resolve(dir);
  const load = createRequire(join(root, "package.json"));
  try {
    load("drizzle-kit/api");
    await importSchema(load, join(root, "src/db/schema.ts"));
    const cli = load.resolve("@tanstack/router-cli/package.json");
    await import(pathToFileURL(esmEntry(cli, "@tanstack/router-generator")).href);
  } catch {}
}

export async function createMigration(
  dir: string,
  migration?: MigrationPlan,
): Promise<boolean | undefined> {
  const root = resolve(dir);
  const meta = join(root, "drizzle", "meta");
  if (!migration || !existsSync(join(meta, "_journal.json"))) return undefined;
  try {
    const load = createRequire(join(root, "package.json"));
    const api = load("drizzle-kit/api") as {
      generateSQLiteDrizzleJson(
        imports: unknown,
        prevId: string,
        casing: string,
      ): Promise<Snapshot>;
      generateSQLiteMigration(prev: Snapshot, cur: Snapshot): Promise<string[]>;
    };
    const journal = JSON.parse(readFileSync(join(meta, "_journal.json"), "utf8")) as {
      entries: { idx: number; version: string; when: number; tag: string; breakpoints: boolean }[];
    };
    const last = journal.entries.at(-1);
    if (!last) return undefined;
    const numbered = (idx: number) => String(idx).padStart(4, "0");
    const prev = JSON.parse(
      readFileSync(join(meta, `${numbered(last.idx)}_snapshot.json`), "utf8"),
    ) as Snapshot;
    const schema = await importSchema(load, join(root, "src/db/schema.ts"));
    const current = await api.generateSQLiteDrizzleJson(schema, prev.id, "snake_case");
    // Renamed models and columns first, as RENAME statements, each on the snapshot as the one
    // before it left it; then what else differs, against that renamed snapshot, so drizzle-kit
    // never sees a rename as a drop and an add. A rename back onto a name a newer column has
    // taken (an older version applied) drops that column first.
    const statements: string[] = [];
    let base = JSON.stringify(prev);
    for (const m of migration.models ?? []) {
      statements.push(...renameModelSql(base, m.from, m.to));
      base = renameModelInSnapshot(base, m.from, m.to);
    }
    for (const r of migration.renames) {
      const taken = dropTakenColumn(base, r.model, r.to, r.reference);
      if (taken) {
        statements.push(...taken.sql);
        base = taken.snapshot;
      }
      statements.push(renameColumnSql(r.model, r.from, r.to, r.reference));
      base = renameInSnapshot(base, r.model, r.from, r.to, r.reference);
    }
    statements.push(
      ...(await api.generateSQLiteMigration(JSON.parse(base) as Snapshot, current)).map(
        quoteReferences,
      ),
      ...valueSql(migration),
    );
    if (statements.length === 0) return true;
    const idx = last.idx + 1;
    const tag = `${numbered(idx)}_${migration.name}`;
    // Keys in the order the command line writes them.
    const snapshot = {
      version: current.version,
      dialect: current.dialect,
      id: current.id,
      prevId: current.prevId,
      tables: current.tables,
      views: current.views,
      enums: current.enums,
      _meta: { schemas: {}, tables: current._meta.tables, columns: current._meta.columns },
      internal: current.internal,
    };
    writeFileSync(
      join(root, "drizzle", `${tag}.sql`),
      statements.join("--> statement-breakpoint\n"),
    );
    writeFileSync(join(meta, `${numbered(idx)}_snapshot.json`), JSON.stringify(snapshot, null, 2));
    journal.entries.push({ idx, version: last.version, when: Date.now(), tag, breakpoints: true });
    writeFileSync(join(meta, "_journal.json"), JSON.stringify(journal, null, 2));
    return true;
  } catch {
    return undefined;
  }
}

/** A drizzle-kit SQLite snapshot, as far as Smithable reads it. */
interface Snapshot {
  version: string;
  dialect: string;
  id: string;
  prevId: string;
  tables: unknown;
  views: unknown;
  enums: unknown;
  _meta: { tables: unknown; columns: unknown };
  internal: unknown;
}

/**
 * Applies pending migrations to the dev database in this process, with the app's own
 * installed Drizzle and SQLite driver, exactly as the kit's src/db/index.ts does at startup
 * (foreign keys off around it, every reference checked after). Starting a process for it
 * costs about 2 s in a sandboxed hosted workspace. False if a migration left broken
 * references; undefined if this didn't work here, so the caller falls back to that process.
 */
export function applyMigrations(dir: string, io: Say): boolean | undefined {
  let sqlite: { pragma(s: string): unknown; close(): void } | undefined;
  try {
    const load = createRequire(join(resolve(dir), "package.json"));
    const Database = load("better-sqlite3");
    const { drizzle } = load("drizzle-orm/better-sqlite3");
    const { migrate } = load("drizzle-orm/better-sqlite3/migrator");
    const data = join(resolve(dir), process.env.DATA_DIR ?? "data");
    mkdirSync(join(data, "db"), { recursive: true });
    sqlite = new Database(join(data, "db", "app.db"));
    sqlite?.pragma("journal_mode = WAL");
    sqlite?.pragma("foreign_keys = OFF");
    migrate(drizzle(sqlite), { migrationsFolder: join(resolve(dir), "drizzle") });
    const broken = sqlite?.pragma("foreign_key_check") as unknown[];
    if (broken.length > 0) {
      io.err(`A migration left ${broken.length} broken references.\n`);
      return false;
    }
    return true;
  } catch {
    return undefined;
  } finally {
    sqlite?.pragma("foreign_keys = ON");
    sqlite?.close();
  }
}

/** The SQL that gives records holding a choice value that goes the new one. */
export function valueSql(migration: MigrationPlan | undefined): string[] {
  return (migration?.values ?? []).map((v) => choiceValueSql(v.model, v.field, v.from, v.to));
}
