import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { columnOf, plural } from "@smithable/adapter-tanstack";
import {
  applyOperation,
  type Effect,
  findOperation,
  formatDiagnostic,
  kebab,
  type OperationArgs,
  operationsFor,
  parseOperationArgs,
  type SpecIR,
  storageOf,
  validateSpec,
  YamlEditor,
} from "@smithable/core";
import { countValues, pruneSnapshots, restoreDatabase, snapshotDatabase } from "./database.js";
import { generate } from "./generate.js";
import { discardChanges, ensureRepository, git, uncommittedRefusal } from "./git.js";
import { type Io, lap } from "./io.js";
import { loadPlugins } from "./plugins.js";
import { recordRule } from "./rules.js";
import { projectThemes } from "./validate.js";

const SPEC = "smithable.yml";
const CONTENT = "smithable.content.yml";
const AUTH = "smithable.auth.yml";
const UX = "smithable.ux.yml";
const OPLOG = ".smithable/oplog.jsonl";

export interface OpFlags {
  /** Confirms a destructive operation. */
  yes: boolean;
  /** Called through MCP: messages name the tools instead of CLI commands. */
  mcp?: boolean;
  /** An extra commit trailer, e.g. what the model that proposed the change used. */
  trailer?: string;
}

/** `smithable op <name> [args…]`: applies an operation, regenerates, migrates and checkpoints. */
export function op(
  dir: string,
  io: Io,
  name: string | undefined,
  values: string[],
  flags: OpFlags,
): Promise<number> | number {
  const plugins = loadPlugins(dir);
  const operation = name === undefined ? undefined : findOperation(name, plugins);
  if (!operation) {
    io.err(`${name ? `Unknown operation "${name}". ` : ""}Available operations:\n`);
    for (const o of operationsFor(plugins))
      io.err(`  ${o.name} ${o.positional.map((p) => `<${p}>`).join(" ")}  ${o.summary}\n`);
    return 2;
  }
  // A word "@path" stands for that file's text (a theme file for addTheme).
  const words = values.map((w) =>
    w.startsWith("@") && existsSync(w.slice(1)) ? readFileSync(w.slice(1), "utf8") : w,
  );
  return runOperation(dir, io, operation.name, parseOperationArgs(operation, words), flags);
}

/**
 * Applies an operation given its arguments, for the CLI and the MCP server alike: checks,
 * edits the spec, regenerates, migrates, and commits a checkpoint that `undo` reverts.
 */
