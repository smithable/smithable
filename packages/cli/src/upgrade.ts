import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STACK_PROFILE } from "@smithable/adapter-tanstack";
import { migrateSpec, writeActionGrants, writeNamedBy, writeUniqueScopes } from "@smithable/core";
import { migrationConsequences, migrationKind, type SchemaSnapshot } from "./fixes.js";
import { generate, projectProfile } from "./generate.js";
import { discardChanges, ensureRepository, git, uncommitted, uncommittedRefusal } from "./git.js";
import type { Io } from "./io.js";
import { loadSpec } from "./validate.js";
import { VERSION } from "./version.js";

/**
 * `smithable upgrade [dir]` (ARCHITECTURE §14): moves the app to this Smithable's spec version
 * and stack profile through the normal change pipeline. It is kept only when the type check
 * and the tests pass; a contract that no longer fits the app's own code is reported, with
 * the places it breaks, and never fixed silently.
 */
export async function upgrade(dir: string, io: Io): Promise<number> {
  ensureRepository(dir);
  const refused = uncommittedRefusal(dir, "so the upgrade can be undone on its own");
  if (refused) {
    io.err(refused);
    return 1;
  }
  const from = projectProfile(dir) ?? "unknown";
  const specPath = join(dir, "smithable.yml");
  let migrated: ReturnType<typeof migrateSpec>;
  try {
    migrated = migrateSpec(readFileSync(specPath, "utf8"));
  } catch (error) {
    io.err(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
  if (migrated.applied.length) writeFileSync(specPath, migrated.text);
  // Where each unique value is unique, written out once (docs/design/uniqueness.md), so a later
  // change of roles never moves an index.
  const loaded = loadSpec(dir, io);
  // A title the old rule read from a field's name (docs/design/inference.md): said outright.
  const titles = loaded.ir
    ? writeNamedBy(readFileSync(specPath, "utf8"), loaded.ir)
    : { text: "", written: [] as string[] };
  if (titles.written.length) writeFileSync(specPath, titles.text);
  const scopes =
    loaded.ir && loaded.auth
      ? writeUniqueScopes(readFileSync(specPath, "utf8"), loaded.ir, loaded.auth)
      : { text: "", written: [] as string[] };
  if (scopes.written.length) writeFileSync(specPath, scopes.text);
  // A role's `actions: all` where it would now widen (docs/design/actions.md): the list instead.
  const authPath = join(dir, "smithable.auth.yml");
  const grants =
    loaded.ir && loaded.auth && existsSync(authPath)
      ? writeActionGrants(readFileSync(authPath, "utf8"), loaded.ir, loaded.auth)
      : { text: "", written: [] as string[] };
  if (grants.written.length) writeFileSync(authPath, grants.text);
  // The migrations the upgrade writes, for what they do to the build before it (fixes.ts).
  const drizzle = join(dir, "drizzle");
  const sqlFiles = () =>
    existsSync(drizzle) ? readdirSync(drizzle).filter((f) => f.endsWith(".sql")) : [];
  const before = new Set(sqlFiles());
  if ((await generate(dir, io, { tools: true, force: false, upgrade: true })) !== 0) {
    discardChanges(dir);
    io.err("The upgrade was undone.\n");
    return 1;
  }
  for (const [what, args] of [
    ["type check", ["typecheck"]],
    ["tests", ["test"]],
  ] as const) {
    const run = spawnSync("pnpm", [...args], { cwd: dir, encoding: "utf8", maxBuffer: 1 << 26 });
    if (run.status !== 0) {
      const output = `${run.stdout}${run.stderr}`;
      // The app's own code is where a changed contract breaks: show it first.
      const custom = output.split("\n").filter((l) => l.includes("src/custom/"));
      discardChanges(dir);
      io.err(
        `The ${what} fails after upgrading from ${from} to ${STACK_PROFILE.id}, so the upgrade was undone.\n` +
          (custom.length
            ? `Your code in src/custom/ no longer fits what Smithable generates:\n${custom.map((l) => `  ${l.trim()}\n`).join("")}Update that code for ${STACK_PROFILE.id}, commit it, and run smithable upgrade again.\n`
            : `${output.trim().split("\n").slice(-20).join("\n")}\n`),
      );
      return 1;
    }
  }
  if (uncommitted(dir).length === 0) {
    io.out(`Already up to date (stack profile ${STACK_PROFILE.id}).\n`);
    return 0;
  }
  const migration = migrationKind(
    sqlFiles()
      .filter((f) => !before.has(f))
      .map((f) => readFileSync(join(drizzle, f), "utf8")),
  );
  // What a destructive one loses, from drizzle-kit's snapshots before and after it (A 246).
  const consequences = migration === "destructive" ? schemaLosses(drizzle, before) : undefined;
  git(dir, ["add", "-A"]);
  git(dir, [
    "commit",
    "-q",
    "-m",
    `smithable: Upgrade to stack profile ${STACK_PROFILE.id}\n\nSmithable-Upgrade: ${JSON.stringify({ from, to: STACK_PROFILE.id, smithable: VERSION, spec: migrated.applied, titles: titles.written, unique: scopes.written, grants: grants.written, migration, ...(consequences ? { consequences } : {}) })}\n`,
  ]);
  io.out(
    `Upgraded from stack profile ${from} to ${STACK_PROFILE.id}; the type check and tests pass. Undo with: smithable undo\n${
      migration === "none"
        ? ""
        : migration === "additive"
          ? "The database change only adds: the build before this one still runs on it.\n"
          : "The database change is not only additive: the build before this one may not run on it.\n"
    }`,
  );
  return 0;
}

/**
 * The losses of the migrations the upgrade added: drizzle-kit's snapshot from before them against
 * the newest; none to say (undefined) when either is missing, so the service keeps it held.
 */
function schemaLosses(drizzle: string, before: Set<string>) {
  const meta = join(drizzle, "meta");
  if (!existsSync(meta)) return undefined;
  const snapshots = readdirSync(meta)
    .filter((f) => /^\d{4}_snapshot\.json$/.test(f))
    .sort();
  const kept = [...before].map((f) => f.slice(0, 4)).sort();
  const last = kept.at(-1);
  const old = last && snapshots.find((f) => f.startsWith(last));
  const newest = snapshots.at(-1);
  if (!old || !newest || old === newest) return undefined;
  const read = (f: string) => JSON.parse(readFileSync(join(meta, f), "utf8")) as SchemaSnapshot;
  // A snapshot that cannot be read: nothing to say, so the service keeps the update held.
  try {
    return migrationConsequences(read(old), read(newest));
  } catch {
    return undefined;
  }
}
