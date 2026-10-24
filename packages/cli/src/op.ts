import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { columnOf, plural } from "@smithable/adapter-tanstack";
import {
  applyOperation,
  applyOperations,
  type Effect,
  editAsRename,
  findOperation,
  formatDiagnostic,
  kebab,
  type OperationArgs,
  OperationError,
  operationsFor,
  parseOperationArgs,
  type SpecIR,
  storageOf,
  translationPath,
  validateAuth,
  validateContent,
  validateSpec,
  YamlEditor,
} from "@smithable/core";
import {
  countValue,
  countValues,
  pruneSnapshots,
  restoreDatabase,
  snapshotDatabase,
} from "./database.js";
import { generate } from "./generate.js";
import { discardChanges, ensureRepository, git, uncommittedRefusal } from "./git.js";
import {
  dropImport,
  importOwner,
  insertImport,
  keepImport,
  prepareImport,
  refusalText,
} from "./import.js";
import { type Io, lap, lapFrom } from "./io.js";
import { loadPlugins } from "./plugins.js";
import { afterFailure, recordFailure } from "./report.js";
import { recordRule } from "./rules.js";
import { projectThemes, projectTranslations } from "./validate.js";

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
  /**
   * A change that sets the project up for its owner (the hosted service making the person who
   * claimed a workspace its administrator), not one of the owner's own: the history does not
   * show it and undo passes over it.
   */
  setup?: boolean;
  /** Who imported records belong to (a user id or email); else the first admin who signed in. */
  owner?: string;
  /** The trace id of the request that asked for it (Studio's, from the front door), for a report. */
  trace?: string;
  /** The caller offers a report of a failure itself (Studio, with its log). */
  reportLater?: boolean;
  /**
   * Files the change brings with it, by their path in the project (a logo Studio was given):
   * written with the change and committed in it, so an undo takes them back too.
   */
  files?: { path: string; bytes: Uint8Array }[];
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
  let args: ReturnType<typeof parseOperationArgs>;
  try {
    args = parseOperationArgs(operation, words);
  } catch (error) {
    // A word no argument takes, said with what to write instead.
    if (!(error instanceof OperationError)) throw error;
    io.err(`${error.message}\n`);
    return 2;
  }
  // A file to import named on the command line is the person's own choice, wherever it is: its
  // text goes in. A path that comes any other way (Studio, MCP, a model) must be in the project.
  if (
    operation.name === "importRecords" &&
    typeof args.from === "string" &&
    args.text === undefined
  ) {
    const file = resolve(dir, args.from);
    if (!existsSync(file) || !statSync(file).isFile()) {
      io.err(`There is no file ${args.from}.\n`);
      return 1;
    }
    args = { ...args, text: readFileSync(file, "utf8") };
  }
  return runOperation(dir, io, operation.name, args, flags);
}

/**
 * What applyAndCheckpoint returns when Smithable failed at a change it took on: the result was
 * not a valid file, the app did not regenerate, or it stopped halfway. That is worth a report.
 * A refusal in the operation's own words (a name that does not fit, records in the way,
 * uncommitted edits) is the person's to act on, and is not.
 */
const FAILED = -1;

/**
 * Applies an operation given its arguments, for the CLI and the MCP server alike: checks,
 * edits the spec, regenerates, migrates, and commits a checkpoint that `undo` reverts.
 */
/**
 * A change given as the files it ends with, not as an operation: the undo of an earlier change
 * (undo.ts), whose files are the change's commit reverted. It goes through the same pipeline as
 * an operation: validated, written, regenerated, migrated forward and committed, with a data
 * loss asking first.
 */
export interface FilesPlan {
  /** Each editable file's new text, or null for one the change takes away. */
  files: Partial<Record<"spec" | "auth" | "content" | "ux" | "context", string | null>>;
  /** The commit's subject (the trace reads it) and the lines of its body before the trailers. */
  subject: string;
  body: string;
  /** What the change is, for the log and the answer ("Undid: …"). */
  description: string;
  /** The operation recorded for the change, in the Smithable-Op trailer. */
  recorded: { op: string; args: Record<string, unknown> };
}

export async function runFilesChange(
  dir: string,
  io: Io,
  plan: FilesPlan,
  flags: OpFlags,
): Promise<number> {
  return runOperation(dir, io, plan.recorded.op, plan.recorded.args, flags, plan);
}

export async function runOperation(
  dir: string,
  io: Io,
  name: string,
  args: OperationArgs,
  flags: OpFlags,
  plan?: FilesPlan,
): Promise<number> {
  // What it says is kept, so that a failure can be reported (report.ts).
  const said: string[] = [];
  const kept: Io = {
    out: (text) => {
      said.push(text);
      io.out(text);
    },
    err: (text) => {
      said.push(text);
      io.err(text);
    },
  };
  const code = await applyAndCheckpoint(dir, kept, name, args, flags, plan);
  if (code !== FAILED) return code;
  recordFailure(dir, name, args, said.join(""), flags.trace);
  if (!flags.reportLater) await afterFailure(dir, io);
  return 1;
}

