// Smithable app kit: what a program or an assistant may ask of a list (docs/design/assistant.md
// §3): `where` as the spec's own condition (a choice value or a list of them, yes or no), a
// number or date range ({ from, to } inclusive, { over, under } strict: "over 5 000" is more
// than), a reference by id or by its record's title, and `mine`;
// refused in the app's words, naming what exists, when it names a field or value that does not.
import {
  and,
  asc,
  type Column,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  lte,
  or,
  type SQL,
  sql,
  type Table,
} from "drizzle-orm";
import { BadInput } from "./refusal";
import { relatedContains } from "./search";

/**
 * A value no record has (a choice's value that does not exist, a reference by a name nothing
 * has): the API refuses it, the assistants' tools answer "none" with this as the note
 * (docs/design/ask-checks.md §2).
 */
export class NoSuchValue extends BadInput {}

/** A field as `where` may name it. */
export type Filterable =
  | { kind: "text" | "bool"; column: Column }
  | { kind: "choice"; column: Column; values: readonly string[] }
  | { kind: "number" | "money" | "date" | "instant"; column: Column }
  /** A reference: by id, or by its record's title (`title`, when the record has one). */
  | { kind: "reference"; column: Column; title?: { table: Table; column: Column } };

const list = (v: unknown) =>
  (Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : [v]).map((x) =>
    typeof x === "string" ? x.trim() : x,
  );

/** One value of a number, amount or date field, as the column stores it. */
function stored(field: Filterable, v: unknown, name: string, end = false): unknown {
  if (field.kind === "number" || field.kind === "money") {
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isFinite(n)) throw new BadInput(`"${name}" is a number, like 12.50.`);
    return field.kind === "money" ? Math.round(n * 100) : n;
  }
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v))
    throw new BadInput(`"${name}" is a date, like 2026-10-05.`);
  if (field.kind === "date") return v.slice(0, 10);
  return v.length > 10 ? new Date(v) : new Date(`${v}T${end ? "23:59:59.999" : "00:00:00.000"}Z`);
}

/**
 * The condition a `where` object asks for, among `fields`; `mine` is the caller's own records
 * (undefined when the records have no owner).
 */
