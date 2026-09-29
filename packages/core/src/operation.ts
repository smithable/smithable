import type { YamlEditor } from "./edit.js";
import type { SpecIR, Storage } from "./ir.js";
import type { JsonSchema } from "./section.js";

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
}

/** Facts about a change that later steps need, e.g. migrations must rename, not drop and add. */
export type Effect =
  | { kind: "rename-field"; model: string; from: string; to: string; storage: Storage }
  | { kind: "remove-field"; model: string; field: string; storage: Storage }
  /** A field's type changed; `choices` are its choice values now (none if not a choice). */
  | { kind: "change-field"; model: string; field: string; choices: string[] }
  | { kind: "remove-page"; page: string }
  | { kind: "remove-section"; page: string; section: string }
  /** A rule got an id: its text is the baseline for noticing later edits. */
  | { kind: "rule-identified"; rule: string; text: string };

export type OperationArgs = { [key: string]: unknown };

/** A registrant's answer to an effect it cannot follow: the operation fails with this message. */
export interface Refusal {
  refusal: string;
}

/**
 * What an argument names in the spec, as its schema's `x-smithable` annotation, so forms can
 * offer the names there are: a field of the model (or the page's model) another argument names,
 * a choice value of a field, a landing section of a page. `label` is how Builder asks for it.
 */
export type ArgRef = { label?: string } & (
  | { ref: "model" | "page" | "menu" | "accessTarget" }
  /** Roles; with `target`, also "owner" where that argument's rule has an owner to check. */
  | { ref: "role"; target?: string }
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
  accessTarget:
    "What the rule is for, e.g. model:Order.create, page:orders or action:mergeCustomers.",
  role: "Roles from smithable.auth.yml, e.g. admin sales.",
  field: "A field of that kind of record, e.g. email.",
  choiceValue: "One of the choice field's values.",
  section: "A section of that landing page.",
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
  apply(editors: Editors, args: A, ir: SpecIR): Effect[];
}

export class OperationError extends Error {}

// Operations are defined with their own argument types and stored in untyped registries.
// biome-ignore lint/suspicious/noExplicitAny: each operation narrows its own arguments.
export type AnyOperation = Operation<any>;
