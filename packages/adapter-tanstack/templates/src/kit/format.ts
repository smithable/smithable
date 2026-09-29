// Smithable app kit: converts stored values to display text and to form input text, and back.
import type { AppUi, FieldUi, RecordFieldUi } from "./model";
import { instant, wallTime } from "./zoned";

/** The value to show for a field of a record: for a reference, the related record's title. */
export function displayValue<R>(field: RecordFieldUi<R>, row: R): unknown {
  return field.get(row);
}

/** Text for showing a stored value in tables and headings. */
export function formatValue(field: FieldUi, value: unknown, app: AppUi): string {
  if (value === null || value === undefined || value === "") return "—";
  switch (field.kind) {
    case "money":
      return new Intl.NumberFormat(undefined, { style: "currency", currency: app.currency }).format(
        Number(value) / 100,
      );
    case "int":
    case "decimal":
      return new Intl.NumberFormat().format(Number(value));
    case "bool":
      return value ? "Yes" : "No";
    case "date":
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(
        new Date(`${String(value)}T00:00:00Z`),
      );
    case "datetime":
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: app.timeZone,
      }).format(value instanceof Date ? value : new Date(String(value)));
    case "choice":
      return field.choices?.find((c) => c.value === value)?.label ?? String(value);
    case "relation":
    case "user":
      return String(value);
    default:
      return String(value);
  }
}

/**
 * The form input's text for a stored value. Booleans stay booleans. A date and time is shown in
 * the app's time zone, as pages show it.
 */
export function toInput(field: FieldUi, value: unknown, timeZone?: string): string | boolean {
  if (field.kind === "bool") return Boolean(value);
  if (value === null || value === undefined) return "";
  if (field.kind === "money") return (Number(value) / 100).toFixed(2);
  if (field.kind === "datetime")
    return wallTime(value instanceof Date ? value : new Date(String(value)), timeZone);
  return String(value);
}

/** The stored value for a form input's text. Empty text becomes null. */
export function fromInput(field: FieldUi, input: string | boolean, timeZone?: string): unknown {
  if (typeof input === "boolean") return input;
  const text = input.trim();
  if (text === "") return null;
  switch (field.kind) {
    case "int":
    case "decimal":
      return Number(text.replace(",", "."));
    case "money":
      return Math.round(Number(text.replace(",", ".")) * 100);
    case "datetime":
      return instant(text, timeZone);
    case "relation":
      return Number(text);
    default:
      return text;
  }
}
