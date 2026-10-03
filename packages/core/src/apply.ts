import { validateAuth } from "./auth.js";
import { COMPANIONS } from "./companion.js";
import { type Diagnostic, hasErrors } from "./diagnostics.js";
import { EditError, YamlEditor } from "./edit.js";
import {
  type AnyOperation,
  type Editors,
  type Effect,
  type OperationArgs,
  OperationError,
  type ThemeFiles,
} from "./operation.js";
import { checkJson, type SpecPlugin } from "./plugin.js";
import type { JsonSchema } from "./section.js";
import { accessOperations } from "./sections/access-operations.js";
import { ruleOperations } from "./sections/rule-operations.js";
import { specOperations } from "./sections/spec-operations.js";
import { SECTIONS, validateSpec } from "./spec.js";
import { didYouMean } from "./suggest.js";
import { type ThemeIR, themeNames } from "./theme.js";

/**
 * Every operation: those about the spec as a whole (rules and access belong to any concept),
 * then the companions', then each section's.
 */
export const OPERATIONS: readonly AnyOperation[] = [
  ...ruleOperations,
  ...accessOperations,
  ...specOperations,
  ...COMPANIONS.flatMap((c) => c.operations),
  ...SECTIONS.flatMap((s) => s.operations ?? []),
];

export interface ProjectFiles {
  spec: string;
  /** smithable.content.yml, when the project has one. */
  content?: string;
  /** smithable.auth.yml; without it, role names in the spec are not checked. */
  auth?: string;
  /** smithable.ux.yml, when the project has one. */
  ux?: string;
  /** smithable.context.yml, when the project has one. */
  context?: string;
  /** The project's plugins, for the sections of smithable.yml they handle. */
  plugins?: SpecPlugin[];
  /** The project's own themes (themes/<name>.yml), which the ux file's preset may name. */
  themes?: ThemeIR[];
}

export type OperationResult =
  | {
      ok: true;
      files: ProjectFiles;
      /** Files the operation adds besides the five (themes/<name>.yml), for the host to write. */
      added: { path: string; text: string }[];
      description: string;
      destructive: boolean;
      effects: Effect[];
    }
  | { ok: false; message: string; diagnostics: Diagnostic[] };

/**
 * The operations of a project: the built-in ones and its plugins'. A plugin operation whose name
 * a built-in (or an earlier plugin) already uses is offered as "<key>:<name>".
 */
export function operationsFor(plugins: readonly SpecPlugin[] = []): AnyOperation[] {
  const all = [...OPERATIONS];
  for (const plugin of plugins)
    for (const op of plugin.operations ?? [])
      all.push(
        all.some((o) => o.name === op.name) ? { ...op, name: `${plugin.key}:${op.name}` } : op,
      );
  return all;
}

export function findOperation(
  name: string,
  plugins?: readonly SpecPlugin[],
): AnyOperation | undefined {
  return operationsFor(plugins).find((op) => op.name === name);
}

/**
 * Applies an operation to the project's files. Pure: returns the edited texts, or why the
 * operation cannot be applied. The result is always a valid spec and content file.
 */
export function applyOperation(
  files: ProjectFiles,
  name: string,
  args: OperationArgs,
): OperationResult {
  const fail = (message: string, diagnostics: Diagnostic[] = []) => ({
    ok: false as const,
    message,
    diagnostics,
  });
  // A model may send anything as the name: say so, so a retry can mend it.
  if (typeof name !== "string")
    return fail(`An operation's name must be text, like "addModel"; got ${JSON.stringify(name)}.`);
  const op = findOperation(name, files.plugins);
  if (!op) {
    const names = operationsFor(files.plugins).map((o) => o.name);
    return fail(
      `Unknown operation "${name}". ${didYouMean(name, names) ?? `Available: ${names.join(", ")}.`}`,
    );
  }
  const argError = checkArgs(op.schema, args);
  if (argError) return fail(`${name}: ${argError}`);

  const auth = (text: string) => validateAuth({ path: "smithable.auth.yml", text });
  const roles =
    files.auth === undefined ? undefined : auth(files.auth).auth?.roles.map((r) => r.name);
  const options = {
    ...(roles ? { roles } : {}),
    ...(files.plugins ? { plugins: files.plugins } : {}),
  };
  const before = validateSpec({ path: "smithable.yml", text: files.spec }, options);
  if (!before.ir)
    return fail(
      "smithable.yml has errors; fix them before applying operations.",
      before.diagnostics,
    );

  // Each companion gets an editor: its file, or a new one if it may be created.
  const start = (key: (typeof COMPANIONS)[number]["key"], empty?: string) => files[key] ?? empty;
  const added: { theme: ThemeIR; text: string }[] = [];
  const themes: ThemeFiles = {
    names: themeNames(files.themes),
    add: (theme, text) => void added.push({ theme, text }),
  };
  const editors = {
    spec: new YamlEditor(files.spec),
    themes,
    ...Object.fromEntries(
      COMPANIONS.flatMap((c) => {
        const text = start(c.key, c.empty);
        return text === undefined ? [] : [[c.key, new YamlEditor(text)]];
      }),
    ),
  } as Editors;
  let effects: Effect[];
  try {
    effects = op.apply(editors, args, before.ir);
    // The other sections and the companions follow what the operation did (a field renamed, a
    // page removed); one of them may refuse, when something it owns still needs what went away.
    for (const effect of effects) {
      for (const s of SECTIONS) {
        const refused = s.follow?.(editors.spec, effect, before.ir);
        if (refused) return fail(refused.refusal);
      }
      for (const c of COMPANIONS) {
        const editor = editors[c.key];
        const refused = editor && c.follow?.(editor, effect, before.ir);
        if (refused) return fail(refused.refusal);
      }
    }
  } catch (error) {
    // An edit the files cannot take is the operation failing too, not a crash.
    if (error instanceof OperationError || error instanceof EditError) return fail(error.message);
    throw error;
  }

  const after = validateSpec({ path: "smithable.yml", text: editors.spec.text }, options);
  if (!after.ir) return fail(`${name} would make smithable.yml invalid.`, after.diagnostics);
  // A companion file is written (and so checked) if the project has one or the operation
  // changed it. A theme added by the operation counts for the check, so the ux file may use it.
  const written: Partial<Record<(typeof COMPANIONS)[number]["key"], string>> = {};
  const known = added.length
    ? { ...files, themes: [...(files.themes ?? []), ...added.map((a) => a.theme)] }
    : files;
  for (const c of COMPANIONS) {
    const editor = editors[c.key];
    if (!editor || (files[c.key] === undefined && editor.text === c.empty)) continue;
    const problems = c.check(editor.text, after.ir, known);
    if (hasErrors(problems)) return fail(`${name} would make ${c.file} invalid.`, problems);
    written[c.key] = editor.text;
  }
  return {
    ok: true,
    files: { spec: editors.spec.text, ...written },
    added: added.map((a) => ({ path: `themes/${a.theme.name}.yml`, text: a.text })),
    description: op.describe(args, before.ir),
    destructive: op.destructive(args, before.ir, after.ir),
    effects,
  };
}

