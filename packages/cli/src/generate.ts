import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  choiceValueSql,
  generateApp,
  quoteReferences,
  renameColumnSql,
  renameInSnapshot,
  renameModelInSnapshot,
  renameModelSql,
  STACK_PROFILE,
} from "@smithable/adapter-tanstack";
import { analyticsOf, YamlEditor } from "@smithable/core";
import { exec, execQuiet, type Io, lap, tool } from "./io.js";
import { loadSpec } from "./validate.js";
import { VERSION } from "./version.js";

const RECORD = ".smithable/files.json";

interface FileRecord {
  /** Smithable-owned files and the hash of what Smithable last wrote. */
  files: Record<string, string>;
}

export interface GenerateFlags {
  /** Install dependencies and run the app's own generators (migrations, route tree). */
  tools: boolean;
  /** Overwrite hand-edited Smithable-owned files. */
  force: boolean;
  /** Hand-edited files that may be overwritten anyway, because their edit moved elsewhere. */
  overwrite?: string[];
  /** How to create the migration; operations know about renames and apply it right away. */
  migration?: MigrationPlan;
  /** Move the app to this Smithable's stack profile (`smithable upgrade`, which checks it). */
  upgrade?: boolean;
  /**
   * The packages are in place already and are not this project's to install: its node_modules
   * is a link to another project's with the same packages (an app made beside the one it will
   * replace, replace.ts).
   */
  installed?: boolean;
  /**
   * Run only the tools whose inputs changed (an operation): each one starts a process, which
   * costs 1 to 2 s in a sandboxed hosted workspace.
   */
  onlyChanged?: boolean;
}

/** The stack profile the project was last generated with, from smithable.lock. */
export function projectProfile(dir: string): string | undefined {
  try {
    return (
      JSON.parse(readFileSync(join(dir, "smithable.lock"), "utf8")) as { stackProfile?: string }
    ).stackProfile;
  } catch {
    return undefined;
  }
}

export interface MigrationPlan {
  /** Name for the migration file, e.g. add_field_phone_to_customer. */
  name: string;
  /** Stored fields to rename; `reference` for a reference column (customer_id). */
  renames: { model: string; from: string; to: string; reference: boolean }[];
  /** Models renamed: their tables are renamed, with the kit's tables beside them. */
  models?: { from: string; to: string }[];
  /** A choice field's values that go, and what the records holding them get ("" clears). */
  values?: { model: string; field: string; from: string; to: string }[];
  /** Apply the migration to the dev database now. */
  apply: boolean;
}

