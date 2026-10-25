// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import { emptyContent, emptyUx, type PageIR, type SpecIR } from "@smithable/core";
import {
  attr,
  crudModel,
  type GenerateOptions,
  guard,
  HEADER,
  importList,
  indexPath,
  type Texts,
  texts,
} from "../shared.js";
import { dashboardParts, dashboardRoute } from "./dashboard.js";
import { listParts, listRoute } from "./list.js";

/**
 * A hand-edited list route turned into a custom page (ARCHITECTURE §6.5): the edited
 * component moves to src/custom/pages/, and the route is generated again. Only when the
 * edit left the route itself (loading, search, access) as generated; otherwise the reason.
 */

/** The generated route block, `export const Route = createFileRoute(` up to its closing `});`. */
function routeBlock(text: string): string | undefined {
  const start = text.indexOf("export const Route = createFileRoute(");
  if (start === -1) return undefined;
  const end = text.indexOf("\n});\n", start);
  return end === -1 ? undefined : text.slice(start, end + "\n});\n".length);
}
export function customPageFromEdit(
  ir: SpecIR,
  pageId: string,
  options: GenerateOptions,
  edited: string,
): { ok: true; source: string } | { ok: false; reason: string } {
  const t = texts(options.content ?? emptyContent());
  const page = ir.pages.find((p) => p.id === pageId);
  if (!page) throw new Error(`Unknown page ${pageId}`);
  const p =
    page.pattern.kind === "dashboard"
      ? dashboardParts(page, page.pattern.items, ir, t, options.ux ?? emptyUx())
      : listParts(
          page,
          crudModel(ir, page),
          t,
          ir,
          options.ux ?? emptyUx(),
          undefined,
          options.auth,
        );
  const generatedRoute = routeBlock(
    page.pattern.kind === "dashboard"
      ? dashboardRoute(page, page.pattern.items, ir, t, options.ux ?? emptyUx(), false)
      : listRoute(
          page,
          crudModel(ir, page),
          t,
          ir,
          false,
          options.ux ?? emptyUx(),
          undefined,
          options.auth,
        ),
  );
  const editedRoute = routeBlock(edited);
  if (
    !editedRoute ||
    editedRoute !== generatedRoute ||
    (p.serverFn && !edited.includes(p.serverFn))
  ) {
    return {
      ok: false,
      reason:
        "The edit changes how the page loads its data or checks access, not only how it looks. Move data changes into the spec (e.g. search) or a custom action, then customize the page.",
    };
  }
  let code = edited
    .replace(HEADER, "")
    .replace(p.serverFn, "")
    .replace(editedRoute, `const route = getRouteApi(${JSON.stringify(p.path)});\n`)
    .replace(/\bRoute\.use/g, "route.use")
    // "Export CSV" calls the route's own server function, which a page of one's own cannot.
    .replace(/\n {8}exportRows=\{[^\n]*\}/, "")
    .replace(new RegExp(`^function ${p.component}\\(`, "m"), `export function ${p.component}(`);
  // Drop what only the route needs (the component never does), and add getRouteApi.
  const view = p.view.names();
  const routeOnly = new Set(["pageHead", ...[...p.route.names()].filter((n) => !view.has(n))]);
  code = code.replace(
    /^import \{([^}]*)\} from "([^"]+)";\n/gm,
    (_, list: string, module: string) => {
      const used = list
        .split(",")
        .map((n) => n.trim())
        .filter((n) => n && !routeOnly.has(n));
      if (module === "@tanstack/react-router") used.push("getRouteApi");
      return used.length ? `import { ${used.join(", ")} } from "${module}";\n` : "";
    },
  );
  return {
    ok: true,
    source: `// Your version of the "${page.id}" page, moved here from a hand edit of its generated route.
// Smithable never changes it. Read the route's data with \`route\`.
${code.replace(/\n{3,}/g, "\n\n")}`,
  };
}

