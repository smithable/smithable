// A calendar page (`calendar: Session`): a model's records by week or month, in the app's time
// zone. The route loads only the records whose start falls in the range shown, through the
// model's data function, so visitors, members and staff each see what the model's access gives
// them; the kit's Calendar lays them out.
import {
  type FieldIR,
  type ModelIR,
  type PageIR,
  type PatternOf,
  pageModel,
  pascal,
  USER_MODEL,
} from "@smithable/core";
import { reserveElement } from "../data.js";
import {
  attr,
  dataKey,
  dataRoute,
  type GenContext,
  guard,
  HEADER,
  importList,
  indexPath,
  join,
  modelNamed,
  names,
  relatedTitle,
  titleField,
} from "../shared.js";

type CalendarPage = PageIR & { pattern: PatternOf<"calendar"> };

/** Where a model's records open and are made: its crud page, else a data page showing it. */
export function recordPages(model: string, ir: GenContext["ir"]): string | undefined {
  const crud = ir.pages.find((p) => pageModel(p) === model);
  if (crud) return crud.route;
  const data = ir.pages.find((p) => p.pattern.kind === "data" && p.pattern.models.includes(model));
  return data && dataRoute({ base: data.route, models: [] }, model);
}

/** The page that guards where records open (to check the viewer may open it). */
function recordPageId(model: string, ir: GenContext["ir"]): string | undefined {
  return (
    ir.pages.find((p) => pageModel(p) === model) ??
    ir.pages.find((p) => p.pattern.kind === "data" && p.pattern.models.includes(model))
  )?.id;
}

