import type { YamlEditor } from "./edit.js";
import type { SpecIR, Storage } from "./ir.js";
import type { JsonSchema } from "./section.js";

/** The files an operation may edit. */
export interface Editors {
  spec: YamlEditor;
  /** smithable.content.yml, when the project has one. */
  content?: YamlEditor;
  /** smithable.auth.yml, when given. */
  auth?: YamlEditor;
  /** smithable.ux.yml; created on first use. */
  ux?: YamlEditor;
}

/** Facts about a change that later steps need, e.g. migrations must rename, not drop and add. */
export type Effect =
  | { kind: "rename-field"; model: string; from: string; to: string; storage: Storage }
  | { kind: "remove-field"; model: string; field: string; storage: Storage }
  /** A rule got an id: its text is the baseline for noticing later edits. */
  | { kind: "rule-identified"; rule: string; text: string };

export type OperationArgs = { [key: string]: unknown };

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
  /** True when the change can lose data and needs confirmation. */
  destructive(args: A, ir: SpecIR): boolean;
  /** Edits the files, or throws an OperationError explaining why it cannot. */
  apply(editors: Editors, args: A, ir: SpecIR): Effect[];
}

export class OperationError extends Error {}

// Operations are defined with their own argument types and stored in untyped registries.
// biome-ignore lint/suspicious/noExplicitAny: each operation narrows its own arguments.
export type AnyOperation = Operation<any>;
