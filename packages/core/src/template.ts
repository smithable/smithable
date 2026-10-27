// The one template form the spec has: `{path}` in a text, filled from values (docs/design/
// outgoing-templates.md §3; an incoming entry's `set` and a record's title use it too). No
// conditions, no loops, no formatting codes: a missing value is an empty text, and a text
// without braces is itself. The app kit carries its own copy of `fillText` (a generated app
// depends on no Smithable package); the adapter's test keeps the two alike.

/** A text's placeholders, trimmed: "{customer.name} booked {title}" → ["customer.name", "title"]. */
export function placeholdersOf(text: string): string[] {
  return [...text.matchAll(/\{([^{}]+)\}/g)].map((m) => (m[1] ?? "").trim());
}

/**
 * Fills `{path}` placeholders from `values` (a map or a function of the path); a value that is
 * missing renders as nothing. `oneLine` (a mail's subject) turns a newline in a value into a space.
 */
export function fillText(
  text: string,
  values: Record<string, string | undefined> | ((path: string) => string | undefined),
  oneLine = false,
): string {
  const lookup =
    typeof values === "function"
      ? values
      : (path: string) => (Object.hasOwn(values, path) ? values[path] : undefined);
  return text.replace(/\{([^{}]+)\}/g, (_, path: string) => {
    const value = lookup(path.trim()) ?? "";
    return oneLine ? value.replace(/\r?\n/g, " ") : value;
  });
}