export function calendarRoute(page: CalendarPage, ctx: GenContext): string {
  const { ir, t } = ctx;
  const { pattern } = page;
  const model = modelNamed(ir, pattern.model);
  const n = names(model, t);
  const field = (name: string) => model.fields.find((f) => f.name === name) as FieldIR;
  const starts = field(pattern.starts);
  const dateOnly = starts.type.kind === "scalar" && starts.type.name === "date";
  const component = `${pascal(page.id)}Page`;
  const imports = importList()
    .add("@tanstack/react-router", "createFileRoute", "useNavigate")
    .add("@tanstack/react-start", "createServerFn")
    .add("drizzle-orm", "and", "gte", "lt")
    .add("zod", "z")
    .add("#/kit/params", "count", "optional", "type Search", "shaped")
    .add("#/db/schema", "* as schema")
    .add("#/generated/app", "app")
    .add("#/generated/pages", "pageAccess")
    .add(`${n.module}.server`, n.access, n.data)
    .add("#/kit/access", "allows", "guardPage")
    .add("#/kit/AppShell", "PageHeader")
    .add("#/kit/Calendar", "Calendar", "calendarRange")
    .add("#/kit/words", "w");
  imports.add("#/lib/viewer.server", "currentViewer");
  // Places on a record (a session's bookings): its panel lets people book one.
  const reserve = reserveElement(model, ctx, (m, ...ns) => imports.add(m, ...ns), "id");

  // How long a record lasts: its end, a duration here or one reference away, else an hour (or the day).
  let lengths = "";
  let end: string;
  if (pattern.ends)
    end = `row.${pattern.ends} ?? new Date(row.${starts.name}.getTime() + 3_600_000)`;
  else if (pattern.duration?.includes(".")) {
    const [ref, minutes] = pattern.duration.split(".") as [string, string];
    const target = modelNamed(ir, (field(ref).type as { model: string }).model);
    const tn = names(target, t);
    imports.add(`${tn.module}.server`, tn.data);
    lengths = `\n    // How long each ${target.name} lasts, among those the viewer may read.\n    const minutes = new Map((await ${tn.data}.list(viewer)).map((r) => [r.id, r.${minutes}]));`;
    end = `new Date(row.${starts.name}.getTime() + (minutes.get(row.${ref}Id) ?? 60) * 60_000)`;
  } else if (pattern.duration)
    end = `new Date(row.${starts.name}.getTime() + (row.${pattern.duration} ?? 60) * 60_000)`;
  else end = `new Date(row.${starts.name}.getTime() + 3_600_000)`;

  // What a block says: the given field or reference, the model's title field, or its first
  // required reference's title.
  const titleOf = (f: FieldIR | undefined): string | undefined => {
    if (!f) return undefined;
    if (f.type.kind !== "relation") return `String(row.${f.name} ?? "")`;
    const title = relatedTitle(ir, f.type.model);
    return f.type.model === USER_MODEL || title !== "id"
      ? `String(row.${f.name}?.${title} ?? "")`
      : `\`#\${row.${f.name}Id}\``;
  };
  const own = titleField(model);
  const title =
    titleOf(pattern.title ? field(pattern.title) : undefined) ??
    (own !== "id" ? titleOf(field(own)) : undefined) ??
    titleOf(model.fields.find((f) => f.required && f.type.kind === "relation" && !f.type.many)) ??
    `\`${n.label} #\${row.id}\``;

  // Records that take someone's time (appointments.md §1): a day view with a column for each of them.
  const occupied = model.occupies;
  const laneRef = occupied && field(occupied.resource);
  const laneModel =
    laneRef?.type.kind === "relation" ? modelNamed(ir, laneRef.type.model) : undefined;
  let lanes = "";
  if (laneModel) {
    const ln = names(laneModel, t);
    const laneTitle = titleField(laneModel);
    imports.add(`${ln.module}.server`, ln.data);
    lanes = `
      // Whose time the records take, among those the viewer may read, in their order (as "anyone"
      // takes them): the day view's columns.
      lanes: (await ${ln.data}.list(viewer)).map((r) => ({ id: r.id, title: ${laneTitle === "id" ? `\`#\${r.id}\`` : `String(r.${laneTitle} ?? "")`} })).sort((a, b) => a.id - b.id),`;
  }

  const opens = recordPages(model.name, ir);
  const opensId = recordPageId(model.name, ir);
  const range = dateOnly
    ? `and(gte(${n.table}.${starts.name}, data.from.slice(0, 10)), lt(${n.table}.${starts.name}, data.to.slice(0, 10)))`
    : `and(gte(${n.table}.${starts.name}, new Date(data.from)), lt(${n.table}.${starts.name}, new Date(data.to)))`;
  const start = dateOnly ? `new Date(\`\${row.${starts.name}}T00:00:00Z\`)` : `row.${starts.name}`;
  const itemEnd = dateOnly ? `new Date(\`\${row.${starts.name}}T23:59:00Z\`)` : end;

  return `${HEADER}${imports.render()}
/** The ${n.pluralLabel.toLowerCase()} whose start falls in the range shown, among those the viewer may read. */
const getRange = createServerFn()
  // A real range, and no longer than a month view needs (six weeks and a day on each side).
  .validator(
    z
      .object({ from: z.iso.datetime(), to: z.iso.datetime() })
      .refine((r) => Date.parse(r.from) < Date.parse(r.to) && Date.parse(r.to) - Date.parse(r.from) <= 44 * 86_400_000, "The range is not a week or a month."),
  )
  .handler(async ({ data }) => {
    const viewer = await currentViewer();
    const rows = await ${n.data}.list(viewer, ${range});${lengths}
    return {
      items: rows.map((row) => ({
        id: row.id,
        start: ${start},
        end: ${itemEnd},
        title: ${title},${
          laneRef
            ? `
        lane: row.${dataKey(laneRef)},`
            : ""
        }
      })),${lanes}
      // Records are made on their page: the viewer must be able to open it, too.
      canCreate: ${opens && opensId ? `allows(${n.access}.create, viewer) && allows(pageAccess[${JSON.stringify(opensId)}], viewer)` : "false"},
      canOpen: ${opensId ? `allows(pageAccess[${JSON.stringify(opensId)}], viewer)` : "false"},
    };
  });

export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}${ctx.t.head(page)}  validateSearch: (s: Search) => optional({${
    laneModel
      ? `
    day: shaped(s.day, /^\\d{4}-\\d{2}-\\d{2}$/),`
      : ""
  }
    week: shaped(s.week, /^\\d{4}-W\\d{2}$/),
    month: shaped(s.month, /^\\d{4}-\\d{2}$/),
    // The record whose panel is open, so a sign-in or a link returns to it.
    open: count(s.open),
  }),
  // The period shown decides what is loaded; opening a record's panel loads nothing again.
  loaderDeps: ({ search: { open: _open, ...period } }) => period,
  loader: ({ deps }) => {
    const range = calendarRange(deps, app.timeZone);
    return getRange({ data: { from: range.from.toISOString(), to: range.to.toISOString() } });
  },
  component: ${component},
});

function ${component}() {
  const { items, canCreate, canOpen${laneModel ? ", lanes" : ""} } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader page=${attr(page.id)} ${t.pageHeader(page.id)} />
      <Calendar
        search={search}
        items={items}
        timeZone={app.timeZone}
        dateOnly={${dateOnly}}${laneModel ? "\n        lanes={lanes}" : ""}
        newLabel={w.newOne(${JSON.stringify(n.label.toLowerCase())})}${
          reserve
            ? `
        details={(id) => ${reserve}}`
            : ""
        }
        onNavigate={(next, replace) => navigate({ to: ${JSON.stringify(page.route)}, search: next, replace })}${
          opens
            ? `
        onOpen={canOpen ? (id) => navigate({ to: ${JSON.stringify(join(opens, "$id"))}, params: { id: String(id) } }) : undefined}
        onCreate={
          canCreate
            ? (start) => navigate({ to: ${JSON.stringify(join(opens, "new"))}, search: { ${starts.name}: ${dateOnly ? "start.slice(0, 10)" : "start"} } })
            : undefined
        }`
            : ""
        }
      />
    </>
  );
}
`;
}

/** The field a calendar places records by, for a model on a calendar page (its new form takes it). */
export function calendarStart(model: ModelIR, ir: GenContext["ir"]): FieldIR | undefined {
  const page = ir.pages.find(
    (p) => p.pattern.kind === "calendar" && p.pattern.model === model.name,
  );
  const name = page?.pattern.kind === "calendar" ? page.pattern.starts : undefined;
  return name === undefined ? undefined : model.fields.find((f) => f.name === name);
}
