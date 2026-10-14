import { validateAuth } from "./auth.js";
import { COMPANIONS } from "./companion.js";
import { type Language, validateContent } from "./content.js";
import { type Diagnostic, hasErrors } from "./diagnostics.js";
import { EditError, YamlEditor } from "./edit.js";
import {
  type AnyOperation,
  type Editors,
  type Effect,
  type OperationArgs,
  OperationError,
  type ThemeFiles,
  type TranslationFiles,
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
  /** Its language files' texts, smithable.content.<language>.yml, by language. */
  translations?: Record<string, string>;
}

/** A language's file in a project. */
export const translationPath = (language: string) => `smithable.content.${language}.yml`;

export type OperationResult =
  | {
      ok: true;
      files: ProjectFiles;
      /** Files the operation adds besides the five (themes/<name>.yml), for the host to write. */
      added: { path: string; text: string }[];
      /** Files the operation takes away (a language's file), for the host to delete. */
      removed: string[];
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
  // The language files: those the project has, those added, those taken away.
  const translated = new Map(
    Object.entries(files.translations ?? {}).map(([l, text]) => [l, new YamlEditor(text)]),
  );
  const removedLanguages = new Set<string>();
  const translations: TranslationFiles = {
    get: (language) => translated.get(language),
    add: (language, text) => {
      translated.set(language, new YamlEditor(text));
      removedLanguages.delete(language);
    },
    remove: (language) => {
      translated.delete(language);
      removedLanguages.add(language);
    },
  };
  const editors = {
    spec: new YamlEditor(files.spec),
    themes,
    translations,
    ...Object.fromEntries(
      COMPANIONS.flatMap((c) => {
        const text = start(c.key, c.empty);
        return text === undefined ? [] : [[c.key, new YamlEditor(text)]];
      }),
    ),
  } as Editors;
  let effects: Effect[];
  const notes: string[] = [];
  try {
    // What the operation says for the person (a note) is not something the others follow.
    const done = op.apply(editors, args, before.ir);
    effects = done.filter((e): e is Effect => !("note" in e));
    for (const e of done) if ("note" in e) notes.push(e.note);
    // The other sections and the companions follow what the operation did (a field renamed, a
    // page removed); one of them may refuse, when something it owns still needs what went away.
    for (const effect of effects) {
      for (const s of SECTIONS) {
        const followed = s.follow?.(editors.spec, effect, before.ir);
        if (followed && "refusal" in followed) return fail(followed.refusal);
        if (followed) notes.push(followed.note);
      }
      for (const c of COMPANIONS) {
        const editor = editors[c.key];
        const followed = editor && c.follow?.(editor, effect, before.ir);
        if (followed && "refusal" in followed) return fail(followed.refusal);
        if (followed) notes.push(followed.note);
        // A language file has the content file's keys: what moves there moves in each.
        if (c.key === "content")
          for (const language of translated.values()) c.follow?.(language, effect, before.ir);
      }
    }
  } catch (error) {
    // An edit the files cannot take is the operation failing too, not a crash.
    if (error instanceof OperationError || error instanceof EditError) return fail(error.message);
    throw error;
  }

  // The roles the spec may name are the auth file's as it is now: an operation may have changed them.
  const rolesAfter = editors.auth ? auth(editors.auth.text).auth?.roles.map((r) => r.name) : roles;
  const after = validateSpec(
    { path: "smithable.yml", text: editors.spec.text },
    { ...options, ...(rolesAfter ? { roles: rolesAfter } : {}) },
  );
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
  // Each language file against the content file as it is now: the same keys, texts only.
  const contentNow = validateContent(
    { path: "smithable.content.yml", text: editors.content?.text ?? "" },
    after.ir,
  ).content;
  const translationsNow: Record<string, string> = {};
  for (const [language, editor] of translated) {
    if (contentNow) {
      const problems = validateContent(
        { path: translationPath(language), text: editor.text },
        after.ir,
        { of: contentNow, language: language as Language },
      ).diagnostics;
      if (hasErrors(problems))
        return fail(`${name} would make ${translationPath(language)} invalid.`, problems);
    }
    translationsNow[language] = editor.text;
  }
  return {
    ok: true,
    files: {
      spec: editors.spec.text,
      ...written,
      ...(translated.size ? { translations: translationsNow } : {}),
    },
    added: added.map((a) => ({ path: `themes/${a.theme.name}.yml`, text: a.text })),
    removed: [...removedLanguages].map(translationPath),
    description: [op.describe(args, before.ir), ...notes].join("; "),
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
  // For each word no option took: the list option given just before it, if any ("--pages home
  // items": items), to say how a list is written.
  const after: (string | undefined)[] = [];
  let lastList: string | undefined;
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
    // An object with no pairs ("--copy" alone) is an empty one.
    if (type === "object" && (next === undefined || /^--[\w-]+$/.test(next))) {
      args[key as string] = args[key as string] ?? {};
      continue;
    }
    if (key === undefined || !properties[key] || next === undefined) {
      values.push(words[i] as string);
      after.push(lastList);
      continue;
    }
    const value = words[++i] as string;
    lastList = type === "array" ? key : undefined;
    args[key] =
      type === "array"
        ? // Repeated ("--pages home --pages items") adds to the list given before.
          [
            ...((args[key] as string[] | undefined) ?? []),
            ...value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          ]
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
  // A word nothing took is refused, never dropped: on an operation about what is public, a list
  // value lost without a word would open or close the wrong thing.
  if (!op.positional.some((p) => p.startsWith("..."))) {
    const index = op.positional.length;
    const word = values[index];
    if (word !== undefined) {
      const list = after[index];
      const flag = (k: string) => `--${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
      if (list)
        throw new OperationError(
          `"${word}" is left over: a list is written with commas, e.g. ${flag(list)} ${[...((args[list] as string[]) ?? []), word].join(",")}.`,
        );
      if (word.startsWith("--")) {
        const known = word.slice(2).replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
        throw new OperationError(
          properties[known] ? `${word} needs a value.` : `${op.name} has no option ${word}.`,
        );
      }
      throw new OperationError(
        `"${word}" is more than ${op.name} takes: ${op.name} ${op.positional.map((p) => `<${p}>`).join(" ")}${Object.keys(properties).some((k) => !op.positional.includes(k)) ? " [--options]" : ""}.`,
      );
    }
  }
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
