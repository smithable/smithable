// A data page (`data: all` or a list of models): an administrator's view of the app's records.
// The overview lists each model with how many records the viewer may read; each model's list,
// new and record routes are the crud page's generators, drawn inside the data page (Within), so
// every read and write goes through the model's data functions and their access rules.
import {
  kebab,
  type PageIR,
  type PatternOf,
  pascal,
  plural,
  searchableFields,
} from "@smithable/core";
import {
  attr,
  dataRoute,
  type GenContext,
  guard,
  HEADER,
  indexPath,
  literal,
  modelNamed,
  names,
  type Within,
} from "../shared.js";
import { listRoute } from "./list.js";
import { detailRoute, newRoute } from "./record.js";

export function dataRoutes(
  page: PageIR & { pattern: PatternOf<"data"> },
  { ir, t, ux }: GenContext,
): Record<string, string> {
  const within: Within = { base: page.route, models: page.pattern.models };
  const files: Record<string, string> = { "index.tsx": overviewRoute(page, within, { ir, t }) };
  for (const name of page.pattern.models) {
    const model = modelNamed(ir, name);
    const search = searchableFields(model);
    // The model's crud routes, guarded by the data page's rule (its id) and at its route.
    const inside: PageIR = {
      id: page.id,
      route: dataRoute(within, name),
      pattern: { kind: "crud", model: name },
      ...(search.length ? { search } : {}),
    };
    const folder = kebab(plural(name));
    files[`${folder}/index.tsx`] = listRoute(inside, model, t, ir, false, ux, within);
    files[`${folder}/new.tsx`] = newRoute(inside, model, t, ir, ux);
    files[`${folder}/$id.tsx`] = detailRoute(inside, model, t, ir, ux, within);
  }
  return files;
}

/** The overview: each model, how many of its records the viewer may read, and a link. */
function overviewRoute(
  page: PageIR,
  within: Within,
  { ir, t }: Pick<GenContext, "ir" | "t">,
): string {
  const component = `${pascal(page.id)}Page`;
  const models = within.models.map((name) => {
    const n = names(modelNamed(ir, name), t);
    return { key: kebab(plural(name)), n, to: dataRoute(within, name) };
  });
  return `${HEADER}import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { pageAccess } from "#/generated/pages";
${models.map(({ n }) => `import { ${n.data} } from "${n.module}.server";`).join("\n")}
import { guardPage } from "#/kit/access";
import { PageHeader } from "#/kit/AppShell";
import { currentViewer } from "#/lib/viewer.server";

/** How many records of each model the viewer may read; null where they may read none. */
const getCounts = createServerFn().handler(async () => {
  const viewer = await currentViewer();
  return {
${models.map(({ key, n }) => `    ${JSON.stringify(key)}: ${n.data}.count(viewer),`).join("\n")}
  };
});

const MODELS = ${literal(models.map(({ key, n, to }) => ({ key, label: n.pluralLabel, to })))} as const;

export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}  loader: () => getCounts(),
  component: ${component},
});

function ${component}() {
  const counts = Route.useLoaderData();
  return (
    <>
      <PageHeader page=${attr(page.id)} title=${attr(t.pageTitle(page.id))}${t.pageSubtitle(page.id)} />
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {MODELS.filter((m) => counts[m.key] !== null).map((m) => (
          <li key={m.key}>
            <Link to={m.to} className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted">
              <span className="font-medium">{m.label}</span>
              <span className="text-muted-foreground tabular-nums">{counts[m.key]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
`;
}