export async function runOperation(
  dir: string,
  io: Io,
  name: string,
  args: OperationArgs,
  flags: OpFlags,
): Promise<number> {
  const started = Date.now();
  const plugins = loadPlugins(dir);
  const operation = findOperation(name, plugins);
  if (!operation) {
    io.err(`Unknown operation "${name}".\n`);
    return 2;
  }
  lap("start");
  ensureRepository(dir);
  lap("repository");
  const refused = uncommittedRefusal(dir, "so the operation can be undone on its own");
  lap("uncommitted");
  if (refused) {
    io.err(refused);
    return 1;
  }

  const contentPath = join(dir, CONTENT);
  const authPath = join(dir, AUTH);
  const uxPath = join(dir, UX);
  const contextPath = join(dir, "smithable.context.yml");
  const files = {
    spec: readFileSync(join(dir, SPEC), "utf8"),
    ...(existsSync(contentPath) ? { content: readFileSync(contentPath, "utf8") } : {}),
    ...(existsSync(authPath) ? { auth: readFileSync(authPath, "utf8") } : {}),
    ...(existsSync(uxPath) ? { ux: readFileSync(uxPath, "utf8") } : {}),
    ...(existsSync(contextPath) ? { context: readFileSync(contextPath, "utf8") } : {}),
    plugins,
    themes: projectThemes(dir),
  };
  const result = applyOperation(files, operation.name, args);
  if (!result.ok) {
    io.err(`${result.message}\n`);
    for (const d of result.diagnostics) io.err(`${formatDiagnostic(d)}\n`);
    return 1;
  }
  const before = validateSpec({ path: SPEC, text: files.spec }, { plugins: files.plugins })
    .ir as SpecIR;
  const after = validateSpec({ path: SPEC, text: result.files.spec }, { plugins: files.plugins })
    .ir as SpecIR;

  lap("apply and validate");
  const blocker = requiredButEmpty(dir, before, after, result.effects);
  lap("required but empty");
  if (blocker) {
    io.err(`${blocker}\n`);
    return 1;
  }
  if (result.destructive && !flags.yes) {
    io.err(
      `${result.description}: ${dataImpact(dir, result.effects, args)}\nRun again with ${flags.mcp ? "confirm: true" : "--yes"} to apply it.\n`,
    );
    return 1;
  }

  const id = new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").slice(0, 17);
  const snapshot = snapshotDatabase(dir, id);
  lap("database snapshot");
  const fail = (message: string) => {
    discardChanges(dir);
    if (snapshot) restoreDatabase(dir, id);
    io.err(`${message} Nothing was changed.\n`);
    return 1;
  };

  // From the first write to the commit: whatever throws, the files and the database go back.
  try {
    writeFileSync(join(dir, SPEC), result.files.spec);
    if (result.files.content !== undefined) writeFileSync(contentPath, result.files.content);
    if (result.files.auth !== undefined) writeFileSync(authPath, result.files.auth);
    if (result.files.ux !== undefined) writeFileSync(uxPath, result.files.ux);
    if (result.files.context !== undefined) writeFileSync(contextPath, result.files.context);
    for (const file of result.added) {
      mkdirSync(dirname(join(dir, file.path)), { recursive: true });
      writeFileSync(join(dir, file.path), file.text);
    }
    followInSamples(dir, result.effects);
    mkdirSync(join(dir, ".smithable"), { recursive: true });
    appendFileSync(
      join(dir, OPLOG),
      `${JSON.stringify({ id, op: operation.name, args: operation.name === "editSpec" ? {} : args, description: result.description })}\n`,
    );
    // Only stored fields have a column to rename; a list of related records stores nothing.
    const renames = result.effects.flatMap((e) =>
      e.kind === "rename-field" && e.storage !== "none"
        ? [{ model: e.model, from: e.from, to: e.to, reference: e.storage === "reference" }]
        : [],
    );
    const code = await generate(dir, io, {
      tools: true,
      onlyChanged: true,
      force: false,
      migration: { name: migrationName(result.description), renames, apply: true },
    });
    if (code !== 0) return fail(`Regenerating the app failed.`);
    lap("generate and tools");

    for (const effect of result.effects) {
      if (effect.kind === "rule-identified") recordRule(dir, effect.rule, effect.text);
    }
    git(dir, ["add", "-A"]);
    // A whole edited spec is in the diff; the trailer stays short.
    const recorded = operation.name === "editSpec" ? {} : args;
    const message = `smithable: ${result.description}\n\nSmithable-Op: ${JSON.stringify({ op: operation.name, args: recorded })}\nSmithable-Snapshot: ${snapshot ? id : "none"}\nSmithable-Duration: ${Date.now() - started} ms\n${flags.trailer ? `${flags.trailer}\n` : ""}`;
    const commit = git(dir, ["commit", "-q", "-m", message]);
    if (!commit.ok) return fail(`Could not commit the change: ${commit.out}`);
    lap("commit");
    // Undo goes back through recent changes: their snapshots stay, older ones go.
    const recent = git(dir, [
      "log",
      "-50",
      "--format=%(trailers:key=Smithable-Snapshot,valueonly)",
    ]);
    pruneSnapshots(
      dir,
      new Set(
        recent.out
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean),
      ),
    );
    io.out(
      `${result.description}. Undo with: ${flags.mcp ? "smithable_undo" : "smithable undo"}\n`,
    );
    if (operation.name === "addAction") io.out(actionNote(String(args.action)));
    return 0;
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    return fail(
      `The change stopped halfway (${why}), so it was rolled back${snapshot ? ` to the database snapshot ${id}` : ""}.`,
    );
  }
}

/** A new custom action does nothing until its code is written: where, and what it can look like. */
export function actionNote(action: string): string {
  return `This action needs its code: src/custom/actions/${kebab(action)}.ts (until then it says it is not implemented). For example, to send a mail:
  import { sendMail } from "#/kit/mail";
  await sendMail({ to: "orders@example.com", subject: "New order", text: JSON.stringify(input) });
`;
}

/**
 * A renamed or removed field follows into the project's sample records (samples/<Model>.yml),
 * as it does into the companions: the key is renamed or dropped in every record, comments kept.
 */
function followInSamples(dir: string, effects: Effect[]): void {
  for (const effect of effects) {
    if (effect.kind !== "rename-field" && effect.kind !== "remove-field") continue;
    const file = join(dir, "samples", `${effect.model}.yml`);
    if (!existsSync(file)) continue;
    const editor = new YamlEditor(readFileSync(file, "utf8"));
    const rows = editor.get([]);
    const key = effect.kind === "rename-field" ? effect.from : effect.field;
    for (let i = 0; Array.isArray(rows) && i < rows.length; i++) {
      if (!editor.has([String(i), key])) continue;
      if (effect.kind === "rename-field") editor.renameKey([String(i), key], effect.to);
      else editor.remove([String(i), key]);
    }
    writeFileSync(file, editor.text);
  }
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
export function requiredButEmpty(
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
