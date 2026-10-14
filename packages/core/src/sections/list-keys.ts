// The keys a list offers its viewer besides search: filters and a sort choice (marketplace.md
// §2.2). Shared by crud pages and a landing page's records section.

import type { At, ParseContext } from "../context.js";
import type { FieldIR, ModelIR, SpecIR } from "../ir.js";
import { isUpload } from "../ir.js";
import { didYouMean } from "../suggest.js";

/** A number or a date: a filter offers a range, "from" and "to". */
const RANGE = ["int", "decimal", "money", "date", "datetime"];

/**
 * Whether a list can be filtered by a field: a choice or a reference as chips, a number or a
 * date as a range, yes/no as a toggle. Free text is searched, not filtered; pictures never.
 */
export const filterable = (field: FieldIR): boolean =>
  !field.formula &&
  (field.type.kind === "choice" ||
    // A person (record-rules.md §6): Mine, Unassigned and the people by name; the automatic
    // owner stays a "Mine" toggle.
    (field.type.kind === "relation" && !field.type.many) ||
    (field.type.kind === "scalar" &&
      (field.type.name === "bool" || RANGE.includes(field.type.name))));

/**
 * Whether a list can be sorted by a field: anything stored with an order, so not pictures, long
 * text or a calculated field (it has no column to sort the query by).
 */
export const sortableBy = (field: FieldIR): boolean =>
  !field.formula &&
  (field.type.kind === "choice" ||
    (field.type.kind === "scalar" &&
      !["text", "markdown"].includes(field.type.name) &&
      !isUpload(field)));

/** A model's fields a list could be filtered by, in the model's order. */
export const filterableFields = (model: ModelIR): string[] =>
  model.fields.filter(filterable).map((f) => f.name);

function checkListFields(
  ctx: ParseContext,
  key: "filters" | "sortable",
  fields: { name: string; at: At }[],
  model: string,
  parsed: Partial<SpecIR>,
  where: string,
): string[] {
  const target = parsed.models?.find((m) => m.name === model);
  if (!target) return fields.map((f) => f.name); // reported as an unknown model
  const fits = key === "filters" ? filterable : sortableBy;
  const names: string[] = [];
  for (const { name, at } of fields) {
    // The automatic fields: when a record was made or changed (a date, so a range or an order),
    // and who owns it (a "Mine" toggle for those signed in); never an order by owner.
    if (name === "createdAt" || name === "updatedAt" || (name === "owner" && key === "filters")) {
      if (names.includes(name))
        ctx.error(at, "duplicate-field", `"${name}" is listed twice in the ${key} of ${where}.`);
      else names.push(name);
      continue;
    }
    const field = target.fields.find((f) => f.name === name);
    if (!field) {
      ctx.error(
        at,
        "unknown-field",
        `${model} has no field named "${name}" for the ${key} of ${where}.`,
        didYouMean(
          name,
          target.fields.map((f) => f.name),
        ),
      );
    } else if (!fits(field)) {
      ctx.error(
        at,
        key === "filters" ? "invalid-filter" : "invalid-sort",
        key === "filters"
          ? `"${name}" cannot be a filter: only choices, references, numbers, amounts, dates and yes/no fields can (text is searched, not filtered).`
          : field.formula
            ? `"${name}" cannot be sorted by: a calculated field has no stored value to sort by.`
            : `"${name}" cannot be sorted by: pictures, long text and lists of records have no order.`,
      );
    } else if (names.includes(name)) {
      ctx.error(at, "duplicate-field", `"${name}" is listed twice in the ${key} of ${where}.`);
    } else names.push(name);
  }
  return names;
}

/** The fields a list may be filtered by, checked against the model; the valid ones, in order. */
export const checkFilterFields = (
  ctx: ParseContext,
  fields: { name: string; at: At }[],
  model: string,
  parsed: Partial<SpecIR>,
  where: string,
): string[] => checkListFields(ctx, "filters", fields, model, parsed, where);

/** The fields a list may be sorted by, checked against the model; the valid ones, in order. */
export const checkSortableFields = (
  ctx: ParseContext,
  fields: { name: string; at: At }[],
  model: string,
  parsed: Partial<SpecIR>,
  where: string,
): string[] => checkListFields(ctx, "sortable", fields, model, parsed, where);
