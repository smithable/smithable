import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { columnOf, plural } from "@smithable/adapter-tanstack";
import {
  applyOperation,
  type Effect,
  findOperation,
  formatDiagnostic,
  OPERATIONS,
  parseOperationArgs,
  type SpecIR,
  storageOf,
  validateSpec,
} from "@smithable/core";
import { countValues, restoreDatabase, snapshotDatabase } from "./database.js";
import { generate } from "./generate.js";
import { discardChanges, ensureRepository, git, uncommitted } from "./git.js";
import type { Io } from "./io.js";
import { recordRule } from "./rules.js";

const SPEC = "smithable.yml";
const CONTENT = "smithable.content.yml";
const OPLOG = ".smithable/oplog.jsonl";

export interface OpFlags {
  /** Confirms a destructive operation. */
  yes: boolean;
}

/** `smithable op <name> [args…]`: applies an operation, regenerates, migrates and checkpoints. */
export function op(
  dir: string,
  io: Io,
  name: string | undefined,
  values: string[],
  flags: OpFlags,
): number {
  const operation = name === undefined ? undefined : findOperation(name);
  if (!operation) {
    io.err(`${name ? `Unknown operation "${name}". ` : ""}Available operations:\n`);
    for (const o of OPERATIONS)
      io.err(`  ${o.name} ${o.positional.map((p) => `<${p}>`).join(" ")}  ${o.summary}\n`);
    return 2;
  }
  ensureRepository(dir);
  const dirty = uncommitted(dir);
  if (dirty.length > 0) {
    io.err(
      `Commit or discard these changes first, so the operation can be undone on its own:\n${dirty.map((l) => `  ${l}\n`).join("")}`,
    );
    return 1;
  }

  const contentPath = join(dir, CONTENT);
  const files = {
    spec: readFileSync(join(dir, SPEC), "utf8"),
    ...(existsSync(contentPath) ? { content: readFileSync(contentPath, "utf8") } : {}),
  };
  const args = parseOperationArgs(operation, values);
  const result = applyOperation(files, operation.name, args);
  if (!result.ok) {
    io.err(`${result.message}\n`);
    for (const d of result.diagnostics) io.err(`${formatDiagnostic(d)}\n`);
    return 1;
  }
  const before = validateSpec({ path: SPEC, text: files.spec }).ir as SpecIR;
  const after = validateSpec({ path: SPEC, text: result.files.spec }).ir as SpecIR;

  const blocker = requiredButEmpty(dir, before, after, result.effects);
  if (blocker) {
    io.err(`${blocker}\n`);
    return 1;
  }
  if (result.destructive && !flags.yes) {
    io.err(
      `${result.description}: ${dataImpact(dir, result.effects, args)}\nRun again with --yes to apply it.\n`,
    );
    return 1;
  }

  const id = new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").slice(0, 17);
  const snapshot = snapshotDatabase(dir, id);
  const fail = (message: string) => {
    discardChanges(dir);
    if (snapshot) restoreDatabase(dir, id);
    io.err(`${message} Nothing was changed.\n`);
    return 1;
  };

  writeFileSync(join(dir, SPEC), result.files.spec);
  if (result.files.content !== undefined) writeFileSync(contentPath, result.files.content);
  mkdirSync(join(dir, ".smithable"), { recursive: true });
  appendFileSync(
    join(dir, OPLOG),
    `${JSON.stringify({ id, op: operation.name, args, description: result.description })}\n`,
  );
  // Only stored fields have a column to rename; a list of related records stores nothing.
  const renames = result.effects.flatMap((e) =>
    e.kind === "rename-field" && e.storage !== "none"
      ? [{ model: e.model, from: e.from, to: e.to, reference: e.storage === "reference" }]
      : [],
  );
  const code = generate(dir, io, {
    tools: true,
    force: false,
    migration: { name: migrationName(result.description), renames, apply: true },
  });
  if (code !== 0) return fail(`Regenerating the app failed.`);

  for (const effect of result.effects) {
    if (effect.kind === "rule-identified") recordRule(dir, effect.rule, effect.text);
  }
  git(dir, ["add", "-A"]);
  const message = `smithable: ${result.description}\n\nSmithable-Op: ${JSON.stringify({ op: operation.name, args })}\nSmithable-Snapshot: ${snapshot ? id : "none"}\n`;
  const commit = git(dir, ["commit", "-q", "-m", message]);
  if (!commit.ok) return fail(`Could not commit the change: ${commit.out}`);
  io.out(`${result.description}. Undo with: smithable undo\n`);
  return 0;
}

/** "Add field phone (phone) to Customer" → "add_field_phone_phone_to_customer". */
function migrationName(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

/**
 * Stops changes the migration could not apply to existing rows: a field becoming required
 * while some rows have no value, or a new required field without a default on a table that
 * already has rows.
 */
function requiredButEmpty(
  dir: string,
  before: SpecIR,
  after: SpecIR,
  effects: Effect[],
): string | undefined {
  // A renamed field is not new: look it up under its old name.
  const oldName = new Map(
    effects.flatMap((e) =>
      e.kind === "rename-field" ? [[`${e.model}.${e.to}`, e.from] as const] : [],
    ),
  );
  for (const model of after.models) {
    for (const field of model.fields) {
      if (!field.required || field.default !== undefined || storageOf(field) === "none") continue;
      const name = oldName.get(`${model.name}.${field.name}`) ?? field.name;
      const old = before.models
        .find((m) => m.name === model.name)
        ?.fields.find((f) => f.name === name);
      if (old?.required) continue;
      const reference = storageOf(field) === "reference";
      const noun = (n: number) =>
        n === 1 ? model.name.toLowerCase() : plural(model.name).toLowerCase();
      if (!old) {
        const rows = countValues(dir, columnOf(model.name, "id").table, "id")?.total ?? 0;
        if (rows > 0) {
          return `There ${rows === 1 ? "is" : "are"} already ${rows} ${noun(rows)}, and a new required field needs a value for each. Add ${field.name} as optional first (without "!"), fill it in, then make it required${reference ? "" : ", or give it a default"}.`;
        }
        continue;
      }
      const { table, column } = columnOf(model.name, name, reference);
      const counts = countValues(dir, table, column);
      const empty = counts ? counts.total - counts.filled : 0;
      if (empty > 0) {
        return `${empty} ${noun(empty)} ${empty === 1 ? "has" : "have"} no ${field.name}. Fill ${empty === 1 ? "it" : "them"} in${reference ? "" : ", or give the field a default,"} before making it required.`;
      }
    }
  }
  return undefined;
}

/** What a destructive change does to existing data, in plain words. */
function dataImpact(dir: string, effects: Effect[], args: Record<string, unknown>): string {
  const removed = effects.find((e) => e.kind === "remove-field");
  const model = String(removed?.model ?? args.model);
  const field = String(removed?.field ?? args.field);
  const { table, column } = columnOf(model, field, removed?.storage === "reference");
  const counts = countValues(dir, table, column);
  const values = counts
    ? `${counts.filled} of ${counts.total} ${plural(model).toLowerCase()} have a value for it`
    : "";
  if (removed) return `this deletes the ${field} column${values ? `; ${values}` : ""}.`;
  return `this converts ${model}.${field} to a different type; values that do not fit are lost${values ? ` (${values})` : ""}.`;
}
