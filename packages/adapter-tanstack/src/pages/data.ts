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
  titleField,
} from "@smithable/core";
import { hasSignIn } from "../auth.js";
import { hasKeys } from "../keys.js";
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
  { ir, t, ux, auth }: GenContext,
): Record<string, string> {
  const within: Within = { base: page.route, models: page.pattern.models };
  const activity = hasSignIn(auth);
  const files: Record<string, string> = {
    "index.tsx": overviewRoute(page, within, { ir, t }, activity),
    ...(activity ? { "activity.tsx": activityRoute(page, { ir, t }, hasKeys(ir, auth)) } : {}),
  };
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
  activity: boolean,
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

/**
 * How many records of each model the viewer may read (null where they may read none), and,
 * when a hosting service runs the app, its page for restoring data to an earlier time.
 */
const getCounts = createServerFn().handler(async () => {
  const viewer = await currentViewer();
  return {
    counts: {
${models.map(({ key, n }) => `      ${JSON.stringify(key)}: ${n.data}.count(viewer),`).join("\n")}
    },
    restore: process.env.HOST_PAGE_URL ? \`\${process.env.HOST_PAGE_URL}/data\` : undefined,
  };
});

const MODELS = ${literal(models.map(({ key, n, to }) => ({ key, label: n.pluralLabel, to })))} as const;

export const Route = createFileRoute(${JSON.stringify(indexPath(page.route))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}  loader: () => getCounts(),
  component: ${component},
});

function ${component}() {
  const { counts, restore } = Route.useLoaderData();
  return (
    <>
      <PageHeader
        page=${attr(page.id)}
        title=${attr(t.pageTitle(page.id))}${t.pageSubtitle(page.id)}
        actions={
          <>
${
  activity
    ? `            <Link to=${attr(`${page.route}/activity`.replace("//", "/"))} className="text-sm font-medium text-primary">Activity</Link>
`
    : ""
}            {restore && <a href={restore} className="text-sm font-medium text-primary">Restore data…</a>}
          </>
        }
      />
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

/**
 * The audit log for administrators (docs/design/logging.md §3.3): who did what to which record
 * and when, newest first, filtered from the address; a record by its title now, a deleted one or
 * a removed user by their id, with Forget in the log on their lines.
 */
function activityRoute(
  page: PageIR,
  { ir, t }: Pick<GenContext, "ir" | "t">,
  keys: boolean,
): string {
  const route = `${page.route}/activity`.replace("//", "/");
  const models = ir.models.map((model) => ({
    model,
    n: names(model, t),
    title: titleField(model),
  }));
  return `${HEADER}import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db";
import { ${["auditLog", "user", ...(keys ? ["apiKey"] : []), ...models.map(({ n }) => n.table)].sort().join(", ")} } from "#/db/schema";
import { app } from "#/generated/app";
import { pageAccess } from "#/generated/pages";
import { AccessDenied, guardPage } from "#/kit/access";
import { ActivityLog } from "#/kit/ActivityLog";
import { PageHeader } from "#/kit/AppShell";
import { forgetInLog } from "#/kit/audit.server";
import { currentViewer } from "#/lib/viewer.server";

const filters = z.object({
  who: z.string().optional(),
  model: z.string().optional(),
  record: z.coerce.number().int().optional(),
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

/** Each model's label, for the filter and the lines. */
const LABELS: Record<string, string> = ${literal(Object.fromEntries(models.map(({ model, n }) => [model.name, n.label])))};

/** The newest lines that match, named for people (administrators only). */
const getActivity = createServerFn()
  .validator(filters)
  .handler(async ({ data }) => {
    const viewer = await currentViewer();
    if (viewer?.role !== "admin") throw new AccessDenied(viewer !== null);
    const day = 24 * 60 * 60 * 1000;
    const rows = db
      .select()
      .from(auditLog)
      .where(
        and(
          data.who ? eq(auditLog.who, data.who) : undefined,
          data.model ? eq(auditLog.model, data.model) : undefined,
          data.record ? eq(auditLog.recordId, data.record) : undefined,
          data.action ? eq(auditLog.action, data.action) : undefined,
          data.from ? gte(auditLog.at, new Date(data.from)) : undefined,
          data.to ? lt(auditLog.at, new Date(new Date(data.to).getTime() + day)) : undefined,
        ),
      )
      .orderBy(desc(auditLog.id))
      .limit(200)
      .all();
    const people = db.select({ id: user.id, name: user.name }).from(user).orderBy(user.name).all();
    const named = new Map(people.map((p) => [p.id, p.name]));
    // A record by its title now; a deleted one keeps the title its delete line has, or its id.
    const ids = (model: string) => [
      ...new Set(rows.filter((r) => r.model === model && r.recordId != null).map((r) => r.recordId as number)),
    ];
    const titles = new Map<string, Map<number, string>>([
${models
  .map(
    ({ model, n, title }) => `      [
        ${JSON.stringify(model.name)},
        new Map(
          db
            .select({ id: ${n.table}.id, title: ${n.table}.${title} })
            .from(${n.table})
            .where(inArray(${n.table}.id, ids(${JSON.stringify(model.name)})))
            .all()
            .map((r) => [r.id, String(r.title ?? r.id)]),
        ),
      ],`,
  )
  .join("\n")}
    ]);
${
  keys
    ? `    // A key's lines name the key ("key:3" is the key made as "Uptime monitor").
    for (const k of db.select({ id: apiKey.id, name: apiKey.name }).from(apiKey).all())
      named.set(\`key:\${k.id}\`, \`key "\${k.name}"\`);
`
    : ""
}    // A key's line once keys are gone from the app (the API turned off) still says it was a key.
    const removedUser = (id: string) =>
      named.get(id) ?? (id.startsWith("key:") ? \`a key (#\${id.slice(4)})\` : \`a removed user (#\${id})\`);
    const lines = rows.map((r) => {
      const label = r.model ? LABELS[r.model] : undefined;
      const now = r.model && r.recordId != null ? titles.get(r.model)?.get(r.recordId) : undefined;
      const gone = label && r.recordId != null && now === undefined;
      const removed = r.action === "user removed" ? String(r.details?.user ?? "") : "";
      return {
        id: r.id,
        at: r.at,
        who: r.who === "visitor" || r.who === "the app" ? r.who : (removedUser(r.who) ?? r.who),
        action: r.action,
        record: now
          ? \`\${label} "\${now}"\`
          : gone
            ? r.title
              ? \`\${label} "\${r.title}" (deleted)\`
              : \`a deleted \${label?.toLowerCase()} (#\${r.recordId})\`
            : undefined,
        fields: r.fields,
        // As text: what touches security, by name and value.
        details: r.details ? Object.fromEntries(Object.entries(r.details).map(([k, v]) => [k, String(v)])) : null,
        forget:
          gone && r.action === "deleted" && r.model
            ? { model: r.model, record: r.recordId as number }
            : removed && !named.has(removed)
              ? { user: removed }
              : undefined,
      };
    });
    const actions = db.selectDistinct({ action: auditLog.action }).from(auditLog).all().map((a) => a.action).sort();
    return { lines, people, actions };
  });

const forget = createServerFn({ method: "POST" })
  .validator(z.union([z.object({ model: z.string(), record: z.number().int() }), z.object({ user: z.string() })]))
  .handler(async ({ data }) => forgetInLog(await currentViewer(), data));

export const Route = createFileRoute(${JSON.stringify(route)})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}  validateSearch: filters,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getActivity({ data: deps }),
  component: ActivityPage,
});

function ActivityPage() {
  const { lines, people, actions } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  return (
    <>
      <PageHeader page=${attr(page.id)} title="Activity" subtitle="Who did what, and when. Kept 12 months; the client's details 90 days." />
      <ActivityLog
        lines={lines}
        filters={search}
        people={people}
        models={Object.entries(LABELS).map(([name, label]) => ({ name, label }))}
        actions={actions}
        app={app}
        onFilter={(next) => navigate({ to: ${JSON.stringify(route)}, search: next, replace: true })}
        onForget={async (target) => {
          await forget({ data: target });
          await router.invalidate();
        }}
      />
    </>
  );
}
`;
}
