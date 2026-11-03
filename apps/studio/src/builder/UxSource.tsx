import { humanize, type UxInherited, type UxIR } from "@smithable/core";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { type Document, parseDocument } from "yaml";

const Source = createContext<{ doc: Document; inherited?: UxInherited } | undefined>(undefined);
/** Controls read authorship separately from normalized effective UX. No values are merged here. */
export function UxSource({
  text,
  ux,
  children,
}: {
  text?: string;
  ux?: UxIR;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ doc: parseDocument(text ?? "smithableUx: 0.1\n"), inherited: ux?.inherited }),
    [text, ux?.inherited],
  );
  return <Source value={value}>{children}</Source>;
}
export function useUxSource(path: string[], fallback: string) {
  const source = useContext(Source);
  const match = (fact: { path: string[] }) =>
    fact.path.length === path.length && fact.path.every((key, index) => key === path[index]);
  const skipped = source?.inherited?.skipped.find(match);
  const fact = source?.inherited?.used.find(match) ?? source?.inherited?.masked.find(match);
  const inherited = skipped
    ? `Inherited (${humanize(fallback)}; theme choice skipped)`
    : fact
      ? `Inherited (${humanize(fact.theme)}: ${humanize(String(fact.value))})`
      : `Inherited (${fallback === "theme" ? "theme's own" : humanize(fallback)})`;
  return {
    available: !!source,
    present: source?.doc.hasIn(path) ?? false,
    value: source?.doc.getIn(path),
    inherited,
    reason: skipped?.reason,
  };
}