/** The starting point of a custom page: exactly what was generated, now yours to change. */
export function customPageSource(ir: SpecIR, pageId: string, options: GenerateOptions): string {
  const t = texts(options.content ?? emptyContent());
  const page = ir.pages.find((p) => p.id === pageId);
  if (!page) throw new Error(`Unknown page ${pageId}`);

  if (page.pattern.kind === "dashboard") {
    const p = dashboardParts(page, page.pattern.items, ir, t, options.ux ?? emptyUx());
    p.view.add("@tanstack/react-router", "getRouteApi");
    return `// Your version of the "${page.id}" page. Smithable created it from the generated page and never
// changes it. The route (loading, search, access) stays generated: read its data with \`route\`.
// If the spec changes the data, TypeScript reports what no longer fits.
${p.view.render()}
const route = getRouteApi(${JSON.stringify(p.path)});

export ${p.body.replace("Route.useLoaderData()", "route.useLoaderData()")}`;
  }

  const p = listParts(
    page,
    crudModel(ir, page),
    t,
    ir,
    options.ux ?? emptyUx(),
    undefined,
    options.auth,
    true,
  );
  p.view.add("@tanstack/react-router", "getRouteApi");
  return `// Your version of the "${page.id}" page. Smithable created it from the generated page and never
// changes it. The route (loading, search, access) stays generated: read its data with \`route\`.
// If the spec changes the data, TypeScript reports what no longer fits.
${p.view.render()}
const route = getRouteApi(${JSON.stringify(p.path)});

export ${p.body("route")}`;
}

/**
 * A page of your own (`custom: Planner`, docs/design/calculator.md §4): the route is Smithable's
 * (access, menu, texts), the component in src/custom/pages/ the project's.
 */
export function customRoute(
  page: PageIR & { pattern: { kind: "custom"; component: string } },
  t: Texts,
): string {
  const c = page.pattern.component;
  const imports = importList()
    .add("@tanstack/react-router", "createFileRoute")
    .add("#/generated/pages", "pageAccess")
    .add("#/kit/access", "guardPage")
    .add(`#/custom/pages/${c}`, c);
  return `${HEADER}${imports.render()}
export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${t.head(page)}  component: () => (
    <${c} page=${attr(page.id)} ${t.pageHeader(page.id, 6)} />
  ),
});
`;
}

/** The props Smithable passes to a custom page or section, so a renamed text fails to type-check. */
export const CUSTOM_PROPS = `${HEADER}/** What a page of your own (src/custom/pages/) is given: its name and texts. */
export interface CustomPageProps {
  /** The page's name. */
  page: string;
  title: string;
  subtitle?: string;
}

/** What a landing section of your own (src/custom/sections/) is given: its name and texts. */
export interface CustomSectionProps {
  /** The section's name on its page, e.g. repayment. */
  name: string;
  /** Where its texts are among the app's texts, for editing them in the preview. */
  texts: string;
  title?: string;
  text?: string;
}
`;

/** A custom page's component as it starts: the page's title and a note where to write it. */
export const customPageStub = (
  component: string,
) => `// Your page. Smithable created this file once and never changes it; the route around it (access,
// menu, texts) is generated from smithable.yml. Read data with the functions in
// src/generated/<model>.server.ts inside a createServerFn: they apply the access rules.
import type { CustomPageProps } from "#/generated/custom";
import { PageHeader } from "#/kit/AppShell";

export function ${component}({ page, title, subtitle }: CustomPageProps) {
  return (
    <>
      <PageHeader page={page} title={title} subtitle={subtitle} />
      <p className="text-muted-foreground">This page is yours: write it in src/custom/pages/${component}.tsx.</p>
    </>
  );
}
`;

/** A custom landing section's component as it starts: its title and text in the kit's frame. */
export const customSectionStub = (
  component: string,
) => `// Your landing section. Smithable created this file once and never changes it; its place on the
// page and its texts come from smithable.yml and smithable.content.yml.
import type { CustomSectionProps } from "#/generated/custom";
import { Section } from "#/kit/Landing";

export function ${component}({ name, texts, title, text }: CustomSectionProps) {
  return (
    <Section id={name} texts={texts} title={title} text={text}>
      <p className="text-muted-foreground">This section is yours: write it in src/custom/sections/${component}.tsx.</p>
    </Section>
  );
}
`;
