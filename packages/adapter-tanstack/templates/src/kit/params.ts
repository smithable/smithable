// Smithable app kit: an address's search values, checked by hand. A route's checks load with
// the route tree, on every first page, so a validation library here would be in every visitor's
// first download (docs/benchmarks/app-size-2026-10-07.md).

export type Search = Record<string, unknown>;

/** A text, at most `max` characters, else nothing. */
export function text(value: unknown, max = 200): string | undefined {
  return typeof value === "string" && value.length <= max ? value : undefined;
}

/** A text of the given shape (`?week=2026-W41`), else nothing. */
export function shaped(value: unknown, shape: RegExp): string | undefined {
  return typeof value === "string" && shape.test(value) ? value : undefined;
}

/** A whole number above zero (a page, an id), from the address's number or text, else nothing. */
export function count(value: unknown): number | undefined {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** One of the given words, else nothing. */
export function oneOf<T extends string>(value: unknown, values: readonly T[]): T | undefined {
  return (values as readonly unknown[]).includes(value) ? (value as T) : undefined;
}

/**
 * A list's query from its page (a server function's input): what to search for, the order, the
 * Saved view, the filters, which page, and all of it for an export. What is not of its kind is
 * left out.
 */
export function listQuery(data: unknown) {
  const d = (data ?? {}) as Search;
  const f =
    d.f && typeof d.f === "object"
      ? Object.fromEntries(
          Object.entries(d.f as Search).flatMap(([k, v]) =>
            text(v) === undefined ? [] : [[k, v as string]],
          ),
        )
      : undefined;
  return {
    q: text(d.q),
    sort: text(d.sort, 60),
    view: oneOf(d.view, ["saved"] as const),
    f,
    page: count(d.page),
    all: d.all === true ? true : undefined,
  };
}

/** A required text of a server function's input, trimmed; a missing or too long one is refused. */
export function field(data: unknown, name: string, max: number): string {
  const value = (data as Search | null)?.[name];
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed || trimmed.length > max)
    throw new Error(`${name}: a text of 1 to ${max} characters`);
  return trimmed;
}

/** An address's checked values, each one optional, as a link may leave any of them out. */
/**
 * A list's filters with the page's defaults: a filter the address says nothing about takes its
 * default, and "all" in the address clears one (so the default can be taken away).
 */
export function withDefaults<T extends Record<string, string | undefined>>(
  given: T,
  defaults: Record<string, string>,
): T {
  const out = { ...given };
  for (const [name, value] of Object.entries(defaults)) {
    const key = name as keyof T;
    if (out[key] === undefined) out[key] = value as T[keyof T];
    else if (out[key] === "all") delete out[key];
  }
  return out;
}

export function optional<T extends object>(values: T): Partial<T> {
  return values;
}