export function whereOf(
  fields: Record<string, Filterable>,
  where: unknown,
  mine?: SQL,
  me?: string,
  /**
   * Per reference: the records the viewer may read whose title fits a text, and every title, for
   * the nearest when none fits.
   */
  named: Record<
    string,
    { find: (text: string) => { id: number; title: string }[]; titles: () => string[] }
  > = {},
): SQL | undefined {
  if (where === undefined || where === null) return undefined;
  if (typeof where !== "object" || Array.isArray(where))
    throw new BadInput('"where" is an object of fields and values, like { "status": "sent" }.');
  const parts: (SQL | undefined)[] = [];
  for (const [name, v] of Object.entries(where)) {
    if (name === "mine") {
      if (v !== true && v !== "true") continue;
      if (!mine) throw new BadInput("These records have no owner, so none are yours.");
      parts.push(mine);
      continue;
    }
    const field = fields[name];
    if (!field)
      throw new BadInput(
        `There is no field "${name}" to filter by. Fields: ${Object.keys(fields).join(", ")}.`,
      );
    // A range on a field that is no number or date finds nothing, quietly: refused, saying what
    // the field is (ask-checks.md §6).
    if (
      v &&
      typeof v === "object" &&
      !Array.isArray(v) &&
      !["number", "money", "date", "instant"].includes(field.kind)
    )
      throw new BadInput(
        field.kind === "text"
          ? `"${name}" is a text, not a number or a date: it takes no range. Use search for words in it, or read the field.`
          : `"${name}" is ${field.kind === "bool" ? "yes or no" : field.kind === "choice" ? `one of ${field.values.join(", ")}` : "a record, by its id or its title"}, not a number or a date: it takes no range.`,
      );
    if (field.kind === "choice") {
      const values = list(v).map(String);
      const wrong = values.find((x) => !field.values.includes(x));
      if (wrong)
        throw new NoSuchValue(`"${name}" is one of ${field.values.join(", ")}; not "${wrong}".`);
      parts.push(values.length === 1 ? eq(field.column, values[0]) : inArray(field.column, values));
    } else if (field.kind === "bool") {
      if (![true, false, "true", "false"].includes(v as never))
        throw new BadInput(`"${name}" is true or false.`);
      parts.push(eq(field.column, v === true || v === "true"));
    } else if (field.kind === "reference") {
      // "me" is the caller, for a reference to a user.
      if (v === "me") {
        parts.push(me ? eq(field.column, me) : sql`false`);
        continue;
      }
      const ids: unknown[] = list(v).filter(
        (x) => typeof x === "number" || /^\d+$/.test(String(x)),
      );
      let titles = list(v)
        .filter((x) => !ids.includes(x))
        .map(String);
      // By title, among the records the viewer may read: the one that fits, never a guess.
      const lookup = named[name];
      if (lookup) {
        for (const text of titles)
          ids.push(oneNamed(lookup.find(text), text, name, lookup.titles).id);
        titles = [];
      }
      if (titles.length && !field.title)
        throw new BadInput(`"${name}" is given by the record's id, a whole number.`);
      const title = field.title;
      parts.push(
        or(
          ids.length ? inArray(field.column, ids.map(Number)) : undefined,
          ...(title
            ? titles.map((t) => relatedContains(field.column, title.table, [title.column], t))
            : []),
        ),
      );
    } else if (field.kind === "text") {
      // A name as people write it: part of it, whatever the case ("Nordic Timber" finds
      // "Nordic Timber Oy"); the rows found show what was matched.
      const pattern = `%${String(v)
        .toLowerCase()
        .replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      parts.push(sql`lower(${field.column}) like ${pattern} escape '\\'`);
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      const { from, to, over, under } = v as Record<string, unknown>;
      const given = (x: unknown) => x !== undefined && x !== "";
      parts.push(
        and(
          given(from) ? gte(field.column, stored(field, from, name)) : undefined,
          given(to) ? lte(field.column, stored(field, to, name, true)) : undefined,
          // "Over" a day is after its end; "under" a day is before its start.
          given(over) ? gt(field.column, stored(field, over, name, true)) : undefined,
          given(under) ? lt(field.column, stored(field, under, name)) : undefined,
        ),
      );
    } else {
      parts.push(eq(field.column, stored(field, v, name)));
    }
  }
  return and(...parts);
}

/** "from..to" as a range, "a,b" as a list, else the value: a query parameter as `where` takes it. */
export function whereFromQuery(
  query: URLSearchParams,
  reserved: readonly string[],
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  for (const [key, value] of query) {
    if (reserved.includes(key)) continue;
    if (value.includes("..")) {
      const [from = "", to = ""] = value.split("..");
      where[key] = { from, to };
    } else where[key] = value;
  }
  return where;
}

/** "field" from low to high, "-field" from high to low, among the columns that can be sorted. */
export function sortOf(columns: Record<string, Column>, sort: string | undefined): SQL | undefined {
  if (!sort) return undefined;
  const column = columns[sort.replace(/^-/, "")];
  if (!column)
    throw new BadInput(
      `There is no field "${sort.replace(/^-/, "")}" to sort by. Fields: ${Object.keys(columns).join(", ")}.`,
    );
  return sort.startsWith("-") ? desc(column) : asc(column);
}

/** The words of a search: letters and digits, so "ship lamp" finds "ship's lamp". */
export function wordsOf(search: string | undefined): string[] {
  return (search ?? "").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

/** The sum, average, smallest or largest of the numbers among the values; none: null. */
export function aggregate(
  values: unknown[],
  how: "count" | "sum" | "average" | "smallest" | "largest",
): number | null {
  const numbers = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  if (how === "count") return numbers.length;
  if (!numbers.length) return null;
  const sum = numbers.reduce((a, b) => a + b, 0);
  if (how === "sum") return sum;
  if (how === "average") return sum / numbers.length;
  return how === "smallest" ? Math.min(...numbers) : Math.max(...numbers);
}

/**
 * The one record a text names, among those that fit it: the exact title when there is one, else
 * the only one; none or several is refused in words the caller can act on.
 */
export function oneNamed(
  found: { id: number; title: string }[],
  text: string,
  what: string,
  /** Every title there is, for the nearest when none fits. */
  titles?: () => string[],
): { id: number; title: string } {
  const exact = found.filter((r) => r.title.toLowerCase() === text.toLowerCase());
  const pick = exact.length === 1 ? exact : found;
  if (pick.length === 1 && pick[0]) return pick[0];
  if (!pick.length) {
    const near = titles ? nearest(text, titles()) : [];
    throw new NoSuchValue(
      `No ${what} called "${text}" that you may read.${near.length ? ` The nearest: ${near.join(", ")}.` : ""}`,
    );
  }
  throw new BadInput(
    `"${text}" fits several: ${pick
      .slice(0, 5)
      .map((r) => `${r.title} (${r.id})`)
      .join(", ")}. Give its whole name or its id.`,
  );
}

/**
 * The values nearest a text, the closest first (at most `n`): by the edit distance between the
 * text and the value, or the value's part of the text's length when that is closer ("Website
 * down" is near "Website outage"). For "none" with what there is instead.
 */
export function nearest(text: string, values: readonly string[], n = 3): string[] {
  const needle = text.toLowerCase();
  const scored = [...new Set(values)].map((value) => {
    const v = value.toLowerCase();
    const whole = distance(needle, v);
    const part = v.length > needle.length ? distance(needle, v.slice(0, needle.length)) : whole;
    return { value, score: Math.min(whole, part + 1) };
  });
  return scored
    .sort((a, b) => a.score - b.score || a.value.localeCompare(b.value))
    .slice(0, n)
    .map((s) => s.value);
}

/** The edits that turn one text into another. */
function distance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++)
      current[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    previous = current;
  }
  return previous[b.length] ?? 0;
}