async function applyAndCheckpoint(
  dir: string,
  io: Io,
  name: string,
  args: OperationArgs,
  flags: OpFlags,
  plan?: FilesPlan,
): Promise<number> {
  const started = Date.now();
  lapFrom();
  const plugins = loadPlugins(dir);
  // "batch": a list of operations as one change (args.operations), the wizard's edited proposal.
  const batch =
    name === "batch" ? (args.operations as { op: string; args: OperationArgs }[]) : undefined;
  if (batch !== undefined && !Array.isArray(batch)) {
    io.err("batch needs operations: a list of { op, args }.\n");
    return 2;
  }
  let operation = plan || batch ? undefined : findOperation(name, plugins);
  if (!plan && !batch && !operation) {
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
    translations: projectTranslations(dir),
  };
  // An edit of the whole spec that only renames a key is the rename operation (core does the
  // same inside applyOperation); recorded as that, so the history says what happened.
  if (operation?.name === "editSpec" && typeof args.text === "string" && !args.file) {
    const rename = editAsRename(files.spec, args.text);
    const renamer = rename && findOperation(rename.op, plugins);
    if (rename && renamer) {
      operation = renamer;
      args = rename.args;
    }
  }
  const result = plan
    ? planResult(files, plan)
    : batch
      ? applyOperations(files, batch)
      : applyOperation(files, operation?.name ?? name, args);
  if (!result.ok) {
    io.err(`${result.message}\n`);
    for (const d of result.diagnostics) io.err(`${formatDiagnostic(d)}\n`);
    return result.diagnostics.length ? FAILED : 1;
  }
  const before = validateSpec({ path: SPEC, text: files.spec }, { plugins: files.plugins })
    .ir as SpecIR;
  const after = validateSpec({ path: SPEC, text: result.files.spec }, { plugins: files.plugins })
    .ir as SpecIR;

  lap("apply and validate");
  // A plan's data loss: the stored fields the files no longer have.
  const lost = plan ? lostFields(before, after) : [];
  const destructive = plan ? lost.length > 0 : result.destructive;
  const blocker =
    requiredButEmpty(dir, before, after, result.effects) ??
    choicesInUse(dir, before, after, result.effects);
  lap("required but empty");
  if (blocker) {
    io.err(`${blocker}\n`);
    return 1;
  }
  // An import reads its file and looks its references up before anything is written: a dry
  // run, or a file with problems, stops here with every one of them.
  const importing = result.effects.find((e) => e.kind === "import-records");
  const auth = files.auth ? validateAuth({ path: AUTH, text: files.auth }, before).auth : undefined;
  const prepared =
    importing &&
    prepareImport(
      dir,
      importing,
      before,
      files.content
        ? validateContent({ path: CONTENT, text: files.content }, before).content
        : undefined,
    );
  const owner = prepared && auth ? importOwner(dir, auth, flags.owner) : null;
  if (prepared && importing) {
    if ((flags.owner || process.env.SMITHABLE_IMPORT_OWNER) && !owner)
      prepared.refusals.push({
        line: 0,
        message: `No user "${flags.owner ?? process.env.SMITHABLE_IMPORT_OWNER}" has signed in to the app.`,
      });
    prepared.shown += `\n${owner ? `They will belong to ${owner.email}.` : "They will belong to no one (no admin has signed in yet)."}`;
    if (prepared.refusals.length || importing.dryRun) {
      const problems = prepared.refusals.length
        ? `\n\nNothing ${importing.dryRun ? "would be" : "was"} imported:\n${refusalText(prepared.refusals)}`
        : "\n\nA dry run: nothing was added.";
      (prepared.refusals.length ? io.err : io.out)(`${prepared.shown}${problems}\n`);
      return prepared.refusals.length ? 1 : 0;
    }
  }
  if (destructive && !flags.yes) {
    io.err(
      `${result.description}: ${plan ? `this deletes the ${lost.join(", ")} ${lost.length === 1 ? "column" : "columns"} and the values in ${lost.length === 1 ? "it" : "them"}.` : dataImpact(dir, result.effects, args)}\nRun again with ${flags.mcp ? "confirm: true" : "--yes"} to apply it.\n`,
    );
    return 1;
  }

  const id = new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").slice(0, 17);
  const snapshot = snapshotDatabase(dir, id);
  lap("database snapshot");
  const fail = (message: string) => {
    discardChanges(dir);
    if (snapshot) restoreDatabase(dir, id);
    if (prepared) dropImport(dir, id);
    io.err(`${message} Nothing was changed.\n`);
    return FAILED;
  };

  // From the first write to the commit: whatever throws, the files and the database go back.
  try {
    writeFileSync(join(dir, SPEC), result.files.spec);
    if (result.files.content !== undefined) writeFileSync(contentPath, result.files.content);
    if (result.files.auth !== undefined) writeFileSync(authPath, result.files.auth);
    if (result.files.ux !== undefined) writeFileSync(uxPath, result.files.ux);
    if (result.files.context !== undefined) writeFileSync(contextPath, result.files.context);
    for (const [language, text] of Object.entries(result.files.translations ?? {}))
      writeFileSync(join(dir, translationPath(language)), text);
    for (const path of result.removed) rmSync(join(dir, path), { force: true });
    for (const file of [...result.added, ...(flags.files ?? [])]) {
      mkdirSync(dirname(join(dir, file.path)), { recursive: true });
      writeFileSync(join(dir, file.path), "text" in file ? file.text : file.bytes);
    }
    followInSamples(dir, result.effects);
    // The imported file is kept beside the checkpoint; the log names it instead of holding it.
    const recordedArgs = plan
      ? plan.recorded.args
      : prepared && operation?.name === "importRecords"
        ? { ...args, text: undefined, from: keepImport(dir, id, prepared.text) }
        : operation?.name === "editSpec"
          ? { ...(args.file ? { file: args.file } : {}) }
          : args;
    const recordedName = plan ? plan.recorded.op : (operation?.name ?? name);
    mkdirSync(join(dir, ".smithable"), { recursive: true });
    appendFileSync(
      join(dir, OPLOG),
      `${JSON.stringify({ id, op: recordedName, args: recordedArgs, description: result.description })}\n`,
    );
    // Only stored fields have a column to rename; a list of related records stores nothing.
    // A renamed model keeps its rows: its tables are renamed, never dropped and made anew.
    const models = result.effects.flatMap((e) =>
      e.kind === "rename-model" ? [{ from: e.from, to: e.to }] : [],
    );
    const renames = result.effects.flatMap((e) =>
      e.kind === "rename-field" && e.storage !== "none"
        ? [{ model: e.model, from: e.from, to: e.to, reference: e.storage === "reference" }]
        : [],
    );
    // Records holding a choice value that goes get what the change says.
    const values = result.effects.flatMap((e) =>
      e.kind === "change-field" && e.renamed
        ? Object.entries(e.renamed).map(([from, to]) => ({
            model: e.model,
            field: e.field,
            from,
            to,
          }))
        : [],
    );
    const code = await generate(dir, io, {
      tools: true,
      onlyChanged: true,
      force: false,
      migration: { name: migrationName(result.description), renames, values, models, apply: true },
    });
    if (code !== 0) return fail(`Regenerating the app failed.`);
    lap("generate and tools");

    for (const effect of result.effects) {
      if (effect.kind === "rule-identified") recordRule(dir, effect.rule, effect.text);
    }
    if (prepared && auth) insertImport(dir, prepared, before, auth, owner?.id ?? null);
    git(dir, ["add", "-A"]);
    // A whole edited spec is in the diff; the trailer stays short.
    const recorded = recordedArgs;
    const message = `${plan ? plan.subject : `smithable: ${result.description}`}\n\n${plan ? `${plan.body}\n` : ""}Smithable-Op: ${JSON.stringify({ op: recordedName, args: recorded })}\nSmithable-Snapshot: ${snapshot ? id : "none"}\nSmithable-Duration: ${Date.now() - started} ms\n${flags.setup ? "Smithable-Setup: yes\n" : ""}${flags.trailer ? `${flags.trailer}\n` : ""}`;
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
      `${result.description}${prepared ? `: ${prepared.rows.length} added` : ""}. Undo with: ${flags.mcp ? "smithable_undo" : "smithable undo"}\n`,
    );
    if (operation?.name === "addAction" && !args.on) io.out(actionNote(String(args.action)));
    return 0;
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    return fail(
      `The change stopped halfway (${why}), so it was rolled back${snapshot ? ` to the database snapshot ${id}` : ""}.`,
    );
  }
}

