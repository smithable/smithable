// A model or a page renamed: every place the files name it follows. The parsers record where a
// name is written (ParseContext.reference, the scalar that holds it), so a rename rewrites exactly
// those characters and leaves the rest of the text byte for byte, like every other edit.
import type { NameReference, SymbolKind } from "./context.js";
import { EditError } from "./edit.js";

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The text with each reference of `kind` to `from` reading `to`: the name as a whole word inside
 * the scalar ("Customer!", "Customer[]", "Customer.total", a quoted "Customer"), nothing else.
 */
export function renameReferences(
  text: string,
  references: NameReference[],
  kind: SymbolKind,
  from: string,
  to: string,
): string {
  const word = new RegExp(`(^|[^A-Za-z0-9_])${escaped(from)}(?![A-Za-z0-9_])`);
  const places = [
    ...new Map(
      references.filter((r) => r.kind === kind && r.name === from).map((r) => [r.start, r]),
    ).values(),
  ].sort((a, b) => b.start - a.start);
  let out = text;
  for (const { start, end } of places) {
    const scalar = out.slice(start, end);
    const renamed = scalar.replace(word, (_, before: string) => `${before}${to}`);
    if (renamed === scalar)
      throw new EditError(`Could not rename ${kind} "${from}" in "${scalar.trim()}".`);
    out = `${out.slice(0, start)}${renamed}${out.slice(end)}`;
  }
  return out;
}
