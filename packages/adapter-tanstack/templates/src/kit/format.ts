// Smithable app kit: converts stored values to display text and to form input text, and back.
import type { AppUi, FieldUi, RecordFieldUi } from "./model";
import { instantOf, wallTime } from "./zoned";

/** The value to show for a field of a record: for a reference, the related record's title. */
export function displayValue<R>(field: RecordFieldUi<R>, row: R): unknown {
  return field.get(row);
}

/**
 * A record's title as shown: its first line, at most sixty characters. A short name is shown as
 * it is; a model titled by a long text (a message's words) shows their start. The API keeps the
 * whole value.
 */
export function titleOf(value: unknown): string {
  const line =
    String(value ?? "")
      .split("\n")
      .map((l) => l.replace(/^[#>*\-\s]+/, "").trim())
      .find(Boolean) ?? "";
  return line.length > 60 ? `${line.slice(0, 59).trimEnd()}…` : line;
}

/**
 * A date or date-time as a record's name says it (docs/design/record-names.md §1), short:
 * "Mon 19 Oct, 08:00", a date alone "Mon 19 Oct". Nothing for no value.
 */
export function shortWhen(value: unknown, dateOnly: boolean, timeZone?: string): string {
  if (value === null || value === undefined || value === "") return "";
  const instant = dateOnly
    ? new Date(`${String(value)}T00:00:00Z`)
    : value instanceof Date
      ? value
      : new Date(String(value));
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(dateOnly
      ? { timeZone: "UTC" }
      : { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone }),
  }).format(instant);
}

/** A record's name from its parts' words, " · " between them, the empty ones left out. */
export function nameOf(parts: string[], fallback: string): string {
  const shown = parts.filter(Boolean);
  return shown.length ? shown.join(" · ") : fallback;
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
    case "picture":
      return typeof value === "object" && value && "alt" in value ? String(value.alt) : "Picture";
    case "pictures": {
      // The cover's description; no pictures reads as nothing.
      const cover = Array.isArray(value) ? value[0] : undefined;
      return cover ? String(cover.alt || "Picture") : "—";
    }
    case "file":
      return typeof value === "object" && value && "name" in value ? String(value.name) : "—";
    case "files": {
      const names = Array.isArray(value) ? value.map((f) => String(f?.name ?? "")) : [];
      return names.length ? names.join(", ") : "—";
    }
    case "date":
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(
        new Date(`${String(value)}T00:00:00Z`),
      );
    case "datetime":
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
        hourCycle: "h23",
        timeZone: app.timeZone,
      }).format(value instanceof Date ? value : new Date(String(value)));
    case "choice":
      return field.choices?.find((c) => c.value === value)?.label ?? String(value);
    case "relation":
    case "user":
      return titleOf(value);
    default:
      return String(value);
  }
}

/** The form input's text for a stored value, date-times in `timeZone`. Booleans stay booleans. */
export function toInput(field: FieldUi, value: unknown, timeZone?: string): string | boolean {
  if (field.kind === "bool") return Boolean(value);
  if (value === null || value === undefined) return "";
  if (field.kind === "money") return (Number(value) / 100).toFixed(2);
  if (field.kind === "datetime")
    return wallTime(value instanceof Date ? value : new Date(String(value)), timeZone);
  if (
    field.kind === "picture" ||
    field.kind === "pictures" ||
    field.kind === "file" ||
    field.kind === "files"
  )
    return typeof value === "object" ? JSON.stringify(value) : "";
  return String(value);
}

/** The stored value for a form input's text, date-times read in `timeZone`. Empty text becomes null. */
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
      return instantOf(text, timeZone);
    case "relation":
      return Number(text);
    case "picture":
    case "pictures":
    case "file":
    case "files":
      return JSON.parse(text);
    default:
      return text;
  }
}

/** A document's size as people read it: 820 kB, 2.4 MB. */
export function fileSize(bytes: number): string {
  const mb = bytes >= 1_000_000;
  return new Intl.NumberFormat(undefined, {
    style: "unit",
    unit: mb ? "megabyte" : "kilobyte",
    maximumFractionDigits: mb ? 1 : 0,
  }).format(mb ? bytes / 1_000_000 : Math.max(1, bytes / 1000));
}
