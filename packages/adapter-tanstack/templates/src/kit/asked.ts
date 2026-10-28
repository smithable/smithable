// Smithable app kit: what Ask asked the records, in words (docs/design/assistant.md §6). Under a
// read's result the panel says the question the tool was given ("Components where status is
// down · 0 of 4"), so an answer that read a question one of two ways shows how it read it. When a
// filter on a choice found none, how the records split by that field is said beside it. Pure:
// the app's words (its kinds, fields and values) come in as `kinds`, as the wording rules get them.
import type { AskKind, Range, Where } from "./ask";
import { w } from "./words";

/** `measure … by` as it comes back: a number per value of the field. */
export interface Spread {
  by?: string;
  rows?: { value: unknown; title?: string; number: unknown }[];
}

type Args = { [key: string]: unknown };

const labelOf = (kind: AskKind, name: string): string =>
  kind.fields.find((f) => f.name === name)?.label ?? name;

/** A filter's value as the app shows it: a choice's label, yes or no, a range, a title or id. */
function valueWord(kind: AskKind, field: string, value: unknown): string {
  if (Array.isArray(value)) return w.orList(value.map((v) => valueWord(kind, field, v)));
  if (typeof value === "boolean") return value ? w.yes : w.no;
  if (value && typeof value === "object") {
    const range = value as Range;
    if (range.over !== undefined) return w.over(String(range.over));
    if (range.under !== undefined) return w.under(String(range.under));
    return w.fromTo(
      range.from === undefined ? undefined : String(range.from),
      range.to === undefined ? undefined : String(range.to),
    );
  }
  const text = String(value);
  const filter = kind.filters.find((f) => f.field === field);
  return (filter?.by === "value" ? filter.labels?.[text] : undefined) ?? text;
}

/** The conditions of a call, in words: each `where` as "field is value", a search as its words. */
function conditions(kind: AskKind, args: Args): string[] {
  const where = (args.where ?? {}) as Where;
  const said = Object.entries(where).map(([field, value]) =>
    field === "mine" ? w.yoursOnly : w.fieldIs(labelOf(kind, field), valueWord(kind, field, value)),
  );
  if (typeof args.search === "string" && args.search) said.push(w.withWords(args.search));
  return said;
}

/** A find or a count that found nothing. */
export function foundNone(result: unknown): boolean {
  return !!result && typeof result === "object" && (result as { total?: unknown }).total === 0;
}

/**
 * The choice field a `where` names that the app can count by, for the spread; none when the
 * call did not filter on a choice.
 */
export function spreadField(kind: AskKind, where: unknown): string | undefined {
  if (!where || typeof where !== "object") return undefined;
  return Object.keys(where).find(
    (field) =>
      kind.by.includes(field) && kind.filters.some((f) => f.field === field && f.by === "value"),
  );
}

/** How the records split by the field, as "1 degraded, 3 operational". */
export function spreadWords(
  kind: AskKind,
  field: string,
  rows: NonNullable<Spread["rows"]>,
): string {
  return rows
    .map((row) => `${String(row.number ?? 0)} ${row.title ?? valueWord(kind, field, row.value)}`)
    .join(", ");
}

/** What a read asked, in words; nothing for a tool that is not a read. */
export function asked(
  tool: string,
  args: Args,
  result: unknown,
  kind: AskKind,
  split?: Spread,
): string | undefined {
  const r = (result && typeof result === "object" ? result : {}) as {
    total?: unknown;
    rows?: unknown;
  };
  switch (tool) {
    case "find": {
      const sort = typeof args.sort === "string" ? args.sort : "";
      const shown = Array.isArray(r.rows) ? r.rows.length : 0;
      // Of all: the total found; when none was, the spread's sum says how many there are.
      const all = split?.rows?.length
        ? split.rows.reduce((n, row) => n + Number(row.number ?? 0), 0)
        : typeof r.total === "number"
          ? r.total
          : undefined;
      return w.askedFind(
        kind.pluralLabel,
        conditions(kind, args),
        sort ? w.sortedBy(labelOf(kind, sort.replace(/^-/, "")), sort.startsWith("-")) : "",
        shown,
        all,
      );
    }
    case "measure": {
      const [how = "count", field] = (typeof args.of === "string" ? args.of : "count").split(/\s+/);
      return w.askedMeasure(
        how,
        field ? labelOf(kind, field) : undefined,
        kind.pluralLabel,
        conditions(kind, args),
        typeof args.by === "string" ? labelOf(kind, args.by) : undefined,
      );
    }
    case "read":
      return w.askedRead(kind.label, String(args.id ?? ""));
    default:
      return undefined;
  }
}
