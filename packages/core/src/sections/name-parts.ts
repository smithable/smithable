import type { FieldIR, ModelIR, NamePartIR } from "../ir.js";
import { humanize } from "../naming.js";
import { didYouMean } from "../suggest.js";

/**
 * The parts of a record's name (docs/design/record-names.md §1), shared by a model's `namedBy`
 * and a page's `record` lines in the ux file: a field of the model, a reference (that record's
 * own name) or a field one reference away, written as a path.
 */

export const NAME_PART_PATH = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9]*)?$/;

const TEXT = ["string", "text", "markdown"];
/** The scalar kinds a part may be: texts, dates, numbers and money; never a picture or a file. */
const SHOWN = [...TEXT, "date", "datetime", "int", "decimal", "money"];

/** A stored string, text or markdown field: today's one-field title. */
export function isTextField(f: FieldIR): boolean {
  return f.type.kind === "scalar" && TEXT.includes(f.type.name) && !f.formula;
}

/** Whether a field may be a part, on its own: a shown scalar, a choice, or one reference. */
function partKind(f: FieldIR): boolean {
  if (f.type.kind === "scalar") return SHOWN.includes(f.type.name);
  if (f.type.kind === "choice") return true;
  return f.type.kind === "relation" && !f.type.many;
}

/** The fields of a model a part may name, for a suggestion. */
const candidates = (model: ModelIR) => model.fields.filter(partKind).map((f) => f.name);

/** Reads one part as written ("classType", "classType.name"), or says what is wrong. */
export function readNamePart(
  text: string,
  model: ModelIR,
  models: ModelIR[],
): { part: NamePartIR } | { problem: string; hint?: string; code?: "unknown-field" } {
  const path = text.trim();
  if (!NAME_PART_PATH.test(path))
    return {
      problem: `"${path}" is not a field of ${model.name} or a field one reference away, like classType or classType.name.`,
    };
  const [first = "", second] = path.split(".");
  const field = model.fields.find((f) => f.name === first);
  if (!field)
    return {
      code: "unknown-field",
      problem: `${model.name} has no field "${first}".`,
      hint: didYouMean(first, candidates(model)),
    };
  if (second === undefined) {
    if (!partKind(field))
      return {
        problem: `${model.name}.${first} cannot be part of a name: a part is a text, a choice, a date, a number, an amount or a reference, not ${field.type.kind === "relation" ? "a list" : `a ${field.type.kind === "scalar" ? field.type.name : field.type.kind}`}.`,
      };
    return { part: { field: first } };
  }
  if (field.type.kind !== "relation" || field.type.many)
    return {
      problem: `${model.name}.${first} does not refer to one record, so "${first}.${second}" names nothing.`,
    };
  const other = models.find((m) => m.name === (field.type as { model: string }).model);
  if (!other)
    return {
      problem: `${model.name}.${first} refers to ${field.type.model}, which has no fields to name a record by.`,
    };
  const target = other.fields.find((f) => f.name === second);
  if (!target)
    return {
      code: "unknown-field",
      problem: `${other.name} has no field "${second}".`,
      hint: didYouMean(
        second,
        candidates(other).filter(
          (n) => other.fields.find((f) => f.name === n)?.type.kind !== "relation",
        ),
      ),
    };
  if (target.type.kind === "relation")
    return {
      problem: `"${path}" goes two references deep; a part is a field, or a field one reference away. Write "${first}" for the ${humanize(other.name).toLowerCase()}'s own name.`,
    };
  if (!partKind(target))
    return {
      problem: `${other.name}.${second} cannot be part of a name: a part is a text, a choice, a date, a number or an amount.`,
    };
  return { part: { field: second, through: first } };
}

/** A part as it is written back: "classType" or "classType.name". */
export const partText = (p: NamePartIR) => (p.through ? `${p.through}.${p.field}` : p.field);

/**
 * Whether a model's name comes back to itself through references (Session named by its booking,
 * named by its session): the models on the way, start to start, or nothing.
 */
export function nameCircle(start: ModelIR, models: ModelIR[]): string[] | undefined {
  const walk = (model: ModelIR, path: string[]): string[] | undefined => {
    for (const p of model.nameParts ?? []) {
      if (p.through) continue;
      const f = model.fields.find((x) => x.name === p.field);
      if (f?.type.kind !== "relation") continue;
      const target = models.find((m) => m.name === (f.type as { model: string }).model);
      if (!target) continue;
      if (target.name === start.name) return [...path, target.name];
      if (path.includes(target.name)) continue;
      const found = walk(target, [...path, target.name]);
      if (found) return found;
    }
    return undefined;
  };
  return walk(start, [start.name]);
}
