// The keys a list offers its viewer besides search: filters and a sort choice (marketplace.md
// §2.2). Shared by crud pages and a landing page's records section.

import { isMap, isScalar, type ParsedNode } from "yaml";
import type { At, ParseContext } from "../context.js";
import type { DashboardItem, FieldIR, ModelIR, SpecIR } from "../ir.js";
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

/** A date filter's relative values, resolved when the query runs, in the app's time zone. */
export const RELATIVE_DATES = [
  "upcoming",
  "past",
  "today",
  "thisWeek",
  "thisMonth",
  "lastMonth",
  "thisYear",
] as const;

const DATE_RANGE = /^(?:\d{4}-\d{2}-\d{2})?\.\.(?:\d{4}-\d{2}-\d{2})?$/;
const NUMBER_RANGE = /^(?:-?\d+(?:[.,]\d+)?)?\.\.(?:-?\d+(?:[.,]\d+)?)?$/;

/**
 * A dashboard's clock (reports.md §2.4): a date field every tile that counts records has, or a
 * field per model. The fields by model, or nothing when it is refused.
 */
export function readDashboardPeriod(
  ctx: ParseContext,
  value: ParsedNode,
  items: readonly DashboardItem[],
  parsed: Partial<SpecIR>,
  where: string,
): Record<string, string> | undefined {
  // A list of what is due, the latest changes and a custom query are not in a period.
  const scoped = [
    ...new Set(
      items
        .filter((i) => i.kind !== "activity" && !i.query && !(i.kind === "list" && i.when))
        .map((i) => i.model),
    ),
  ];
  const written = isScalar(value) && typeof value.value === "string" ? value.value : undefined;
  const period: Record<string, string> = {};
  if (written !== undefined) for (const model of scoped) period[model] = written;
  else if (isMap(value))
    for (const pair of value.items) {
      const key = isScalar(pair.key) ? String(pair.key.value) : "";
      if (isScalar(pair.value) && typeof pair.value.value === "string")
        period[key] = pair.value.value;
    }
  else {
    ctx.error(
      value,
      "invalid-value",
      `"period" in ${where} names a date field, or a date field per model.`,
    );
    return undefined;
  }
  let fine = true;
  for (const [name, fieldName] of Object.entries(period)) {
    const model = parsed.models?.find((m) => m.name === name);
    if (!model) {
      ctx.error(
        value,
        "invalid-value",
        `"period" in ${where} names "${name}", which is not a model.`,
      );
      fine = false;
      continue;
    }
    const field = model.fields.find((f) => f.name === fieldName);
    if (
      field?.type.kind !== "scalar" ||
      (field.type.name !== "date" && field.type.name !== "datetime")
    ) {
      ctx.error(
        value,
        "invalid-value",
        `"period" in ${where}: ${name} has no date field named "${fieldName}".`,
      );
      fine = false;
    }
  }
  for (const model of scoped)
    if (!period[model]) {
      ctx.error(
        value,
        "invalid-value",
        `"period" in ${where} says no date field for ${model}, which a tile counts.`,
      );
      fine = false;
    }
  return fine ? period : undefined;
}

/**
 * A filter one reference away (reports.md §2.1), `session.startsAt`: the reference, and the field
 * of the record it names; what is wrong with it, or nothing.
 */
export function filterThrough(
  model: ModelIR,
  name: string,
  models: readonly ModelIR[],
): { through: FieldIR; target: ModelIR; field: FieldIR } | { problem: string; near?: string[] } {
  const [first = "", second = "", ...more] = name.split(".");
  if (more.length) return { problem: `"${name}" goes one reference away at most.` };
  const through = model.fields.find((f) => f.name === first);
  if (!through) return { problem: `${model.name} has no field named "${first}".` };
  if (through.type.kind !== "relation" || through.type.many || through.type.model === "User")
    return {
      problem: `"${first}" is not a reference to one record, so "${name}" cannot be a filter.`,
    };
  const targetName = through.type.model;
  const target = models.find((m) => m.name === targetName);
  if (!target) return { problem: `There is no model named "${targetName}".` };
  const field = target.fields.find((f) => f.name === second);
  if (!field)
    return {
      problem: `${target.name} has no field named "${second}".`,
      near: target.fields.map((f) => f.name),
    };
  if (!filterable(field) || (field.type.kind === "relation" && field.type.model === "User"))
    return {
      problem: `"${name}" cannot be a filter: one reference away, only choices, references to records, numbers, amounts, dates and yes/no fields can.`,
    };
  return { through, target, field };
}

