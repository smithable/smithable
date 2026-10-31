// The order page (docs/design/orders.md §3): the menu as visitors may read it, and an order
// placed in one write through the order model's create, which reads each chosen record and its
// price on the server and adds the lines. Opening hours are checked on the server too.
import { kebab, type ModelIR, type PageIR, type PatternOf, titleField } from "@smithable/core";
import { fieldUi } from "../data.js";
import type { GenContext } from "../shared.js";
import { guard, HEADER, importList, indexPath, literal, names, scalarField } from "../shared.js";

export function orderRoute(
  page: PageIR & { pattern: PatternOf<"order"> },
  ctx: GenContext,
): string {
  const { ir, t, ux } = ctx;
  const p = page.pattern;
  const from = ir.models.find((m) => m.name === p.from) as ModelIR;
  const into = ir.models.find((m) => m.name === p.into) as ModelIR;
  const nf = names(from, t);
  const ni = names(into, t);
  const title = titleField(from);
  const description = scalarField(from, "text", "markdown");
  const picture = scalarField(from, "picture");
  const section = from.fields.find((f) => !f.formula && f.type.kind === "choice");
  const sections = section
    ? (fieldUi(from, section, t, ir, ux).choices ?? []).map((c) => [c.value, c.label])
    : [];
  const imports = importList()
    .add("@tanstack/react-router", "createFileRoute")
    .add("@tanstack/react-start", "createServerFn")
    .add("@tanstack/react-start/server", "getRequestHeaders")
    .add("zod", "z")
    .add("#/generated/app", "app")
    .add("#/generated/pages", "pageAccess")
    .add(`#/generated/${kebab(from.name)}.server`, nf.data)
    .add(`#/generated/${kebab(into.name)}.server`, ni.data)
    .add(`#/generated/${kebab(into.name)}`, ni.ui, `type ${ni.values}`)
    .add(`#/generated/${kebab(into.name)}.schema`, ni.schema)
    .add("#/kit/page-guard", "guardPage")
    .add("#/kit/hours", "type Hours", "nextOpening", "openAt")
    .add("#/kit/limit", "writeAllowed")
    .add("#/kit/OrderPage", "type Menu", "OrderPage")
    .add("#/kit/refusal", "BadInput")
    .add("#/lib/viewer.server", "currentViewer");
  const row = (key: string) => `r.${key}`;
  return `${HEADER}${imports.render()}
/** When orders are taken, in the app's time zone; none means always. */
const HOURS: Hours | undefined = ${p.hours ? literal(p.hours) : "undefined"};
/** The fields the customer fills, in order. */
const ASK: string[] = ${literal(p.ask)};

/** What can be chosen, as visitors may read it, and whether orders are taken now. */
const readMenu = createServerFn().handler(async (): Promise<Menu> => {
  const viewer = await currentViewer();
  const rows = await ${nf.data}.list(viewer);
  const now = new Date();
  return {
    choices: rows.map((r) => ({
      id: r.id,
      name: String(${title && title !== "id" ? row(title) : "r.id"} ?? ""),
      price: Number(${row(p.price)} ?? 0),${section ? `\n      section: ${row(section.name)} ?? null,` : ""}${description ? `\n      description: ${row(description.name)} ?? null,` : ""}${
        picture
          ? `\n      picture: ${row(picture.name)} ? { src: \`/files/${kebab(from.name)}/\${r.id}/${picture.name}\`, alt: ${row(picture.name)}.alt } : null,`
          : ""
      }
      available: ${p.available ? `${row(p.available)} !== false` : "true"},
    })),
    open: HOURS ? openAt(HOURS, now, app.timeZone) : true,
    opens: HOURS && !openAt(HOURS, now, app.timeZone) ? (nextOpening(HOURS, now, app.timeZone)?.toISOString() ?? null) : null,
  };
});

/** What the customer sends: their details and the chosen ids and quantities, never a price. */
const sent = ${ni.schema}.pick(${literal(Object.fromEntries(p.ask.map((a) => [a, true])))});
const placeOrder = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z
      .object({
        values: sent,
        lines: z.array(z.object({ id: z.number().int(), quantity: z.number().int().min(1).max(99) })).min(1).max(50),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const viewer = await currentViewer();
    writeAllowed(viewer, getRequestHeaders());
    if (HOURS && !openAt(HOURS, new Date(), app.timeZone)) throw new BadInput("closed");
    const made = await ${ni.data}.create(viewer, data.values as ${ni.values}, data.lines);
    return { number: made.${p.number}, id: made.id };
  });

export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${t.head(page)}  loader: () => readMenu(),
  component: OrderRoute,
});

function OrderRoute() {
  const menu = Route.useLoaderData();
  return (
    <OrderPage
      title={${t.pageTitleOf(page.id)}}
      menu={menu}
      sections={${literal(sections)}}
      app={app}
      ui={{ ...${ni.ui}, fields: ${ni.ui}.fields.filter((f) => ASK.includes(f.name)) }}
      schema={sent}
      place={(values, lines) => placeOrder({ data: { values, lines } })}
    />
  );
}
`;
}
