import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { generateApp, renameColumnSql, renameInSnapshot } from "@smithable/adapter-tanstack";
import { exec, type Io } from "./io.js";
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
  const { ir, auth, content, ux } = loadSpec(dir, io);
  if (!ir || !auth) return 1;
  const files = generateApp(ir, {
    smithableVersion: VERSION,
    auth,
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
  for (const file of files) {
    const path = join(dir, file.path);
    // Scaffold and custom files are created once and then belong to the project.
    if (file.zone === "scaffold" || file.zone === "custom") {
      if (existsSync(path)) continue;
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.content);
      written++;
      continue;
    }
    next.files[file.path] = hash(file.content);
    if (existsSync(path) && readFileSync(path, "utf8") === file.content) continue;
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.content);
    written++;
  }
  // Delete only what the generator no longer produces; scaffold files are never removed.
  const produced = new Set(files.map((f) => f.path));
  const removed = Object.keys(previous.files).filter((path) => !produced.has(path));
  for (const path of removed) rmSync(join(dir, path), { force: true });
  mkdirSync(join(dir, ".smithable"), { recursive: true });
  writeFileSync(join(dir, RECORD), `${JSON.stringify(next, null, 2)}\n`);
  io.out(`Generated ${files.length} files (${written} changed, ${removed.length} removed).\n`);

  if (!flags.tools) return 0;
  return runTools(dir, io, flags.migration);
}

/** Installs dependencies, then lets the app's own tools create migrations and the route tree. */
export function runTools(dir: string, io: Io, migration?: MigrationPlan): number {
  const run = (args: string[]) => {
    const code = exec("pnpm", args, dir);
    if (code !== 0) io.err(`\`pnpm ${args.join(" ")}\` failed.\n`);
    return code === 0;
  };
  if (!run(["install", "--silent"])) return 1;
  // A rename becomes a custom migration with RENAME COLUMN, so drizzle-kit never sees a
  // drop plus an add (which it would ask about) and the data is kept.
  for (const rename of migration?.renames ?? []) {
    if (
      !run(["exec", "drizzle-kit", "generate", "--custom", "--name", migration?.name ?? "rename"])
    )
      return 1;
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
  if (!run(["exec", "drizzle-kit", "generate", ...name])) return 1;
  if (!run(["exec", "tsr", "generate"])) return 1;
  // Applied by the app's own database module, which handles migrations that rebuild a table.
  if (migration?.apply && !run(["exec", "tsx", "src/db/index.ts"])) return 1;
  return 0;
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
    return JSON.parse(readFileSync(join(dir, RECORD), "utf8")) as FileRecord;
  } catch {
    return { files: {} };
  }
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
