// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import { emptyContent, emptyUx, type SpecIR } from "@smithable/core";
import { crudModel, type GenerateOptions, HEADER, texts } from "../shared.js";
import { listParts, listRoute } from "./list.js";

/**
 * A hand-edited list route turned into a custom page (ARCHITECTURE §6.5): the edited
 * component moves to src/custom/pages/, and the route is generated again. Only when the
 * edit left the route itself (loading, search, access) as generated; otherwise the reason.
 */
export function customPageFromEdit(
  ir: SpecIR,
  pageId: string,
  options: GenerateOptions,
  edited: string,
): { ok: true; source: string } | { ok: false; reason: string } {
  const t = texts(options.content ?? emptyContent());
  const page = ir.pages.find((p) => p.id === pageId);
  if (!page) throw new Error(`Unknown page ${pageId}`);
  const p = listParts(page, crudModel(ir, page), t, ir, options.ux ?? emptyUx());
  const routeBlock = /export const Route = createFileRoute\([\s\S]*?\n\}\);\n/;
  const generatedRoute = routeBlock.exec(
    listRoute(page, crudModel(ir, page), t, ir, false, options.ux ?? emptyUx()),
  )?.[0];
  const editedRoute = routeBlock.exec(edited)?.[0];
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
    .replace(new RegExp(`^function ${p.component}\\(`, "m"), `export function ${p.component}(`);
  // Drop what only the route needs (the component never does), and add getRouteApi.
  const view = p.view.names();
  const routeOnly = new Set([...p.route.names()].filter((n) => !view.has(n)));
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
  const p = listParts(page, crudModel(ir, page), t, ir, options.ux ?? emptyUx());
  p.view.add("@tanstack/react-router", "getRouteApi");
  return `// Your version of the "${page.id}" page. Smithable created it from the generated page and never
// changes it. The route (loading, search, access) stays generated: read its data with \`route\`.
// If the spec changes the data, TypeScript reports what no longer fits.
${p.view.render()}
const route = getRouteApi(${JSON.stringify(p.path)});

export ${p.body("route")}`;
}