/** A plan's files as an operation's result: the texts given over the project's, a removed one out. */
function planResult(
  files: Parameters<typeof applyOperation>[0],
  plan: FilesPlan,
): ReturnType<typeof applyOperation> {
  const next = { ...files };
  const removed: string[] = [];
  const paths = {
    spec: SPEC,
    auth: AUTH,
    content: CONTENT,
    ux: UX,
    context: "smithable.context.yml",
  } as const;
  for (const [key, text] of Object.entries(plan.files) as [keyof typeof paths, string | null][]) {
    if (text === null) {
      if (key !== "spec") delete next[key];
      removed.push(paths[key]);
    } else next[key] = text;
  }
  return {
    ok: true,
    files: next,
    added: [],
    removed,
    description: plan.description,
    destructive: false,
    effects: [],
  };
}

/** The stored fields `before` has and `after` has not: columns a change from files drops. */
export function lostFields(before: SpecIR, after: SpecIR): string[] {
  return before.models.flatMap((model) =>
    model.fields
      .filter((f) => storageOf(f) !== "none")
      .filter(
        (f) =>
          !after.models.find((m) => m.name === model.name)?.fields.some((g) => g.name === f.name),
      )
      .map((f) => `${model.name}.${f.name}`),
  );
}

/** A new custom action does nothing until its code is written: where, and what it can look like. */
export function actionNote(action: string): string {
  return `This action needs its code: src/custom/actions/${kebab(action)}.ts (until then it says it is not implemented). For example, to send a mail:
  import { sendMail } from "#/kit/mail";
  await sendMail({ to: "orders@example.com", subject: "New order", text: JSON.stringify(input) });
`;
}

