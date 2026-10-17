// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import {
  camel,
  type DashboardItem,
  humanize,
  kebab,
  type PageIR,
  pageModel,
  pascal,
  plural,
  type SpecIR,
  type UxIR,
} from "@smithable/core";
import {
  attr,
  guard,
  HEADER,
  importList,
  indexPath,
  join,
  keyOf,
  literal,
  modelNamed,
  names,
  type Texts,
} from "../shared.js";

/**
 * A dashboard: its numbers are worked out in a server function from the records the viewer
 * may read, so they follow the same access rules as the lists.
 */
export function dashboardRoute(
  page: PageIR,
  items: DashboardItem[],
  ir: SpecIR,
  t: Texts,
  ux: UxIR,
): string {
  const component = `${pascal(page.id)}Page`;
  const fn = `get${pascal(page.id)}`;
  const route = importList()
    .add("@tanstack/react-router", "createFileRoute")
    .add("@tanstack/react-start", "createServerFn")
    .add("#/generated/pages", "pageAccess")
    .add("#/kit/access", "guardPage")
    .add("#/lib/viewer.server", "currentViewer");
  const view = importList().add("#/generated/app", "app").add("#/kit/AppShell", "PageHeader");
  const rowsOf = (model: string) => camel(plural(model));
  // A query reads its own records; the other tiles share one list per model.
  const models = [...new Set(items.filter((i) => !i.query).map((i) => i.model))];
  for (const name of models) {
    const n = names(modelNamed(ir, name), t);
    route.add(`#/generated/${kebab(name)}.server`, n.data);
  }
  const values: string[] = [];
  const tiles = items.map((item) => {
    const model = modelNamed(ir, item.model);
    const field = model.fields.find((f) => f.name === item.field);
    const rows = rowsOf(item.model);
    const conditions = Object.entries(item.where ?? {}).map(([key, value]) =>
      Array.isArray(value)
        ? `${JSON.stringify(value)}.includes(row.${key})`
        : `row.${key} === ${JSON.stringify(value)}`,
    );
    const filtered = conditions.length
      ? `${rows}.filter((row) => ${conditions.join(" && ")})`
      : rows;
    const value = `(row) => row.${item.field}`;
    const kind =
      item.measure === "count" || !field || field.type.kind !== "scalar"
        ? "int"
        : item.measure === "average" && field.type.name === "int"
          ? "decimal"
          : field.type.name;
    const label = t.section(page.id, item.name).label ?? humanize(item.name);
    if (item.kind === "list") {
      if (item.query) route.add(`#/custom/queries/${kebab(item.query)}`, item.query);
      else route.add("#/kit/aggregate", "latest");
      const n = names(model, t);
      view
        .add("@tanstack/react-router", "useNavigate")
        .add(n.module, n.ui)
        .add("#/kit/ModelTable", "ModelTable");
      values.push(
        item.query
          ? `${item.name}: (await ${item.query}(viewer)).slice(0, ${item.limit ?? 5})`
          : `${item.name}: latest(${filtered}, ${item.limit ?? 5})`,
      );
      const target = ir.pages.find((p) => pageModel(p) === model.name);
      // The same columns as the model's own list page.
      const columns = target && ux.pages[target.id]?.columns?.map((name) => keyOf(model, name));
      return {
        block: "list",
        code: `<section aria-labelledby=${attr(`${item.name}-title`)} className="space-y-3">
        <h2 id=${attr(`${item.name}-title`)} className="font-semibold">${label}</h2>
        <ModelTable
          ui={${n.ui}}
          app={app}${columns ? `\n          columns={${literal(columns)}}` : ""}
          rows={data.${item.name}}${
            target
              ? `
          onOpen={(row) => navigate({ to: ${JSON.stringify(join(target.route, "$id"))}, params: { id: String(row.id) } })}`
              : ""
          }
        />
      </section>`,
      };
    }
    if (item.kind === "chart") {
      route.add("#/kit/aggregate", "byMonth");
      view.add("#/kit/Dashboard", "BarChart");
      const amount =
        item.measure === "count" ? "() => 1" : `(row) => Number(row.${item.field}) || 0`;
      values.push(`${item.name}: byMonth(${filtered}, (row) => row.${item.by}, ${amount})`);
      return {
        block: "chart",
        code: `<BarChart label=${attr(label)} kind="${kind}" app={app} bars={data.${item.name}} />`,
      };
    }
    view.add("#/kit/Dashboard", "StatCard", "formatNumber");
    if (item.measure === "count") values.push(`${item.name}: ${filtered}.length`);
    else {
      route.add("#/kit/aggregate", item.measure === "sum" ? "sum" : "average");
      values.push(
        `${item.name}: ${item.measure === "sum" ? "sum" : "average"}(${filtered}, ${value})`,
      );
    }
    return {
      block: "stat",
      code: `<StatCard label=${attr(label)} value={formatNumber("${kind}", data.${item.name}, app)} />`,
    };
  });
  // Numbers side by side (a run of them shares a grid); charts and lists take the full width.
  const groups: { stat: boolean; codes: string[] }[] = [];
  for (const tile of tiles) {
    const last = groups.at(-1);
    if (tile.block === "stat" && last?.stat) last.codes.push(tile.code);
    else groups.push({ stat: tile.block === "stat", codes: [tile.code] });
  }
  const blocks = groups.map((g) =>
    g.stat
      ? `<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">\n        ${g.codes.join("\n        ")}\n      </div>`
      : (g.codes[0] as string),
  );
  const navigate = tiles.some((tile) => tile.block === "list");
  return `${HEADER}${route.merge(view).render()}
const ${fn} = createServerFn().handler(async () => {
  const viewer = await currentViewer();
${models.map((name) => `  const ${rowsOf(name)} = await ${names(modelNamed(ir, name), t).data}.list(viewer);`).join("\n")}
  return {
${values.map((v) => `    ${v},`).join("\n")}
  };
});

export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${t.head(page)}  loader: () => ${fn}(),
  component: ${component},
});

function ${component}() {
  const data = Route.useLoaderData();${navigate ? "\n  const navigate = useNavigate();" : ""}
  return (
    <>
      <PageHeader page=${attr(page.id)} ${t.pageHeader(page.id)} />
      <div data-kit="dashboard" className="space-y-6">
      ${blocks.join("\n      ")}
      </div>
    </>
  );
}
`;
}
