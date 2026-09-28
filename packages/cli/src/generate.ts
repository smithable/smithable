import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import {
  generateApp,
  renameColumnSql,
  renameInSnapshot,
  STACK_PROFILE,
} from "@smithable/adapter-tanstack";
import { YamlEditor } from "@smithable/core";
import { exec, type Io, lap, tool } from "./io.js";
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
  /** Apply the migration to the dev database now. */
  apply: boolean;
}

/** `smithable generate [dir]`: writes the app for the spec in `dir`. */
export function generate(dir: string, io: Io, flags: GenerateFlags): number {
  // A new stack profile changes libraries and the kit under custom code: only through
  // `smithable upgrade`, which checks the app and can be undone as one change.
  const profile = projectProfile(dir);
  if (profile && profile !== STACK_PROFILE.id && !flags.upgrade) {
    io.err(
      `This app uses stack profile ${profile}; this Smithable generates ${STACK_PROFILE.id}. Run "smithable upgrade" to move it: it checks the app and can be undone.\n`,
    );
    return 1;
  }
  const { ir, auth, content, ux, plugins } = loadSpec(dir, io);
  if (!ir || !auth) return 1;
  const files = generateApp(ir, {
    smithableVersion: VERSION,
    auth,
    ...(plugins?.length ? { plugins } : {}),
    customPages: customPages(dir),
    ...(content ? { content } : {}),
    ...(ux ? { ux } : {}),
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
export function runTools(
  dir: string,
  io: Io,
  migration?: MigrationPlan,
  changed?: string[],
): number {
  const needs = (test: (path: string) => boolean) => !changed || changed.some(test);
  const install =
    needs((p) => p === "package.json" || p === "pnpm-workspace.yaml") ||
    !existsSync(join(dir, "node_modules"));
  const schema = needs((p) => p === "src/db/schema.ts") || (migration?.renames.length ?? 0) > 0;

  const run = (args: string[]) => {
    const [command, rest] =
      args[0] === "exec" ? tool(dir, args[1] as string, args.slice(2)) : ["pnpm", args];
    const code = exec(command, rest, dir);
    if (code !== 0) io.err(`\`pnpm ${args.join(" ")}\` failed.\n`);
    return code === 0;
  };
  lap("generate");
  if (install && !run(["install", "--silent"])) return 1;
  lap("install");
  if (schema && !migrate(dir, migration, run)) return 1;
  lap("drizzle-kit");
  // Always: skipping it when no route file changed leaves a request to the Studio preview
  // hanging after an Undo restarted the dev server (test:studio's "click the email field"
  // step); running it touches the route tree and Vite recovers. Ruled out so far: the
  // in-process migration, the preview warm-up, Undo not regenerating the route tree.
  if (!run(["exec", "tsr", "generate"])) return 1;
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
  return run(["exec", "drizzle-kit", "generate", ...name]);
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
