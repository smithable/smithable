// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import {
  type FieldIR,
  humanize,
  kebab,
  type ModelIR,
  type PageIR,
  pascal,
  plural,
  type SpecIR,
  USER_MODEL,
  type UxIR,
} from "@smithable/core";
import { actionNames } from "../actions.js";
import {
  attr,
  dataKey,
  guard,
  HEADER,
  importList,
  indexPath,
  join,
  literal,
  modelNamed,
  names,
  relatedTitle,
  type Texts,
  tableNames,
} from "../shared.js";

/** A searchable list's server function and route options: the search text is in the URL. */
export function searchCode(page: PageIR, model: ModelIR, t: Texts, ir: SpecIR) {
  const n = names(model, t);
  const fields = (page.search ?? []).map(
    (name) => model.fields.find((f) => f.name === name) as FieldIR,
  );
  const fn = `search${pascal(plural(model.name))}`;
  const labels = fields.map((f) => (t.field(model, f).label ?? humanize(f.name)).toLowerCase());
  // A reference is searched by the related record's name, e.g. an order by its customer.
  const own = fields.filter((f) => f.type.kind !== "relation");
  const terms = [
    ...(own.length
      ? [`contains([${own.map((f) => `${n.table}.${f.name}`).join(", ")}], data.q)`]
      : []),
    ...fields.flatMap((f) => {
      if (f.type.kind !== "relation") return [];
      const title = relatedTitle(ir, f.type.model);
      // Among the related records the viewer may read (a user's name is shown anyway).
      if (f.type.model !== USER_MODEL && title !== "id")
        return [
          `inArray(${n.table}.${dataKey(f)}, ${names(modelNamed(ir, f.type.model), t).data}.titled(viewer, data.q))`,
        ];
      const target =
        f.type.model === USER_MODEL ? "user" : tableNames(modelNamed(ir, f.type.model)).table;
      return [`relatedContains(${n.table}.${dataKey(f)}, ${target}, [${target}.${title}], data.q)`];
    }),
  ];
  const byTitle = (f: FieldIR) =>
    f.type.kind === "relation" &&
    f.type.model !== USER_MODEL &&
    relatedTitle(ir, f.type.model) !== "id";
  // Related records found through their data module (titled), and the rest by their table.
  const titled = fields.filter(byTitle).map((f) => {
    const target = modelNamed(ir, (f.type as { model: string }).model);
    return { module: `#/generated/${kebab(target.name)}.server`, data: names(target, t).data };
  });
  const related = fields
    .filter((f) => f.type.kind === "relation" && !byTitle(f))
    .map((f) =>
      f.type.kind === "relation" && f.type.model === USER_MODEL
        ? "user"
        : tableNames(modelNamed(ir, (f.type as { model: string }).model)).table,
    );
  const placeholder = `Search by ${labels.length > 1 ? `${labels.slice(0, -1).join(", ")} or ${labels.at(-1)}` : labels[0]}`;
  return {
    fn: `
/** The ${n.pluralLabel.toLowerCase()} matching the search, among those the viewer may read. */
const ${fn} = createServerFn()
  .validator(z.object({ q: z.string().max(200).optional() }))
  .handler(async ({ data }) => {
    const viewer = await currentViewer();
    const where = data.q ? ${terms.length > 1 ? `or(${terms.join(", ")})` : terms[0]} : undefined;
    return { rows: await ${n.data}.list(viewer, where), canCreate: allows(${n.access}.create, viewer) };
  });
`,
    options: `  validateSearch: z.object({ q: z.string().optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ deps }) => ${fn}({ data: { q: deps.q } }),
`,
    placeholder,
    imports: {
      related: [...new Set(related)],
      titled,
      own: own.length > 0,
      relation: related.length > 0,
      or: terms.length > 1,
    },
  };
}

/**
 * A list page in two parts: the route (loading, search, access) and the component. Generated,
 * both go in one route file; customized (ARCHITECTURE §6.4), the component moves to
 * src/custom/pages/ and reads the route's data with getRouteApi.
 */