/**
 * What is wrong with a filter's value as the address would carry it (a default filter's), or
 * nothing: a date takes a relative word or a range, a number a range, a choice its values, yes/no
 * true or false, the owner "mine", a person "me" or "none"; a reference to another record takes
 * no default, since an id changes with the data.
 */
export function filterValueProblem(
  model: ModelIR,
  name: string,
  value: string,
  models: readonly ModelIR[] = [],
): string | undefined {
  if (name.includes(".")) {
    const away = filterThrough(model, name, models);
    if ("problem" in away) return away.problem;
    return filterValueProblem(away.target, away.field.name, value);
  }
  const range = (text: string, re: RegExp, kind: string) =>
    re.test(text) && text !== ".."
      ? undefined
      : `"${name}" is ${kind}, so its default is a range like ${kind === "a date" ? "2026-01-01..2026-12-31" : "10..500"}, either side left out${kind === "a date" ? `, or one of ${RELATIVE_DATES.join(", ")}` : ""}; "${value}" is neither.`;
  if (name === "owner")
    return value === "mine" ? undefined : `"owner" filters to "mine" only; "${value}" is not that.`;
  if (name === "createdAt" || name === "updatedAt")
    return (RELATIVE_DATES as readonly string[]).includes(value)
      ? undefined
      : range(value, DATE_RANGE, "a date");
  const field = model.fields.find((f) => f.name === name);
  if (!field) return `${model.name} has no field named "${name}".`;
  if (field.type.kind === "choice") {
    const values = field.type.values;
    const wrong = value.split(",").find((v) => !values.includes(v.trim()));
    return wrong === undefined
      ? undefined
      : `"${name}" is one of ${values.join(", ")}; "${wrong}" is not.`;
  }
  if (field.type.kind === "relation")
    return field.type.model === "User"
      ? value.split(",").every((v) => v.trim() === "me" || v.trim() === "none")
        ? undefined
        : `"${name}" refers to a person: its default is "me", "none" or both; "${value}" is neither.`
      : `"${name}" refers to a record, whose id changes with the data: it takes no default.`;
  if (field.type.kind === "scalar") {
    const kind = field.type.name;
    if (kind === "bool")
      return value === "true" || value === "false"
        ? undefined
        : `"${name}" is yes or no: its default is true or false; "${value}" is neither.`;
    if (kind === "date" || kind === "datetime")
      return (RELATIVE_DATES as readonly string[]).includes(value)
        ? undefined
        : range(value, DATE_RANGE, "a date");
    if (RANGE.includes(kind)) return range(value, NUMBER_RANGE, "a number");
  }
  return `"${name}" is not a filter.`;
}

/**
 * A page's default filter, checked: each key one of the page's filters, each value one its
 * filter takes; the valid ones.
 */
export function checkDefaultFilter(
  ctx: ParseContext,
  entries: { name: string; value: string; at: At }[],
  filters: string[],
  model: string,
  parsed: Partial<SpecIR>,
  where: string,
): Record<string, string> {
  const target = parsed.models?.find((m) => m.name === model);
  const out: Record<string, string> = {};
  if (!target) return out;
  for (const { name, value, at } of entries) {
    if (!filters.includes(name)) {
      ctx.error(
        at,
        "invalid-default-filter",
        `"${name}" is not among the filters of ${where}, so it has no default; add it to "filters" first.`,
        didYouMean(name, filters),
      );
      continue;
    }
    const problem = filterValueProblem(target, name, value, parsed.models ?? []);
    if (problem)
      ctx.error(at, "invalid-default-filter", `The default filter of ${where}: ${problem}`);
    else out[name] = value;
  }
  return out;
}

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
  away = false,
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
    // One reference away (reports.md §2.1): a list's filter only, never a calendar's or an order.
    if (name.includes(".") && key === "filters" && away) {
      const found = filterThrough(target, name, parsed.models ?? []);
      if ("problem" in found)
        ctx.error(
          at,
          "invalid-filter",
          `The filters of ${where}: ${found.problem}`,
          found.near ? didYouMean(name.split(".")[1] ?? "", found.near) : undefined,
        );
      else if (names.includes(name))
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
  /** Whether a filter may go one reference away: a crud page's. */
  away = false,
): string[] => checkListFields(ctx, "filters", fields, model, parsed, where, away);

/** The fields a list may be sorted by, checked against the model; the valid ones, in order. */
export const checkSortableFields = (
  ctx: ParseContext,
  fields: { name: string; at: At }[],
  model: string,
  parsed: Partial<SpecIR>,
  where: string,
): string[] => checkListFields(ctx, "sortable", fields, model, parsed, where);
