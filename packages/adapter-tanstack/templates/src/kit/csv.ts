// Smithable app kit: a list as a CSV file (Export CSV): the model's fields by their labels,
// values as a spreadsheet reads them (amounts as decimals, dates and times as ISO, a reference
// by its record's title, a choice by its label), nothing a picture or document field holds.
import type { RecordUi, Row } from "./model";
import { w } from "./words";

const SKIPPED = new Set(["picture", "pictures", "file", "files"]);

/** One cell: quoted when it must be, and never read as a formula by a spreadsheet. */
export function cell(value: unknown): string {
  let text = value == null ? "" : String(value);
  // A number stays a number (-12.50); anything else that starts like a formula, even after
  // spaces, is written as text.
  if (!/^-?\d+(\.\d+)?$/.test(text) && /^[=+\-@\t\r]/.test(text.trimStart())) text = `'${text}`;
  return /[",\r\n;]/.test(text) || text !== text.trim() ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A field's value as the CSV gives it. */
function fieldValue<R extends Row>(field: RecordUi<R>["fields"][number], row: R): unknown {
  const value = field.get(row);
  if (value === null || value === undefined || value === "") return "";
  switch (field.kind) {
    case "money":
      return (Number(value) / 100).toFixed(2);
    case "datetime":
      return value instanceof Date ? value.toISOString() : String(value);
    case "bool":
      return value ? w.yes : w.no;
    case "choice":
      return field.choices?.find((c) => c.value === value)?.label ?? value;
    default:
      return value;
  }
}

/** The rows as CSV text, a header line first; with a BOM so spreadsheets read it as UTF-8. */
export function csvOf<R extends Row>(ui: RecordUi<R>, rows: R[], note?: string): string {
  const fields = ui.fields.filter((f) => !SKIPPED.has(f.kind));
  const shown = ui.compute ? rows.map((row) => ({ ...row, ...ui.compute?.(row) }) as R) : rows;
  const lines = [
    // An export cut at the cap says so first ("Exported 10,000 of 14,200 matching records").
    ...(note ? [cell(note)] : []),
    fields.map((f) => cell(f.label)).join(","),
    ...shown.map((row) => fields.map((f) => cell(fieldValue(f, row))).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** The file's name, e.g. customers.csv. */
export function csvName(ui: { pluralLabel: string }): string {
  return `${ui.pluralLabel.toLowerCase().replace(/\s+/g, "-")}.csv`;
}

/** Saves the text as a file in the browser, e.g. customers.csv. */
export function download(name: string, text: string, type = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
