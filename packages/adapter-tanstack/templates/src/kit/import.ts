// Smithable app kit: records from a CSV file (A 238). Which column fills which field (by its label
// or its name, loosely), and each cell as the form would store it: a choice by its label or value,
// a reference by the title of the record it names, a date in any plain form, a number with a
// decimal comma or point. Pure, so the Import panel's preview and the server read a file alike.
import { fromInput, readNumber } from "./format";
import type { FieldUi, ModelUi } from "./model";
import { w } from "./words";

/** At most this many records in one import. */
export const IMPORT_MAX = 10_000;

export interface ImportRefusal {
  /** The record's line in the file (the header is line 1); 0 for the file as a whole. */
  line: number;
  column?: string;
  message: string;
}

export interface ImportPlan {
  columns: { column: string; field: FieldUi; at: number }[];
  ignored: string[];
  refusals: ImportRefusal[];
}

const loose = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** A field a file can fill: a stored value or a reference, not pictures, files, people or sums. */
export function importable(field: FieldUi): boolean {
  return (
    !field.computed &&
    !field.byApp &&
    !["picture", "pictures", "file", "files", "user"].includes(field.kind)
  );
}

/** Which column fills which field, the columns left out, and what makes the file unusable. */
export function planImport(model: ModelUi, header: string[], rows: number): ImportPlan {
  const plan: ImportPlan = { columns: [], ignored: [], refusals: [] };
  header.forEach((raw, at) => {
    const column = raw.trim();
    const field = model.fields.find((f) =>
      [f.label, f.name, f.relation?.key].some((n) => n && loose(n) === loose(column)),
    );
    if (!field) {
      if (column) plan.ignored.push(column);
      return;
    }
    if (!importable(field)) {
      plan.refusals.push({ line: 1, column, message: w.importCannotFill(field.label) });
      return;
    }
    if (plan.columns.some((c) => c.field.name === field.name)) {
      plan.refusals.push({ line: 1, column, message: w.importTwoColumns(field.label) });
      return;
    }
    plan.columns.push({ column, field, at });
  });
  for (const field of model.fields.filter(importable))
    if (
      field.required &&
      field.default === undefined &&
      !field.requiredWhen &&
      !plan.columns.some((c) => c.field.name === field.name)
    )
      plan.refusals.push({ line: 1, message: w.importNoColumn(field.label) });
  if (rows > IMPORT_MAX)
    plan.refusals.push({ line: 0, message: w.importTooMany(rows, IMPORT_MAX) });
  return plan;
}

/** A referenced record's id by its title; "several" when two have it. */
export type Lookup = (field: string, title: string) => number | "several" | undefined;

const YES = ["yes", "true", "1", "x", "ja", "y", "j"];
const NO = ["no", "false", "0", "nej", "n"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * A date written plainly, as "YYYY-MM-DD": 2026-11-09, 9.11.2026, 9/11/2026 (the day first, as
 * most of the world writes it; the month first when the day cannot be, 11/29/2026), 9 Nov 2026.
 */
export function plainDate(text: string): string | undefined {
  const pad = (n: number) => String(n).padStart(2, "0");
  const valid = (y: number, m: number, d: number) => {
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCMonth() === m - 1 && date.getUTCDate() === d && y > 999
      ? `${y}-${pad(m)}-${pad(d)}`
      : undefined;
  };
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (iso) return valid(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const numeric = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (numeric) {
    const [a, b, y] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])];
    return a > 12 || b <= 12 ? valid(y, b, a) : valid(y, a, b);
  }
  const words = /^(\d{1,2})\.?\s+([\p{L}]+)\.?,?\s+(\d{4})$/u.exec(text);
  if (words) {
    const month = MONTHS.indexOf((words[2] ?? "").slice(0, 3).toLowerCase()) + 1;
    return month ? valid(Number(words[3]), month, Number(words[1])) : undefined;
  }
  return undefined;
}

/** A cell as its field stores it, or why it cannot be. An empty cell is no value. */
export function convertCell(
  field: FieldUi,
  cell: string,
  lookup: Lookup,
  timeZone?: string,
): { value: unknown } | { problem: string } {
  const text = cell.trim();
  if (text === "") return { value: null };
  switch (field.kind) {
    case "choice": {
      const found = field.choices?.find(
        (c) => loose(c.value) === loose(text) || loose(c.label) === loose(text),
      );
      return found
        ? { value: found.value }
        : { problem: w.importNotOneOf((field.choices ?? []).map((c) => c.label).join(", ")) };
    }
    case "relation": {
      const id = lookup(field.name, text);
      if (id === "several") return { problem: w.importSeveral(text) };
      return id === undefined ? { problem: w.importNoSuch(text) } : { value: id };
    }
    case "bool": {
      if (YES.includes(text.toLowerCase())) return { value: true };
      if (NO.includes(text.toLowerCase())) return { value: false };
      return { problem: w.importNotYesNo };
    }
    case "date": {
      const date = plainDate(text);
      return date ? { value: date } : { problem: w.importNotDate };
    }
    case "datetime": {
      const [, day = "", time = "00:00"] =
        /^(.+?)(?:[ T](\d{1,2}[:.]\d{2}(?::\d{2})?))?$/.exec(text) ?? [];
      const date = plainDate(day);
      if (!date) return { problem: w.importNotDate };
      const [h = "0", m = "0"] = time.split(/[:.]/);
      return { value: fromInput(field, `${date}T${h.padStart(2, "0")}:${m}`, timeZone) };
    }
    case "int":
    case "decimal":
    case "money": {
      const number = readNumber(text);
      if (!Number.isFinite(number) || (field.kind === "int" && !Number.isInteger(number)))
        return { problem: w.importNotNumber };
      return { value: fromInput(field, text) };
    }
    default:
      return { value: text };
  }
}
