// The navigation view's content (A 127, docs/design/app-map.md): the app's menus and pages, and
// for one role (or a visitor) whether each page may be opened and its records read. Read from the
// IR and core's explainAccess only, the same rules the app enforces.
import { type AuthIR, explainAccess, pageModel, type SpecIR } from "@smithable/core";

export type Verdict = "allowed" | "denied" | "conditional";

export interface NavPage {
  id: string;
  /** The menu that lists it; none for a page reached only by a link. */
  menu?: string;
  /** Whether the role may open it; without sign-in everyone may. */
  open: Verdict;
  /** The kind of record it shows, and whether the role may read those records. */
  model?: string;
  read?: Verdict;
}

export function navOf(
  ir: SpecIR,
  auth: AuthIR | undefined,
  as?: string,
): { menus: string[]; pages: NavPage[] } {
  const signIn = Boolean(auth && auth.signIn !== "none");
  const menuOf = new Map<string, string>();
  for (const menu of ir.navigation)
    for (const page of menu.pages) if (!menuOf.has(page)) menuOf.set(page, menu.name);
  const verdict = (ask: () => { verdict: Verdict }): Verdict =>
    signIn && auth ? ask().verdict : "allowed";
  return {
    menus: ir.navigation.map((m) => m.name),
    pages: ir.pages.map((page) => {
      const model = pageModel(page);
      return {
        id: page.id,
        ...(menuOf.has(page.id) ? { menu: menuOf.get(page.id) } : {}),
        open: verdict(() =>
          explainAccess(ir, auth as AuthIR, { as }, { kind: "page", page: page.id }, "open"),
        ),
        ...(model
          ? {
              model,
              read: verdict(() =>
                explainAccess(ir, auth as AuthIR, { as }, { kind: "model", model }, "read"),
              ),
            }
          : {}),
      };
    }),
  };
}
