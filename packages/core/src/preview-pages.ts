import type { PageIR } from "./ir.js";
import { humanize } from "./naming.js";
import { patternInfo } from "./patterns.js";

export interface PreviewPage {
  id: string;
  page: string;
  label: string;
  kind: "page" | "new" | "record";
  /** Absent until a readable record has been discovered. */
  path?: string;
  discoverFrom?: string;
}
/** Inventory only: never assumes that an id exists or performs a data write. */
export function previewPages(
  pages: readonly PageIR[],
  titles: Record<string, string> = {},
): PreviewPage[] {
  return pages.flatMap((page) => {
    const title = titles[page.id] ?? humanize(page.id);
    const states: PreviewPage[] = [
      { id: `${page.id}:page`, page: page.id, label: title, kind: "page", path: page.route },
    ];
    if (page.pattern.kind === "crud")
      states.push(
        {
          id: `${page.id}:new`,
          page: page.id,
          label: `${title} · New`,
          kind: "new",
          path: `${page.route === "/" ? "" : page.route}/new`,
        },
        {
          id: `${page.id}:record`,
          page: page.id,
          label: `${title} · Record`,
          kind: "record",
          discoverFrom: page.route,
        },
      );
    if (page.pattern.kind === "articles")
      states.push({
        id: `${page.id}:record`,
        page: page.id,
        label: `${title} · Article`,
        kind: "record",
        discoverFrom: page.route,
      });
    for (const [index, path] of patternInfo(page).routes(page.route).entries())
      states.push({
        id: `${page.id}:sub:${index}`,
        page: page.id,
        label: `${title} · ${humanize(path.split("/").at(-1) ?? "")}`,
        kind: "page",
        path,
      });
    return states;
  });
}
/** Bounded candidates already rendered for the current authorized viewer. Used by the live
 * frame and static exporter; accepts opaque ids and never guesses or fetches another role. */
export function previewRecordPath(
  base: string,
  ids: string[],
  links: string[],
): string | undefined {
  if (!base.startsWith("/") || base.startsWith("//") || /[?#]/.test(base)) return;
  const prefix = base === "/" ? "/" : `${base.replace(/\/$/, "")}/`;
  for (const id of ids.slice(0, 200)) {
    if (
      id &&
      id.length <= 256 &&
      !["new", ".", ".."].includes(id) &&
      ![...id].some((character) => character.charCodeAt(0) < 32)
    )
      return `${prefix}${encodeURIComponent(id)}`;
  }
  for (const link of links.slice(0, 200)) {
    const tail = link.slice(prefix.length);
    if (
      link.startsWith(prefix) &&
      tail &&
      !/[/?#\\]/.test(tail) &&
      !["new", ".", ".."].includes(tail) &&
      !/%(?:2f|5c|2e)/i.test(tail)
    )
      return link;
  }
}