/**
 * Stops a choice field losing a value that records or samples still hold, unless the change
 * says what they get instead: it names the value, how many hold it, and how to say it.
 */
function choicesInUse(
  dir: string,
  before: SpecIR,
  after: SpecIR,
  effects: Effect[],
): string | undefined {
  for (const effect of effects) {
    if (effect.kind !== "change-field" || !effect.choices.length) continue;
    const old = before.models
      .find((m) => m.name === effect.model)
      ?.fields.find((f) => f.name === effect.field);
    if (old?.type.kind !== "choice") continue;
    const gone = old.type.values.filter(
      (v) => !effect.choices.includes(v) && !(v in (effect.renamed ?? {})),
    );
    const { table, column } = columnOf(effect.model, effect.field);
    const file = join(dir, "samples", `${effect.model}.yml`);
    const rows = existsSync(file) ? new YamlEditor(readFileSync(file, "utf8")).get([]) : [];
    const samples = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
    for (const value of gone) {
      const records = countValue(dir, table, column, value) ?? 0;
      const inSamples = samples.filter((row) => row?.[effect.field] === value).length;
      if (!records && !inSamples) continue;
      const held = [
        records ? `${records} ${records === 1 ? "record" : "records"}` : "",
        inSamples ? `${inSamples} ${inSamples === 1 ? "sample" : "samples"}` : "",
      ]
        .filter(Boolean)
        .join(" and ");
      // Left empty only where the field may be empty.
      const field = after.models
        .find((m) => m.name === effect.model)
        ?.fields.find((f) => f.name === effect.field);
      const empty = field && !field.required ? ` (or ${value}= to leave them empty)` : "";
      return `${held} of ${effect.model} still hold "${value}" in ${effect.field}. Say what they get instead: --renames ${value}=${effect.choices[0]}${empty}.`;
    }
  }
  return undefined;
}

/**
 * A renamed or removed field follows into the project's sample records (samples/<Model>.yml),
 * as it does into the companions: the key is renamed or dropped in every record, comments kept.
 */
function followInSamples(dir: string, effects: Effect[]): void {
  for (const effect of effects) {
    // A sample file is named after its model.
    if (effect.kind === "rename-model") {
      const file = join(dir, "samples", `${effect.from}.yml`);
      if (existsSync(file)) renameSync(file, join(dir, "samples", `${effect.to}.yml`));
      continue;
    }
    // A choice value that goes: each sample holding it gets the new one, or loses it.
    if (effect.kind === "change-field" && effect.renamed) {
      const file = join(dir, "samples", `${effect.model}.yml`);
      if (!existsSync(file)) continue;
      const editor = new YamlEditor(readFileSync(file, "utf8"));
      const rows = editor.get([]);
      for (let i = 0; Array.isArray(rows) && i < rows.length; i++) {
        const path = [String(i), effect.field];
        const value = editor.has(path) ? String(editor.get(path)) : undefined;
        if (value === undefined || !(value in effect.renamed)) continue;
        const to = effect.renamed[value];
        if (to) editor.set(path, to);
        else editor.remove(path);
      }
      writeFileSync(file, editor.text);
      continue;
    }
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
  // Turning a model's trash off: what is in it goes for good.
  if (args.trash === false && typeof args.model === "string") {
    const { table } = columnOf(args.model, "id");
    const counts = countValues(dir, table, "deleted_at");
    const n = counts?.filled ?? 0;
    return `this removes the ${n} ${n === 1 ? plural(args.model).toLowerCase().replace(/s$/, "") : plural(args.model).toLowerCase()} in the trash for good.`;
  }
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
