import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  dropTakenColumn,
  dropTakenTablesSql,
  generateApp,
  inTurn,
  quoteReferences,
  renameColumnSql,
  renameInSnapshot,
  renameModelInSnapshot,
  renameModelSql,
  STACK_PROFILE,
} from "@smithable/adapter-tanstack";
import { YamlEditor } from "@smithable/core";
import { cardFiles } from "./card.js";
import { exec, execQuiet, type Io, lap, tool } from "./io.js";
import { templateKitRevision } from "./maintenance.js";
import { taggedContent } from "./picture-style.js";
import { contextFacts } from "./privacy-review.js";
import { stepsFor } from "./project-worker.js";
import { treeText } from "./secrets.js";
import { valueSql } from "./tool-steps.js";
import { changeTree, type TreeChange, writeTreeFile } from "./tree-files.js";
import { loadSpec } from "./validate.js";
import { VERSION } from "./version.js";
import { installing } from "./vite-cache.js";

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
    return (JSON.parse(treeText(join(dir, "smithable.lock"))) as { stackProfile?: string })
      .stackProfile;
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
  /** Set by the tools: the migration was applied to the dev database, or applying it failed. */
  outcome?: "applied" | "failed";
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
  const { ir, auth, content, ux, themes, plugins, samples, people } = loadSpec(dir, io);
  if (!ir || !auth) return 1;
  const packages = declaredPackages(dir);
  if (typeof packages === "string") {
    io.err(`${packages}\n`);
    return 1;
  }
  const contextPath = join(dir, "smithable.context.yml");
  const files = generateApp(ir, {
    smithableVersion: VERSION,
    kitRevision: templateKitRevision,
    // The same reading as the privacy page's review (privacy-review.ts), so they agree.
    ...contextFacts(existsSync(contextPath) ? treeText(contextPath) : undefined),
    ...(Object.keys(packages).length ? { packages } : {}),
    auth,
    ...(plugins?.length ? { plugins } : {}),
    customPages: customPages(dir),
    cardFiles: cardFiles(dir, content ?? {}),
    ...(content ? { content: taggedContent(dir, content) } : {}),
    ...(ux ? { ux } : {}),
    ...(themes ? { themes } : {}),
    ...(samples ? { samples } : {}),
    ...(people?.length ? { people } : {}),
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
  const changes: TreeChange[] = [];
  let written = 0;
  const changed: string[] = [];
  for (const file of files) {
    const path = join(dir, file.path);
    // Scaffold and custom files are created once and then belong to the project.
    if (file.zone === "scaffold" || file.zone === "custom") {
      if (existsSync(path)) continue;
      changes.push({ path, data: file.content });
      written++;
      changed.push(file.path);
      continue;
    }
    next.files[file.path] = hash(file.content);
    if (existsSync(path) && readFileSync(path, "utf8") === file.content) continue;
    changes.push({ path, data: file.content });
    written++;
    changed.push(file.path);
  }
  // Delete only what the generator no longer produces; scaffold files are never removed.
  const produced = new Set(files.map((f) => f.path));
  const removed = Object.keys(previous.files).filter((path) => !produced.has(path));
  for (const path of removed) changes.push({ path: join(dir, path), data: null });
  changes.push({ path: join(dir, RECORD), data: serializeRecord(next) });
  // One child for all of them where the project has its own user.
  changeTree(changes);
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
  const workspace = new YamlEditor(treeText(path));
  for (const retired of STACK_PROFILE.retiredOverrides)
    if (workspace.has(["overrides", retired])) workspace.removeAndPrune(["overrides", retired], 0);
  for (const [dependency, version] of Object.entries(STACK_PROFILE.overrides)) {
    if (workspace.has(["overrides", dependency])) {
      if (workspace.get(["overrides", dependency]) !== version)
        workspace.set(["overrides", dependency], version);
    } else if (workspace.has(["overrides"])) workspace.add(["overrides"], dependency, version);
    else workspace.add([], "overrides", { [dependency]: version });
  }
  if (workspace.text === treeText(path)) return false;
  writeTreeFile(path, workspace.text);
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
  // In this process, or in the project worker when this one holds a secret (T991).
  const steps = stepsFor(dir, io);
  lap("generate");
  if (install && !installing(dir, () => run(["install", "--silent"]))) return 1;
  lap("install");
  if (schema) {
    const made = await steps.createMigration(migration);
    if (made === undefined && !migrate(dir, migration, run)) return 1;
  }
  lap("drizzle-kit");
  // In this process it costs well under 0.1 s.
  if (!(await steps.routeTree()) && !run(["exec", "tsr", "generate"])) return 1;
  lap("route generator");
  if (schema && migration?.apply) {
    // Here, or (undefined) by the app's own database module, in a process of its own.
    const applied = (await steps.applyMigrations()) ?? run(["exec", "tsx", "src/db/index.ts"]);
    migration.outcome = applied ? "applied" : "failed";
    if (!applied) return 1;
    lap("migration");
  }
  return 0;
}

/**
 * Creates the migration for a schema change: drizzle-kit, with renames as custom SQL, when
 * drizzle-kit's API does not load here (tool-steps' createMigration does it in this process).
 * What goes while something else comes (goneFirst) is left to drizzle-kit here, which asks
 * whether they are one renamed and so fails, closed, without a terminal.
 */
function migrate(
  dir: string,
  migration: MigrationPlan | undefined,
  run: (args: string[]) => boolean,
): boolean {
  // A renamed model becomes a custom migration with RENAME TABLE (and its indexes under their
  // new names), the snapshot describing the renamed tables, so drizzle-kit never sees a dropped
  // table and a new one.
  for (const renamed of inTurn(migration?.models ?? [])) {
    if (
      !run(["exec", "drizzle-kit", "generate", "--custom", "--name", migration?.name ?? "rename"])
    )
      return false;
    const tag = latestMigration(dir);
    const snapshot = join(dir, "drizzle", "meta", `${tag.slice(0, 4)}_snapshot.json`);
    // A newer model on the name goes first (an older version applied).
    const taken = dropTakenTablesSql(treeText(snapshot), renamed.from, renamed.to);
    const before = taken?.snapshot ?? treeText(snapshot);
    writeTreeFile(
      join(dir, "drizzle", `${tag}.sql`),
      [...(taken?.sql ?? []), ...renameModelSql(before, renamed.from, renamed.to)].join(
        "--> statement-breakpoint\n",
      ),
    );
    writeTreeFile(snapshot, renameModelInSnapshot(before, renamed.from, renamed.to));
  }
  // A rename becomes a custom migration with RENAME COLUMN, so drizzle-kit never sees a
  // drop plus an add (which it would ask about) and the data is kept.
  for (const rename of inTurn(migration?.renames ?? [], (r) => r.model)) {
    if (
      !run(["exec", "drizzle-kit", "generate", "--custom", "--name", migration?.name ?? "rename"])
    )
      return false;
    const tag = latestMigration(dir);
    const snapshot = join(dir, "drizzle", "meta", `${tag.slice(0, 4)}_snapshot.json`);
    // A rename back onto a name a newer column has taken drops that column first.
    const taken = dropTakenColumn(treeText(snapshot), rename.model, rename.to, rename.reference);
    writeTreeFile(
      join(dir, "drizzle", `${tag}.sql`),
      [
        ...(taken?.sql ?? []),
        renameColumnSql(rename.model, rename.from, rename.to, rename.reference),
      ].join("--> statement-breakpoint\n"),
    );
    writeTreeFile(
      snapshot,
      renameInSnapshot(
        taken?.snapshot ?? treeText(snapshot),
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
    writeTreeFile(file, quoteReferences(treeText(file)));
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
    const sql = treeText(file);
    writeTreeFile(
      file,
      [sql.trim() ? sql.trimEnd() : "", ...updates]
        .filter(Boolean)
        .join("--> statement-breakpoint\n"),
    );
  }
  return true;
}

/**
 * The libraries smithable.context.yml adds for custom code ("packages: { chart.js: 4.4.1 }"),
 * or why they can't be used: the stack profile's own packages are Smithable's to keep in step.
 */
function declaredPackages(dir: string): Record<string, string> | string {
  const path = join(dir, "smithable.context.yml");
  if (!existsSync(path)) return {};
  const packages = new YamlEditor(treeText(path)).get(["packages"]);
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
  const journal = JSON.parse(treeText(join(dir, "drizzle", "meta", "_journal.json"))) as {
    entries: { tag: string }[];
  };
  const last = journal.entries[journal.entries.length - 1];
  if (!last) throw new Error("No migrations found.");
  return last.tag;
}

export function readRecord(dir: string): FileRecord {
  try {
    const saved = JSON.parse(treeText(join(dir, RECORD))) as {
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
