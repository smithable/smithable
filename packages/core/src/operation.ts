import type { YamlEditor } from "./edit.js";
import type { SpecIR, Storage } from "./ir.js";
import type { JsonSchema } from "./section.js";
import type { ThemeIR } from "./theme.js";

/** The project's themes/<name>.yml files an operation adds; the host writes them. */
export interface ThemeFiles {
  /** The names already taken: the built-in themes' and the project's. */
  readonly names: readonly string[];
  add(theme: ThemeIR, text: string): void;
}

/** The files an operation may edit. */
export interface Editors {
  spec: YamlEditor;
  /** smithable.content.yml; written only when the project has one or it changed. */
  content: YamlEditor;
  /** smithable.auth.yml, when given. */
  auth?: YamlEditor;
  /** smithable.ux.yml; written only when the project has one or it changed. */
  ux: YamlEditor;
  /** smithable.context.yml (implementation choices); written only when it changed. */
  context: YamlEditor;
  themes: ThemeFiles;
  /** The language files, smithable.content.<language>.yml (docs/design/languages.md §2). */
  translations: TranslationFiles;
}

/** The project's language files, one editor each; an operation may add or take one away. */
export interface TranslationFiles {
  /** The file of a language the project has, to edit. */
  get(language: string): YamlEditor | undefined;
  add(language: string, text: string): void;
  remove(language: string): void;
}

/** Facts about a change that later steps need, e.g. migrations must rename, not drop and add. */
export type Effect =
  /** A model renamed: its table and every file that names it follow (rename.ts, the host). */
  | { kind: "rename-model"; from: string; to: string }
  /** A page renamed: the companions' entries for it follow; its default address changes. */
  | { kind: "rename-page"; from: string; to: string }
  | { kind: "rename-field"; model: string; from: string; to: string; storage: Storage }
  | { kind: "remove-field"; model: string; field: string; storage: Storage }
  /** A field's type changed; `choices` are its choice values now (none if not a choice). */
  | {
      kind: "change-field";
      model: string;
      field: string;
      choices: string[];
      /** A choice field's old values and what records holding them get instead ("" clears them). */
      renamed?: Record<string, string>;
    }
  | { kind: "remove-page"; page: string }
  | { kind: "remove-section"; page: string; section: string }
  | { kind: "remove-action"; action: string }
  /** A rule got an id: its text is the baseline for noticing later edits. */
  | { kind: "rule-identified"; rule: string; text: string }
  /**
   * Records to add from a spreadsheet: the host reads the source with readRecords, looks the
   * references up and inserts them in one transaction (or, on a dry run, only shows them).
   */
  | {
      kind: "import-records";
      model: string;
      source: { path: string } | { text: string };
      map: Record<string, string>;
      dryRun: boolean;
    };

export type OperationArgs = { [key: string]: unknown };

/** A registrant's answer to an effect it cannot follow: the operation fails with this message. */
export interface Refusal {
  refusal: string;
}

/**
 * Something an operation did that the person did not ask for in so many words, said in its
 * confirmation: what a section or a companion changed in step with it (a removed page is no longer public),
 * or what the operation itself takes away (visitors can no longer read something). A note is a
 * clause that follows the description after "; ", so it must read well there.
 */
export interface Note {
  note: string;
}

/**
 * What an argument names in the spec, as its schema's `x-smithable` annotation, so forms can
 * offer the names there are: a field of the model (or the page's model) another argument names,
 * a choice value of a field, a landing section of a page. `label` is how Builder asks for it.
 */
export type ArgRef = { label?: string } & (
  | { ref: "model" | "page" | "menu" | "outgoing" | "incoming" | "timer" }
  | { ref: "role" }
  /** What a grant names: pages, models or custom actions, by the argument `what` names. */
  | { ref: "grantNames"; what: string }
  | { ref: "field"; model: string }
  | { ref: "field"; page: string }
  | { ref: "choiceValue"; model: string; field: string }
  | { ref: "section"; page: string }
);

/** How a form describes each kind of name (not sent to models: prompts stay as small as they were). */
const REF_HINTS: Record<ArgRef["ref"], string> = {
  model: "A kind of record, e.g. Customer.",
  page: "A page's name, e.g. customers.",
  menu: 'A menu, usually "main".',
  role: "Roles from smithable.auth.yml, e.g. admin sales.",
  grantNames: "Pages, kinds of record or custom actions, by what is granted; or all.",
  field: "A field of that kind of record, e.g. email.",
  choiceValue: "One of the choice field's values.",
  section: "A section of that landing page.",
  outgoing: "An entry under outgoing, e.g. bookingMade.",
  incoming: "An entry under incoming, e.g. monitorDown.",
  timer: "A timer, e.g. remind.",
};

/** What a form says under an argument that names something, when its schema says nothing. */
export const refHint = (ref: ArgRef) => REF_HINTS[ref.ref];

/** A string argument (or, with `list`, a list of them) that names something in the spec. */
export function refTo(ref: ArgRef, schema: JsonSchema = {}, list = false): JsonSchema {
  return list
    ? { type: "array", items: { type: "string" }, ...schema, "x-smithable": ref }
    : { type: "string", ...schema, "x-smithable": ref };
}

/**
 * A semantic operation: the only way to change the spec programmatically (ARCHITECTURE §4).
 * Registered by the spec section it belongs to. Its schema drives the CLI, MCP tools and
 * constrained AI output alike.
 */
export interface Operation<A extends OperationArgs = OperationArgs> {
  name: string;
  summary: string;
  /** Argument JSON Schema. */
  schema: JsonSchema;
  /**
   * CLI order of arguments. A final "...name" takes the rest: joined with spaces for a
   * text argument, `key=value` pairs for a mapping, or a list.
   */
  positional: string[];
  /** Plain-language description, used in commit messages and the change trace. */
  /** Plain language, e.g. "Add field phone (phone) to Customer"; `ir` is the app before it. */
  describe(args: A, ir: SpecIR): string;
  /**
   * True when the change can lose data and needs confirmation. `after` is the spec as the
   * change leaves it, validated with the project's plugins.
   */
  destructive(args: A, ir: SpecIR, after?: SpecIR): boolean;
  /** Edits the files, or throws an OperationError explaining why it cannot. */
  apply(editors: Editors, args: A, ir: SpecIR): (Effect | Note)[];
}

export class OperationError extends Error {}

// Operations are defined with their own argument types and stored in untyped registries.
// biome-ignore lint/suspicious/noExplicitAny: each operation narrows its own arguments.
export type AnyOperation = Operation<any>;
