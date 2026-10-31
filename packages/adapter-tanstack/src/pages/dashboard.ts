// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import {
  camel,
  type DashboardItem,
  DUE_WITHIN,
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
  adminPage,
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
  shownTitle,
  type Texts,
  titleField,
} from "../shared.js";

/**
 * A dashboard: its numbers are worked out in a server function from the records the viewer
 * may read, so they follow the same access rules as the lists.
 */
export function dashboardParts(
  page: PageIR,
  items: DashboardItem[],
  ir: SpecIR,
  t: Texts,
  ux: UxIR,
) {
  const component = `${pascal(page.id)}Page`;
  const fn = `get${pascal(page.id)}`;
  const route = importList()
    .add("@tanstack/react-router", "createFileRoute")
    .add("@tanstack/react-start", "createServerFn")
    .add("#/generated/pages", "pageAccess")
    .add("#/kit/access", "guardPage")
    .add("#/lib/viewer.server", "currentViewer");
  const view = importList()
    .add("#/generated/app", "app")
    .add("#/generated/pages", "pageUi")
    .add("#/kit/AppShell", "PageHeader");
  const rowsOf = (model: string) => camel(plural(model));
  // The latest changes need the activity, kept where people sign in (the team page has it).
  const team = adminPage(ir);
  items = items.filter((i) => i.kind !== "activity" || team);
  // A query reads its own records; the other tiles share one list per model.
  const models = [
    ...new Set(items.filter((i) => !i.query && i.kind !== "activity").map((i) => i.model)),
  ];
  for (const name of models) {
    const n = names(modelNamed(ir, name), t);
    route.add(`#/generated/${kebab(name)}.server`, n.data);
  }
  const values: string[] = [];
  const tiles = items.map((item) => {
    if (item.kind === "activity") {
      // The app's latest changes, described as the Activity page does, for administrators;
      // for anyone else there is no tile at all (look-gap §4).
      route
        .add("drizzle-orm", "desc")
        .add("#/db", "db")
        .add("#/db/schema", "auditLog")
        .add("#/generated/activity.server", "describeActivity");
      view.add("#/kit/Dashboard", "RecentChanges");
      values.push(
        `${item.name}: viewer?.role === "admin" ? describeActivity(db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(${item.limit ?? 8}).all()).lines.map(({ id, at, who, action, record }) => ({ id, at, who, action, record })) : null`,
      );
      const label = t.section(page.id, item.name).label ?? humanize(item.name);
      return {
        block: "panel",
        code: `{data.${item.name} && (
          <RecentChanges label=${attr(label)} lines={data.${item.name}} all=${attr(`${team?.route ?? ""}/activity`.replace("//", "/"))} />
        )}`,
      };
    }
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
    if (item.kind === "list" && item.when) {
      // What is due: the records whose date falls before the end of the span, the overdue
      // first and marked, linked to their pages; with nothing due, one line says so.
      route.add("#/kit/aggregate", "due");
      view.add("#/kit/Dashboard", "DueList");
      const title = titleField(model);
      if (shownTitle(model, "x").startsWith("titleOf")) route.add("#/kit/format", "titleOf");
      const target = ir.pages.find((p) => pageModel(p) === model.name);
      values.push(
        `${item.name}: due(${filtered}, (row) => row.${item.when}, ${literal(item.within ?? DUE_WITHIN)}, ${JSON.stringify(ir.app.timezone ?? "UTC")}).slice(0, ${item.limit ?? 5}).map(({ row, day, overdue }) => ({ id: row.id, title: ${shownTitle(model, `row.${title}`)}, day, overdue }))`,
      );
      return {
        block: "panel",
        code: `<DueList label=${attr(label)} rows={data.${item.name}}${target ? ` href=${attr(join(target.route, "${id}"))}` : ""} />`,
      };
    }
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
      view.add("#/kit/Dashboard", "BarChart");
      const amount =
        item.measure === "count" ? "() => 1" : `(row) => Number(row.${item.field}) || 0`;
      // By a choice (intents.md §5): a bar per value, on the model or one reference away.
      const choice = item.choice;
      if (choice) {
        route.add("#/kit/aggregate", "byValue");
        const target = modelNamed(ir, choice.model);
        const field = target.fields.find((f) => f.name === choice.field);
        const options = field?.type.kind === "choice" ? field.type.values : [];
        const tn = names(target, t);
        view.add(tn.module, tn.ui);
        if (choice.reference) {
          // The referred records as the viewer may read them; a tile grouped by a field they may
          // not read is not shown.
          route.add(`${tn.module}.server`, tn.data).add("#/kit/access", "AccessDenied");
          const map = `${item.name}Of`;
          values.push(
            `${item.name}: await ${tn.data}.list(viewer).then((referred) => { const ${map} = new Map(referred.map((r) => [r.id, r.${choice.field}])); return byValue(${filtered}, (row) => ${map}.get(row.${choice.reference}Id as number), ${amount}, ${literal(options)}); }, (error) => { if (error instanceof AccessDenied) return null; throw error; })`,
          );
        } else
          values.push(
            `${item.name}: byValue(${filtered}, (row) => row.${choice.field}, ${amount}, ${literal(options)})`,
          );
        return {
          block: "chart",
          code: `{data.${item.name} && (
          <BarChart
            label=${attr(label)}
            kind="${kind}"
            app={app}
            bars={data.${item.name}}
            labels={Object.fromEntries((${tn.ui}.fields.find((f) => f.name === ${JSON.stringify(choice.field)})?.choices ?? []).map((c) => [c.value, c.label]))}
          />
        )}`,
        };
      }
      // By a date: a bar per period, in the app's time zone.
      route.add("#/kit/aggregate", "byPeriod");
      const period = item.period ?? "month";
      values.push(
        `${item.name}: byPeriod(${filtered}, (row) => row.${item.by}, ${amount}, ${JSON.stringify(period)}, ${JSON.stringify(ir.app.timezone ?? "UTC")})`,
      );
      return {
        block: "chart",
        code: `<BarChart label=${attr(label)} kind="${kind}" app={app} bars={data.${item.name}} period="${period}" />`,
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
  const serverFn = `const ${fn} = createServerFn().handler(async () => {
  const viewer = await currentViewer();
${models.map((name) => `  const ${rowsOf(name)} = await ${names(modelNamed(ir, name), t).data}.list(viewer);`).join("\n")}
  return {
${values.map((v) => `    ${v},`).join("\n")}${models.length ? `\n    empty: ${models.map((name) => `${rowsOf(name)}.length === 0`).join(" && ")},` : ""}
  };
});`;

  const routeDef = `export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${t.head(page)}  loader: () => ${fn}(),
  component: ${component},
});`;

  // Over no records at all, a quiet page: a sentence and the way to the first list (look-gap §4).
  const first = ir.pages.find(
    (p) => p.pattern.kind === "crud" && ir.navigation.some((m) => m.pages.includes(p.id)),
  );
  if (models.length && first) view.add("#/kit/Dashboard", "QuietDashboard");
  const body = `function ${component}() {
  const data = Route.useLoaderData();${navigate ? "\n  const navigate = useNavigate();" : ""}
  return (
    <>
      <PageHeader page=${attr(page.id)} ${t.pageHeader(page.id)} />${
        models.length && first
          ? `
      {data.empty ? (
        <QuietDashboard href=${attr(first.route)} label={pageUi[${JSON.stringify(first.id)}]?.title ?? ${attr(humanize(first.id))}} />
      ) : (`
          : ""
      }
      <div data-kit="dashboard" className="space-y-6">
      ${blocks.join("\n      ")}
      </div>${models.length && first ? "\n      )}" : ""}
    </>
  );
}`;

  return { component, path: indexPath(page.route), route, view, serverFn, routeDef, body };
}

export function dashboardRoute(
  page: PageIR,
  items: DashboardItem[],
  ir: SpecIR,
  t: Texts,
  ux: UxIR,
  custom = false,
): string {
  const p = dashboardParts(page, items, ir, t, ux);
  if (custom) {
    p.route.add(`#/custom/pages/${page.id}`, p.component);
    return `${HEADER}// The page itself is src/custom/pages/${page.id}.tsx, which is yours.
${p.route.render()}
${p.serverFn}

${p.routeDef}
`;
  }

  return `${HEADER}${p.route.merge(p.view).render()}
${p.serverFn}

${p.routeDef}

${p.body}
`;
}
