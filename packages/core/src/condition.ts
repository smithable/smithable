// A `where` condition: field values a record must have. Public reads, dashboard tiles, capacities
// and landing records sections all take one, so they read, check, follow and describe it alike.
import { isScalar, isSeq, type ParsedNode } from "yaml";
import { type At, mapEntries, type ParseContext } from "./context.js";
import type { YamlEditor } from "./edit.js";
import { type Condition, conditionFits, type ModelIR, referenceWant } from "./ir.js";
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
  /**
   * A reference field may be named (an action's `when`): `none` (empty), `any` (set), and for
   * a field that refers to User `ME()` (the person signed in) or `not ME()`.
   */
  reference = false,
): Condition | undefined {
  const condition: Condition = {};
  for (const { key, keyNode, value } of mapEntries(ctx, node, what) ?? []) {
    const wanted = wantedOf(value);
    if (wanted === undefined) {
      ctx.error(value, "invalid-value", `${what} ${SHAPE}`);
      continue;
    }
    if (model && !conditionFits(model, key, wanted, computed, reference)) {
      const field = model.fields.find((f) => f.name === key);
      if (field?.type.kind === "relation" && reference && !field.type.many)
        ctx.error(
          value,
          "invalid-where",
          field.type.model === "User"
            ? `"${key}" in ${what} is a reference: it is none (empty), any (set), ME() (the person signed in) or not ME().`
            : `"${key}" in ${what} is a reference to ${field.type.model}, not to User: it is none (empty) or any (set); ME() names nobody there.`,
        );
      else if (!field)
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
    const field = model?.fields.find((f) => f.name === key);
    condition[key] =
      field?.type.kind === "relation" && typeof wanted === "string"
        ? (referenceWant(wanted) ?? wanted)
        : wanted;
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

/** "status is published", "status is investigating or identified", "pinned is true", "assignee is not you". */
export function conditionText(where: Condition): string {
  const said = (v: Condition[string]) => {
    if (Array.isArray(v)) return v.join(" or ");
    if (v === "ME()") return "you";
    if (v === "not ME()") return "not you";
    if (v === "none") return "empty";
    if (v === "any") return "set";
    return String(v);
  };
  return Object.entries(where)
    .map(([k, v]) => `${k} is ${said(v)}`)
    .join(" and ");
}
