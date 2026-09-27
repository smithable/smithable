import type { ParsedNode } from "yaml";
import type { ParseContext } from "./context.js";
import type { SpecIR } from "./ir.js";
import type { AnyOperation } from "./operation.js";

export type JsonSchema = { [key: string]: unknown };

export type SectionKey = Exclude<keyof SpecIR, "specVersion" | "extensions">;

/**
 * A top-level section of smithable.yml, registered like a plugin (ARCHITECTURE §5.1).
 * Built-in features use this interface so that a public plugin API can later be
 * published from what is already in use.
 */
export interface SpecSection<K extends SectionKey = SectionKey> {
  key: K;
  required: boolean;
  /** JSON Schema of this key's value, composed into the published spec schema. */
  schema: JsonSchema;
  /**
   * Parses the section. `node` is undefined when the key is absent.
   * `parsed` holds the sections registered before this one.
   */
  parse(ctx: ParseContext, node: ParsedNode | null | undefined, parsed: Partial<SpecIR>): SpecIR[K];
  /** Operations that change this section (ARCHITECTURE §4). */
  operations?: AnyOperation[];
}