/** `smithable generate [dir]`: writes the app for the spec in `dir`. */
export async function generate(dir: string, io: Io, flags: GenerateFlags): Promise<number> {
  // A new stack profile changes libraries and the kit under custom code: only through
  // `smithable upgrade`, which checks the app and can be undone as one change.
  const profile = projectProfile(dir);
  if (profile && profile !== STACK_PROFILE.id && !flags.upgrade) {
    io.err(
      `This app uses stack profile ${profile}; this Smithable generates ${STACK_PROFILE.id}. Run "smithable upgrade" to move it: it checks the app and can be undone.\n`,
    );
    return 1;
  }
  const { ir, auth, content, ux, themes, plugins, samples } = loadSpec(dir, io);
  if (!ir || !auth) return 1;
  const packages = declaredPackages(dir);
  if (typeof packages === "string") {
    io.err(`${packages}\n`);
    return 1;
  }
  const contextPath = join(dir, "smithable.context.yml");
  const analytics = existsSync(contextPath)
    ? analyticsOf(readFileSync(contextPath, "utf8"))
    : undefined;
  const files = generateApp(ir, {
    smithableVersion: VERSION,
    ...(analytics ? { analytics } : {}),
    ...(Object.keys(packages).length ? { packages } : {}),
    auth,
    ...(plugins?.length ? { plugins } : {}),
    customPages: customPages(dir),
    ...(content ? { content } : {}),
    ...(ux ? { ux } : {}),
    ...(themes ? { themes } : {}),
    ...(samples ? { samples } : {}),
  });
  const previous = readRecord(dir);

  // Never overwrite or delete a Smithable-owned file that was edited by hand.
  const edited = Object.entries(previous.files)
    .filter(([path, hash]) => existsSync(join(dir, path)) && hashFile(join(dir, path)) !== hash)
    .map(([path]) => path)
    .filter((path) => !flags.overwrite?.includes(path));
  if (edited.length > 0 && !flags.force) {
    io.err(
      `These files are owned by Smithable but were edited by hand:\n${edited.map((p) => `  ${p}\n`).join("")}` +
        "Move the changes into smithable.yml or src/custom/, or run with --force to overwrite them.\n" +
        edited
          .flatMap((path) => {
            // A page's list route: the edit can move into a custom page.
            const route = /^src\/routes(?:\/(.+))?\/index\.tsx$/.exec(path);
            const page = route && ir.pages.find((p) => p.route === `/${route[1] ?? ""}`);
            return page
              ? [`To keep the edit of ${path}: smithable customize page:${page.id}\n`]
              : [];
          })
          .join(""),
    );
    return 1;
  }

  const next: FileRecord = { files: {} };
  let written = 0;
  const changed: string[] = [];
  for (const file of files) {
    const path = join(dir, file.path);
    // Scaffold and custom files are created once and then belong to the project.
    if (file.zone === "scaffold" || file.zone === "custom") {
      if (existsSync(path)) continue;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.content);
      written++;
      changed.push(file.path);
      continue;
    }
    next.files[file.path] = hash(file.content);
    if (existsSync(path) && readFileSync(path, "utf8") === file.content) continue;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.content);
    written++;
    changed.push(file.path);
  }
  // Delete only what the generator no longer produces; scaffold files are never removed.
  const produced = new Set(files.map((f) => f.path));
  const removed = Object.keys(previous.files).filter((path) => !produced.has(path));
  for (const path of removed) rmSync(join(dir, path), { force: true });
  mkdirSync(join(dir, ".smithable"), { recursive: true });
  writeFileSync(join(dir, RECORD), serializeRecord(next));
  if (applyOverrides(dir)) changed.push("pnpm-workspace.yaml");
  io.out(`Generated ${files.length} files (${written} changed, ${removed.length} removed).\n`);

  if (!flags.tools) return 0;
  return runTools(
    dir,
    io,
    flags.migration,
    flags.onlyChanged ? [...changed, ...removed] : undefined,
    flags.installed,
  );
}

/**
 * Keeps the stack profile's security overrides in pnpm-workspace.yaml. The file belongs to
 * the project (pnpm edits it too): only these entries are Smithable's, the rest is left alone.
 */
function applyOverrides(dir: string): boolean {
  const path = join(dir, "pnpm-workspace.yaml");
  if (!existsSync(path)) return false;
  const workspace = new YamlEditor(readFileSync(path, "utf8"));
  for (const retired of STACK_PROFILE.retiredOverrides)
    if (workspace.has(["overrides", retired])) workspace.removeAndPrune(["overrides", retired], 0);
  for (const [dependency, version] of Object.entries(STACK_PROFILE.overrides)) {
    if (workspace.has(["overrides", dependency])) {
      if (workspace.get(["overrides", dependency]) !== version)
        workspace.set(["overrides", dependency], version);
    } else if (workspace.has(["overrides"])) workspace.add(["overrides"], dependency, version);
    else workspace.add([], "overrides", { [dependency]: version });
  }
  if (workspace.text === readFileSync(path, "utf8")) return false;
  writeFileSync(path, workspace.text);
  return true;
}

/**
 * Installs dependencies, then lets the app's own tools create migrations and the route tree.
 * Given the files a change wrote or removed, only the tools whose inputs changed run.
 */
