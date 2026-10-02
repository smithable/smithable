// A field's value from what a person wrote, in a sample file (YAML) or a spreadsheet (CSV, where
// every value is text): money in cents, a choice by its value or label, a date as YYYY-MM-DD.
// One set of rules, so a value that seeds also imports. References and pictures are the callers'.
import type { ContentIR } from "./content.js";
import type { FieldIR, ModelIR } from "./ir.js";
import { humanize } from "./naming.js";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}$/;

/** A number from a value, or a text as people write it ("12.50", "12,50", "1 200"). */
function numberOf(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return undefined;
  const text = value.trim().replace(/[\s ]/g, "");
  // A decimal comma ("12,50") when there is no point; thousands separators are not guessed.
  const normal = /^-?\d+,\d+$/.test(text) ? text.replace(",", ".") : text;
  return /^-?\d+(\.\d+)?$/.test(normal) ? Number(normal) : undefined;
}

const TRUE = ["true", "yes", "1"];
const FALSE = ["false", "no", "0"];

/**
 * The value of a field's kind, or what it should have been ("an amount, like 12.50"). Null
 * stays null; a reference, a picture or a list of records is not a scalar and is refused.
 */
export function convertValue(
  model: ModelIR,
  field: FieldIR,
  value: unknown,
  content?: ContentIR,
): { value: string | number | boolean | null } | { expected: string } {
  if (value === null || value === undefined) return { value: null };
  if (field.type.kind === "relation") return { expected: "a reference" };
  if (field.type.kind === "choice") {
    const labels = content?.models?.[model.name]?.fields?.[field.name]?.values ?? {};
    const text = typeof value === "string" ? value.trim() : value;
    const choice = field.type.values.find(
      (v) => v === text || labels[v] === text || humanize(v) === text,
    );
    return choice ? { value: choice } : { expected: `one of ${field.type.values.join(", ")}` };
  }
  const n = numberOf(value);
  const text = typeof value === "string" ? value.trim() : undefined;
  switch (field.type.name) {
    case "int":
      return n !== undefined && Number.isInteger(n) ? { value: n } : { expected: "a whole number" };
    case "decimal":
      return n !== undefined ? { value: n } : { expected: "a number" };
    case "money":
      return n !== undefined
        ? { value: Math.round(n * 100) }
        : { expected: "an amount, like 12.50" };
    case "bool":
      if (typeof value === "boolean") return { value };
      if (text !== undefined && TRUE.includes(text.toLowerCase())) return { value: true };
      if (text !== undefined && FALSE.includes(text.toLowerCase())) return { value: false };
      return { expected: "true or false" };
    case "date":
      return text && DATE.test(text) ? { value: text } : { expected: "a date, like 2026-10-05" };
    case "datetime":
      return text && DATETIME.test(text)
        ? { value: text.replace(" ", "T") }
        : { expected: "a date and time, like 2026-10-05 08:00" };
    case "picture":
    case "pictures":
      return { expected: "a picture" };
    default:
      return typeof value === "string" || typeof value === "number"
        ? { value: String(value) }
        : { expected: "a text" };
  }
}
