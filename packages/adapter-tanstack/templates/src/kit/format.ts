// Smithable app kit: converts stored values to display text and to form input text, and back.

import { FORMATS, MINUS, numberText } from "./formats";
import type { AppUi, FieldUi, RecordFieldUi } from "./model";
import { dateText, shownZone, whenAt, whenOf } from "./time-text";
import { language, w } from "./words";
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
  return dateOnly
    ? dateText(whenOf(String(value)), { weekday: "short" })
    : dateText(whenAt(value instanceof Date ? value : String(value), timeZone), {
        weekday: "short",
        time: true,
      });
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
      return moneyText(Number(value), app.currency);
    case "int":
    case "decimal":
      return numberText(Number(value));
    case "bool":
      return value ? w.yes : w.no;
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
      return dayText(String(value));
    case "datetime":
      return instantText(value instanceof Date ? value : String(value), app.timeZone);
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
  if (field.kind === "money") return inputNumber(Number(value) / 100, 2);
  if (field.kind === "decimal") return inputNumber(Number(value));
  if (field.kind === "datetime")
    return wallTime(value instanceof Date ? value : new Date(String(value)), shownZone(timeZone));
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
      return readNumber(text);
    case "money":
      return Math.round(readNumber(text) * 100);
    case "datetime":
      return instantOf(text, shownZone(timeZone));
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
  const size = numberText(mb ? bytes / 1_000_000 : Math.max(1, bytes / 1000), { max: mb ? 1 : 0 });
  return `${size}\u00a0${mb ? "MB" : "kB"}`;
}

export { numberText };

/** A share in hundredths as the app writes it: "12.5%", or "12,5 %" with a comma. */
export function percentText(n: number, maxDigits = 1): string {
  return `${numberText(n, { max: maxDigits })}${FORMATS.numbers === "comma" ? "\u00a0%" : "%"}`;
}

/** A large number short, for a chart's bar: "1.2K", "1,2 tn". */
export function compactText(n: number): string {
  // The scale by the number as rounded, so 999,950 is "1M", not "1,000K".
  const shown = (scale: number) => Math.round((Math.abs(n) / scale) * 10) / 10;
  const [scale, word] =
    shown(1e6) >= 1000
      ? [1e9, w.billionShort]
      : shown(1e3) >= 1000
        ? [1e6, w.millionShort]
        : Math.abs(n) >= 1e4
          ? [1e3, w.thousandShort]
          : [1, ""];
  return `${numberText(n / scale, { max: scale === 1 ? 2 : 1 })}${word}`;
}

/** A currency's word in the page's language and its minor units, asked once each. */
const currencies = new Map<string, { symbol: string; digits: number }>();
function currencyOf(currency: string) {
  const key = `${language()}:${currency}`;
  let known = currencies.get(key);
  if (!known) {
    const format = new Intl.NumberFormat(language(), { style: "currency", currency });
    known = {
      symbol: format.formatToParts(0).find((p) => p.type === "currency")?.value ?? currency,
      digits: format.resolvedOptions().maximumFractionDigits ?? 2,
    };
    currencies.set(key, known);
  }
  return known;
}

/**
 * An amount stored in hundredths, in the app's currency: before the number with a point
 * ("€9.90", "SEK 9.90"), after it with a comma ("9,90 €", "100,00 kr"); the currency's word in
 * the page's language, its minor units its own. `compact` shortens a large one for a chart.
 */
export function moneyText(cents: number, currency = "EUR", compact = false): string {
  const { symbol, digits } = currencyOf(currency);
  const amount = Math.abs(cents) / 100;
  const number =
    compact && amount >= 1e4
      ? compactText(amount)
      : numberText(amount, { min: digits, max: digits });
  const minus = cents < 0 && number.replace(/[^1-9]/g, "") !== "" ? MINUS : "";
  if (FORMATS.numbers === "comma") return `${minus}${number}\u00a0${symbol}`;
  return `${minus}${symbol}${/\p{L}$/u.test(symbol) ? "\u00a0" : ""}${number}`;
}

/** A date field's day ("2026-11-05") as the app writes it: "5 Nov 2026". */
export function dayText(
  day: string,
  shown: Parameters<typeof dateText>[1] = { year: true },
): string {
  return dateText(whenOf(day), shown);
}

/** An instant in the shown zone, with its time: "5 Nov 2026, 14:30". */
export function instantText(
  instant: Date | string | number,
  appZone?: string,
  shown: Parameters<typeof dateText>[1] = { year: true, time: true },
): string {
  return dateText(whenAt(instant, appZone), shown);
}

/**
 * A number typed into a form, read by the app's convention: its grouping ignored, its decimal
 * mark read; the other mark only where it cannot be grouping ("1,5" with a point is 1.5, "1,234"
 * is 1234). NaN for text that is no number.
 */
export function readNumber(text: string): number {
  const comma = FORMATS.numbers === "comma";
  const [mark, other] = comma ? [",", "."] : [".", ","];
  let t = text
    .trim()
    .replace(/[\s\u00a0\u202f']/g, "")
    .replace(/^[\u2212\u2013]/, "-");
  // Grouping is the other mark before each group of three; any other left is no number.
  t = comma ? t.replace(/\.(?=\d{3}(\D|$))/g, "") : t.replace(/,(?=\d{3}(\D|$))/g, "");
  if (!t.includes(mark) && t.split(other).length === 2) t = t.replace(other, mark);
  return /^-?(\d+([.,]\d*)?|[.,]\d+)$/.test(t) && !t.includes(other)
    ? Number(t.replace(mark, "."))
    : Number.NaN;
}

/** A number as a form shows it, in the app's convention with no grouping: "1234,5". */
export function inputNumber(n: number, digits?: number): string {
  // Never in exponent form ("1e-7"), which a person cannot type back.
  const text =
    digits === undefined ? n.toFixed(10).replace(/\.?0+$/, "") || "0" : n.toFixed(digits);
  return FORMATS.numbers === "comma" ? text.replace(".", ",") : text;
}