export async function runTools(
  dir: string,
  io: Io,
  migration?: MigrationPlan,
  changed?: string[],
  installed = false,
): Promise<number> {
  const needs = (test: (path: string) => boolean) => !changed || changed.some(test);
  const install =
    !installed &&
    (needs((p) => p === "package.json" || p === "pnpm-workspace.yaml") ||
      !existsSync(join(dir, "node_modules")));
  const schema =
    needs((p) => p === "src/db/schema.ts") ||
    (migration?.renames.length ?? 0) > 0 ||
    (migration?.models?.length ?? 0) > 0;

  const run = (args: string[]) => {
    const [command, rest] =
      args[0] === "exec" ? tool(dir, args[1] as string, args.slice(2)) : ["pnpm", args];
    // drizzle-kit lists every table it read: said only if it fails.
    const code = (args[1] === "drizzle-kit" ? execQuiet : exec)(command, rest, dir);
    if (code !== 0) io.err(`\`pnpm ${args.join(" ")}\` failed.\n`);
    return code === 0;
  };
  lap("generate");
  if (install && !run(["install", "--silent"])) return 1;
  lap("install");
  if (schema) {
    const made = await createMigration(dir, migration);
    if (made === undefined && !migrate(dir, migration, run)) return 1;
  }
  lap("drizzle-kit");
  // In this process it costs well under 0.1 s.
  if (!(await routeTree(dir, io)) && !run(["exec", "tsr", "generate"])) return 1;
  lap("route generator");
  if (schema && migration?.apply) {
    const applied = applyMigrations(dir, io);
    if (applied === false) return 1;
    // Otherwise by the app's own database module, in a process of its own.
    if (applied === undefined && !run(["exec", "tsx", "src/db/index.ts"])) return 1;
    lap("migration");
  }
  return 0;
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
async function routeTree(dir: string, io: Io): Promise<boolean> {
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

async function createMigration(
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
    const statements = migration.models?.length
      ? migration.models.flatMap((m) => renameModelSql(JSON.stringify(prev), m.from, m.to))
      : migration.renames.length
        ? migration.renames.map((r) => renameColumnSql(r.model, r.from, r.to, r.reference))
        : [
            ...(await api.generateSQLiteMigration(prev, current)).map(quoteReferences),
            ...valueSql(migration),
          ];
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
function applyMigrations(dir: string, io: Io): boolean | undefined {
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

/** Creates the migration for a schema change: drizzle-kit, with renames as custom SQL. */
function migrate(
  dir: string,
  migration: MigrationPlan | undefined,
  run: (args: string[]) => boolean,
): boolean {
  // A renamed model becomes a custom migration with RENAME TABLE (and its indexes under their
  // new names), the snapshot describing the renamed tables, so drizzle-kit never sees a dropped
  // table and a new one.
  for (const renamed of migration?.models ?? []) {
    if (
      !run(["exec", "drizzle-kit", "generate", "--custom", "--name", migration?.name ?? "rename"])
    )
      return false;
    const tag = latestMigration(dir);
    const snapshot = join(dir, "drizzle", "meta", `${tag.slice(0, 4)}_snapshot.json`);
    const before = readFileSync(snapshot, "utf8");
    writeFileSync(
      join(dir, "drizzle", `${tag}.sql`),
      renameModelSql(before, renamed.from, renamed.to).join("--> statement-breakpoint\n"),
    );
    writeFileSync(snapshot, renameModelInSnapshot(before, renamed.from, renamed.to));
  }
  // A rename becomes a custom migration with RENAME COLUMN, so drizzle-kit never sees a
  // drop plus an add (which it would ask about) and the data is kept.
  for (const rename of migration?.renames ?? []) {
    if (
      !run(["exec", "drizzle-kit", "generate", "--custom", "--name", migration?.name ?? "rename"])
    )
      return false;
    const tag = latestMigration(dir);
    writeFileSync(
      join(dir, "drizzle", `${tag}.sql`),
      renameColumnSql(rename.model, rename.from, rename.to, rename.reference),
    );
    const snapshot = join(dir, "drizzle", "meta", `${tag.slice(0, 4)}_snapshot.json`);
    writeFileSync(
      snapshot,
      renameInSnapshot(
        readFileSync(snapshot, "utf8"),
        rename.model,
        rename.from,
        rename.to,
        rename.reference,
      ),
    );
  }
  const name = migration ? ["--name", migration.name] : [];
  // The new migration, if any, with its references quoted (quoteReferences).
  const newest = () => {
    try {
      return latestMigration(dir);
    } catch {
      return undefined;
    }
  };
  const before = newest();
  if (!run(["exec", "drizzle-kit", "generate", ...name])) return false;
  let tag = newest();
  if (tag && tag !== before) {
    const file = join(dir, "drizzle", `${tag}.sql`);
    writeFileSync(file, quoteReferences(readFileSync(file, "utf8")));
  }
  // Records holding a choice value that goes get the new one: in the new migration, or in one of
  // its own when the schema did not change (a choice is stored as text).
  const updates = valueSql(migration);
  if (updates.length) {
    if (!tag || tag === before) {
      if (!run(["exec", "drizzle-kit", "generate", "--custom", ...name])) return false;
      tag = newest();
    }
    const file = join(dir, "drizzle", `${tag}.sql`);
    const sql = readFileSync(file, "utf8");
    writeFileSync(
      file,
      [sql.trim() ? sql.trimEnd() : "", ...updates]
        .filter(Boolean)
        .join("--> statement-breakpoint\n"),
    );
  }
  return true;
}

/** The SQL that gives records holding a choice value that goes the new one. */
function valueSql(migration: MigrationPlan | undefined): string[] {
  return (migration?.values ?? []).map((v) => choiceValueSql(v.model, v.field, v.from, v.to));
}

/**
 * The libraries smithable.context.yml adds for custom code ("packages: { chart.js: 4.4.1 }"),
 * or why they can't be used: the stack profile's own packages are Smithable's to keep in step.
 */
function declaredPackages(dir: string): Record<string, string> | string {
  const path = join(dir, "smithable.context.yml");
  if (!existsSync(path)) return {};
  const packages = new YamlEditor(readFileSync(path, "utf8")).get(["packages"]);
  if (packages === undefined) return {};
  if (typeof packages !== "object" || packages === null || Array.isArray(packages))
    return 'smithable.context.yml: "packages" must map package names to versions.';
  const managed = new Set([
    ...Object.keys(STACK_PROFILE.dependencies),
    ...Object.keys(STACK_PROFILE.devDependencies),
    ...Object.keys(STACK_PROFILE.fonts),
    ...Object.keys(STACK_PROFILE.markdown),
  ]);
  for (const name of Object.keys(packages))
    if (managed.has(name))
      return `smithable.context.yml: "${name}" is part of the stack profile; Smithable keeps its version.`;
  return Object.fromEntries(Object.entries(packages).map(([k, v]) => [k, String(v)]));
}

/** The tag of the newest migration, e.g. "0003_rename_notes". */
function latestMigration(dir: string): string {
  const journal = JSON.parse(
    readFileSync(join(dir, "drizzle", "meta", "_journal.json"), "utf8"),
  ) as {
    entries: { tag: string }[];
  };
  const last = journal.entries[journal.entries.length - 1];
  if (!last) throw new Error("No migrations found.");
  return last.tag;
}

export function readRecord(dir: string): FileRecord {
  try {
    const saved = JSON.parse(readFileSync(join(dir, RECORD), "utf8")) as {
      files: Record<string, string> | { path: string; sha256: string }[];
    };
    // A list of { path, sha256 }; records written before 2026-09-28 map paths to hashes.
    return {
      files: Array.isArray(saved.files)
        ? Object.fromEntries(saved.files.map((f) => [f.path, f.sha256]))
        : saved.files,
    };
  } catch {
    return { files: {} };
  }
}

/**
 * The record as { path, sha256 } entries: a path like "auth.ts" next to a long hash looks
 * like an API key to secret scanners, and a finding must be avoided, not suppressed.
 */
function serializeRecord(record: FileRecord): string {
  const files = Object.entries(record.files).map(([path, sha256]) => ({ path, sha256 }));
  return `${JSON.stringify({ files }, null, 2)}\n`;
}

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function hashFile(path: string): string {
  return hash(readFileSync(path, "utf8"));
}

/** Pages with their own component in src/custom/pages/<page>.tsx. */
export function customPages(dir: string): string[] {
  const pages = join(dir, "src", "custom", "pages");
  if (!existsSync(pages)) return [];
  return readdirSync(pages)
    .filter((f) => f.endsWith(".tsx"))
    .map((f) => f.slice(0, -4))
    .sort();
}
