// A `where` condition: field values a record must have. Public reads, dashboard tiles, capacities
// and landing records sections all take one, so they read, check, follow and describe it alike.
import { isScalar, isSeq, type ParsedNode } from "yaml";
import { type At, mapEntries, type ParseContext } from "./context.js";
import type { YamlEditor } from "./edit.js";
import { type Condition, conditionFits, type ModelIR } from "./ir.js";
import { didYouMean } from "./suggest.js";

/**
 * Reads a `where` map: a choice field's value (or a list of them), or a yes/no field's true or
 * false. With a model, each field and value is checked and a wrong one is said with a hint.
 */
export function readCondition(
  ctx: ParseContext,
  node: At,
  what: string,
  model?: ModelIR,
  /** A computed field may be named (a condition read on the loaded record, not in a query). */
  computed = false,
): Condition | undefined {
  const condition: Condition = {};
  for (const { key, keyNode, value } of mapEntries(ctx, node, what) ?? []) {
    const wanted = wantedOf(value);
    if (wanted === undefined) {
      ctx.error(value, "invalid-value", `${what} ${SHAPE}`);
      continue;
    }
    if (model && !conditionFits(model, key, wanted, computed)) {
      const field = model.fields.find((f) => f.name === key);
      if (!field)
        ctx.error(
          keyNode,
          "unknown-field",
          `${model.name} has no field named "${key}".`,
          didYouMean(
            key,
            model.fields.map((f) => f.name),
          ),
        );
      else if (field.type.kind === "choice" && typeof wanted !== "boolean") {
        const missing = (Array.isArray(wanted) ? wanted : [wanted]).find(
          (v) => !(field.type as { values: string[] }).values.includes(v),
        );
        ctx.error(
          value,
          "unknown-value",
          `${model.name}.${key} has no value "${missing}".`,
          didYouMean(missing ?? "", (field.type as { values: string[] }).values),
        );
      } else ctx.error(value, "invalid-where", `"${key}" in ${what}: ${SHAPE}`);
      continue;
    }
    condition[key] = wanted;
  }
  return Object.keys(condition).length ? condition : undefined;
}

const SHAPE =
  "compares a choice field with one of its values (or a list of them), and a yes/no field with true or false.";

function wantedOf(node: ParsedNode | null): string | boolean | string[] | undefined {
  if (isScalar(node) && (typeof node.value === "string" || typeof node.value === "boolean"))
    return node.value;
  if (isSeq(node)) {
    const items = node.items.map((i) => (isScalar(i) ? i.value : undefined));
    if (items.length && items.every((i) => typeof i === "string")) return items as string[];
  }
  return undefined;
}

/**
 * An operation's `where` arguments as a condition: "true"/"false" become yes/no, and a list of
 * choice values is written as the choices are, `investigating | identified`.
 */
export function conditionArgs(where: Record<string, string | boolean | string[]>): Condition {
  return Object.fromEntries(
    Object.entries(where).map(([k, v]) => {
      if (typeof v !== "string") return [k, v];
      if (v === "true" || v === "false") return [k, v === "true"];
      const list = v.split("|").map((x) => x.trim());
      return [k, list.length > 1 ? list : v];
    }),
  );
}

/** The values a changed choice field no longer has, among those a condition wants. */
export function lostValues(wanted: Condition[string], choices: string[]): string[] {
  if (typeof wanted === "boolean") return [];
  return (Array.isArray(wanted) ? wanted : [wanted]).filter((v) => !choices.includes(v));
}

/**
 * Follows a choice field's renamed values in a condition stored at `path` (its "where" and the
 * field), and returns what it wants now. A value whose records were left empty ("" in `renamed`)
 * cannot be followed: it stays, for the caller to refuse as lost.
 */
export function followRenamed(
  editor: YamlEditor,
  path: string[],
  wanted: Condition[string],
  renamed: Record<string, string> = {},
): Condition[string] {
  if (typeof wanted === "boolean") return wanted;
  const before = Array.isArray(wanted) ? wanted : [wanted];
  const after = [...new Set(before.map((v) => renamed[v] || v))];
  if (after.join("\n") === before.join("\n")) return wanted;
  const next = Array.isArray(wanted) ? after : (after[0] as string);
  editor.set(path, next);
  return next;
}

/** "status is published", "status is investigating or identified", "pinned is true". */
export function conditionText(where: Condition): string {
  return Object.entries(where)
    .map(([k, v]) => `${k} is ${Array.isArray(v) ? v.join(" or ") : v}`)
    .join(" and ");
}