/** Turns CLI positional arguments into an operation's arguments, following `positional`. */
export function parseOperationArgs(op: AnyOperation, words: string[]): OperationArgs {
  const properties = (op.schema.properties ?? {}) as Record<string, JsonSchema>;
  const args: OperationArgs = {};
  // "--name value" gives an argument by name: a list as "a,b", an object as "a=x,b=y"; a boolean
  // needs no value ("--use").
  const values: string[] = [];
  for (let i = 0; i < words.length; i++) {
    // "--dry-run" names dryRun.
    const key = /^--([\w-]+)$/
      .exec(words[i] as string)?.[1]
      ?.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
    const type = key === undefined ? undefined : properties[key]?.type;
    const next = words[i + 1];
    if (type === "boolean" && (next === undefined || /^--[\w-]+$/.test(next))) {
      args[key as string] = true;
      continue;
    }
    if (key === undefined || !properties[key] || next === undefined) {
      values.push(words[i] as string);
      continue;
    }
    const value = words[++i] as string;
    args[key] =
      type === "array"
        ? value
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean)
        : type === "object"
          ? // Repeated ("--set a=1 --set b=2") adds to the pairs given before.
            {
              ...(args[key] as object | undefined),
              ...Object.fromEntries(pairsOf(value).map(pairOf)),
            }
          : scalarOf(value, type);
  }
  op.positional.forEach((spec, index) => {
    if (spec.startsWith("...")) {
      const key = spec.slice(3);
      const rest = values.slice(index);
      if (rest.length === 0) return;
      const type = properties[key]?.type;
      if (type === "object") {
        args[key] = Object.fromEntries(rest.map(pairOf));
      } else if (type === "array") {
        args[key] = rest;
      } else {
        args[key] = rest.join(" ");
      }
    } else if (values[index] !== undefined) {
      args[spec] = scalarOf(values[index] as string, properties[spec]?.type);
    }
  });
  return args;
}

/** A word as the schema's type: a number or a boolean when it says so and the word is one. */
function scalarOf(word: string, type: unknown): unknown {
  if ((type === "integer" || type === "number") && /^-?\d+(?:\.\d+)?$/.test(word))
    return Number(word);
  if (type === "boolean" && (word === "true" || word === "false")) return word === "true";
  return word;
}

/** "a=x,b=y" as its pairs; a comma inside parentheses or quotes is a formula's, not a separator. */
function pairsOf(text: string): string[] {
  const pairs: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      pairs.push(text.slice(start, i));
      start = i + 1;
    }
  }
  pairs.push(text.slice(start));
  return pairs.map((p) => p.trim()).filter(Boolean);
}

/** "name=value" as a pair; a bare name has an empty value. */
function pairOf(pair: string): [string, string] {
  const eq = pair.indexOf("=");
  return eq === -1 ? [pair, ""] : [pair.slice(0, eq), pair.slice(eq + 1)];
}

/** Checks required keys and unknown keys in the operation's words, then the values' types. */
function checkArgs(schema: JsonSchema, args: OperationArgs): string | undefined {
  const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
  for (const key of (schema.required ?? []) as string[]) {
    if (args[key] === undefined || args[key] === "") return `"${key}" is missing.`;
  }
  for (const key of Object.keys(args)) if (!properties[key]) return `Unknown argument "${key}".`;
  return checkJson({ properties }, args, "")[0];
}