export function listParts(page: PageIR, model: ModelIR, t: Texts, ir: SpecIR, ux: UxIR) {
  const n = names(model, t);
  const component = `${pascal(page.id)}Page`;
  const path = indexPath(page.route);
  const actions = (page.actions ?? []).flatMap((name) => ir.actions.filter((a) => a.name === name));
  const search = page.search?.length ? searchCode(page, model, t, ir) : undefined;
  const columns = ux.pages[page.id]?.columns?.map((name) =>
    dataKey(model.fields.find((f) => f.name === name) as FieldIR),
  );
  const key = (name: string) => dataKey(model.fields.find((f) => f.name === name) as FieldIR);
  const below = Object.entries(ux.pages[page.id]?.below ?? {}).map(([c, f]) => [key(c), key(f)]);

  const route = importList()
    .add("@tanstack/react-router", "createFileRoute")
    .add("#/generated/pages", "pageAccess")
    .add("#/kit/access", "guardPage");
  if (search) {
    route
      .add("@tanstack/react-start", "createServerFn")
      .add("zod", "z")
      .add("#/db/schema", n.table, ...search.imports.related)
      .add(`#/generated/${kebab(model.name)}.server`, n.access, n.data)
      .add("#/kit/access", "allows");
    if (search.imports.or) route.add("drizzle-orm", "or");
    if (search.imports.own) route.add("#/kit/search", "contains");
    if (search.imports.relation) route.add("#/kit/search", "relatedContains");
    if (search.imports.titled.length) route.add("drizzle-orm", "inArray");
    for (const t of search.imports.titled) route.add(t.module, t.data);
    route.add("#/lib/viewer.server", "currentViewer");
  } else {
    route.add(n.module, n.list);
  }
  const view = importList()
    .add("@tanstack/react-router", "Link", "useNavigate")
    .add("#/components/ui/button", "buttonVariants");
  for (const a of actions) view.add(actionNames(a).module, actionNames(a).access);
  view.add("#/generated/app", "app").add(n.module, n.ui);
  if (actions.length) view.add("#/kit/access", "allows");
  view.add("#/kit/AppShell", "PageHeader").add("#/kit/ModelTable", "ModelTable");
  if (search) view.add("#/kit/SearchBox", "SearchBox");

  const options = `${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${search ? search.options : `  loader: () => ${n.list}(),\n`}`;
  /** The component, reading the route's data through \`api\` (Route, or getRouteApi's result). */
  const body = (api: string) => `function ${component}() {
  const { rows, canCreate } = ${api}.useLoaderData();${search ? `\n  const { q } = ${api}.useSearch();` : ""}
${actions.length ? `  const { viewer } = ${api}.useRouteContext();\n` : ""}  const navigate = useNavigate();
  const newButton = canCreate && (
    <Link to=${attr(join(page.route, "new"))} className={buttonVariants()}>
      New ${n.label.toLowerCase()}
    </Link>
  );${actions
    .map(
      (a) => `
  const ${a.name}Button = allows(${actionNames(a).access}, viewer) && (
    <Link to=${attr(join(page.route, `actions/${kebab(a.name)}`))} className={buttonVariants({ variant: "outline" })}>
      ${humanize(a.name)}
    </Link>
  );`,
    )
    .join("")}
  return (
    <>
      <PageHeader
        page=${attr(page.id)}
        title=${attr(t.pageTitle(page.id))}${t.pageSubtitle(page.id)}
        actions={${actions.length ? `<>${actions.map((a) => `{${a.name}Button}`).join("")}{newButton}</>` : "newButton"}}
      />
${
  search
    ? `      <SearchBox
        value={q ?? ""}
        placeholder=${attr(search.placeholder)}
        onSearch={(text) => navigate({ to: ${JSON.stringify(page.route)}, search: { q: text || undefined }, replace: true })}
      />
`
    : ""
}      <ModelTable
        ui={${n.ui}}
        page=${attr(page.id)}${columns ? `\n        columns={${literal(columns)}}` : ""}${below.length ? `\n        below={${literal(Object.fromEntries(below))}}` : ""}
        app={app}
        rows={rows}${search ? `\n        emptyMessage={q ? \`No ${n.pluralLabel.toLowerCase()} match “\${q}”.\` : undefined}` : ""}
        emptyAction={newButton || undefined}
        onOpen={(row) => navigate({ to: ${JSON.stringify(join(page.route, "$id"))}, params: { id: String(row.id) } })}
      />
    </>
  );
}
`;
  return { component, path, route, view, serverFn: search?.fn ?? "", options, body };
}

/** The route file of a list page; with a custom page, it renders that instead. */
export function listRoute(
  page: PageIR,
  model: ModelIR,
  t: Texts,
  ir: SpecIR,
  custom: boolean,
  ux: UxIR,
): string {
  const p = listParts(page, model, t, ir, ux);
  const head = `export const Route = createFileRoute(${JSON.stringify(p.path)})({
${p.options}  component: ${p.component},
});
`;
  if (custom) {
    p.route.add(`#/custom/pages/${page.id}`, p.component);
    return `${HEADER}// The page itself is src/custom/pages/${page.id}.tsx, which is yours.
${p.route.render()}${p.serverFn}
${head}`;
  }
  return `${HEADER}${p.route.merge(p.view).render()}${p.serverFn}
${head}
${p.body("Route")}`;
}
