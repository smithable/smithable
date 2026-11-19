// A crud page's record as a document (docs/design/record-documents.md §4.2): the route
// /<page>/<id>/document. Its server function reads every part as the person: the record, the
// one it is for, each line and the settings record, each by its own read rule. A part they may
// not read refuses the document instead of being left out, a worked-out value missing refuses it
// too, and only the named fields leave the server.
import {
  type AuthIR,
  type FieldIR,
  humanize,
  kebab,
  type ModelIR,
  type PageIR,
  type SpecIR,
} from "@smithable/core";
import { hasSignIn } from "../auth.js";
import {
  addressOwned,
  attr,
  creatorOwned,
  guard,
  HEADER,
  join,
  keyOf,
  literal,
  modelNamed,
  names,
  ownerKey,
  SCHEMA_IMPORT,
  type Texts,
} from "../shared.js";

/** The route file's name beside the record's own ($id.tsx): not nested in it. */
export const DOCUMENT_FILE = "$id_.document.tsx";

const fieldOf = (model: ModelIR, name: string) =>
  model.fields.find((f) => f.name === name) as FieldIR;

/** The keys a part's named fields are read by: a reference's id and the record it names. */
const keysOf = (model: ModelIR, show: string[]) =>
  show.flatMap((name) =>
    fieldOf(model, name).type.kind === "relation" ? [`${name}Id`, name] : [name],
  );

/** The named fields worked out by a formula, with their labels: each needs a value. */
const workedOut = (model: ModelIR, show: string[], t: Texts) =>
  show.flatMap((name) => {
    const f = fieldOf(model, name);
    return f.formula ? [[name, t.field(model, f).label ?? humanize(name)]] : [];
  });

/** The settings page's model, which `from` names fields of. */
export function settingsModel(ir: SpecIR): ModelIR | undefined {
  const page = ir.pages.find((p) => p.pattern.kind === "settings");
  return page?.pattern.kind === "settings" ? modelNamed(ir, page.pattern.model) : undefined;
}

/** The models documents read (the record, whom it is for, its lines, the settings): their data reads at once on a connection too. */
export function documentReads(ir: SpecIR): Set<string> {
  const reads = new Set<string>();
  const target = (model: ModelIR, name: string) => {
    const f = fieldOf(model, name);
    if (f.type.kind === "relation") reads.add(f.type.model);
  };
  for (const page of ir.pages) {
    const doc = page.document;
    if (page.pattern.kind !== "crud" || !doc) continue;
    const model = modelNamed(ir, page.pattern.model);
    reads.add(model.name);
    if (doc.to) target(model, doc.to.ref);
    if (doc.lines) target(model, doc.lines.list);
    const settings = doc.from && settingsModel(ir);
    if (settings) reads.add(settings.name);
  }
  return reads;
}

/** The document's route file, or none for a page without a document. */
/** A document's parts as code: the reader's lines and the page's props. */
function documentParts(page: PageIR, model: ModelIR, ir: SpecIR, t: Texts, auth: AuthIR) {
  const doc = page.document;
  if (!doc) return undefined;
  const n = names(model, t);
  const serverImports = new Map<string, string[]>();
  const uiImports = new Map<string, string[]>();
  const add = (map: Map<string, string[]>, module: string, ...ns: string[]) =>
    map.set(module, [...(map.get(module) ?? []), ...ns]);
  const server = (m: ModelIR) => `#/generated/${kebab(m.name)}.server`;
  add(serverImports, server(model), n.data);
  add(uiImports, n.module, n.ui);
  const checks: string[] = [];
  // A part that may be absent (no one it is for) has nothing missing.
  const check = (part: string, m: ModelIR, show: string[], optional = false) => {
    const worked = workedOut(m, show, t);
    const test = `missing(${part}, ${literal(worked)})`;
    if (worked.length) checks.push(optional ? `(${part} ? ${test} : undefined)` : test);
  };
  check("record", model, [...doc.show, ...(doc.totals ?? [])]);
  const body: string[] = [];
  const result = [
    `row: pick(record, ${literal(keysOf(model, [...doc.show, ...(doc.totals ?? []), ...(doc.note ? [doc.note] : [])]))})`,
  ];
  const props: string[] = [
    `record={{ ui: ${n.ui}, row: found.row, show: ${literal(doc.show.map((f) => keyOf(model, f)))} }}`,
    ...(doc.totals ? [`totals={${literal(doc.totals.map((f) => keyOf(model, f)))}}`] : []),
    ...(doc.note ? [`note=${JSON.stringify(doc.note)}`] : []),
  ];
  if (doc.to) {
    const ref = fieldOf(model, doc.to.ref);
    const target = modelNamed(ir, ref.type.kind === "relation" ? ref.type.model : "");
    const tn = names(target, t);
    add(serverImports, server(target), tn.data);
    add(uiImports, tn.module, tn.ui);
    body.push(`  // Who it is for, by their own read rule.
  const toId = record.${doc.to.ref}Id;
  const to: Found | null = toId == null ? null : ${tn.data}.getIn(q, viewer, Number(toId));
  if (toId != null && !to) return READ;`);
    check("to", target, doc.to.show, true);
    result.push(`to: to && pick(to, ${literal(keysOf(target, doc.to.show))})`);
    props.push(
      `to={found.to ? { ui: ${tn.ui}, row: found.to, show: ${literal(doc.to.show.map((f) => keyOf(target, f)))} } : undefined}`,
    );
  }
  if (doc.lines) {
    const list = fieldOf(model, doc.lines.list);
    const listed = modelNamed(ir, list.type.kind === "relation" ? list.type.model : "");
    const ln = names(listed, t);
    add(serverImports, server(listed), ln.data);
    add(uiImports, ln.module, ln.ui);
    body.push(`  // Each live line by its own read rule: one the person may not read refuses the document.
  const listed = q.query.${n.tableKey}
    .findFirst({
      where: eq(${n.table}.id, id),
      columns: { id: true },
      with: { ${doc.lines.list}: { columns: { id: true },${listed.trash ? " where: (t, { isNull }) => isNull(t.deletedAt)," : ""} orderBy: (t, { asc }) => [asc(t.id)] } },
    })
    .sync();
  const lines: Found[] = [];
  for (const line of listed?.${doc.lines.list} ?? []) {
    const read = ${ln.data}.getIn(q, viewer, line.id);
    if (!read) return READ;
    lines.push(read);
  }`);
    const worked = workedOut(listed, doc.lines.show, t);
    if (worked.length)
      checks.push(`lines.map((line) => missing(line, ${literal(worked)})).find(Boolean)`);
    result.push(
      `lines: lines.map((line) => pick(line, ${literal(keysOf(listed, doc.lines.show))}))`,
    );
    props.push(
      `lines={{ ui: ${ln.ui}, rows: found.lines, show: ${literal(doc.lines.show.map((f) => keyOf(listed, f)))} }}`,
    );
  }
  const settings = doc.from ? settingsModel(ir) : undefined;
  if (doc.from && settings) {
    const sn = names(settings, t);
    add(serverImports, server(settings), sn.data, sn.access);
    add(uiImports, sn.module, sn.ui);
    add(serverImports, "#/kit/access", "AccessDenied");
    // Whose business details: where they are each person's own, those of the record's owner, read
    // from the row itself, since a reader by another rule sees no owner on the record (a record
    // with no owner, a seeded sample, is from whoever reads or sends it: their own, never another
    // member's); where they are the app's, the app's.
    const own =
      hasSignIn(auth) && !addressOwned(model) && !addressOwned(settings) && creatorOwned(settings)
        ? `  if (${sn.access}.read.owner) {
    const owner =
      q.query.${n.tableKey}
        .findFirst({ where: eq(${n.table}.id, id), columns: { ${ownerKey(model)}: true } })
        .sync()?.${ownerKey(model)} ?? viewer?.id;
    const theirs =
      owner == null
        ? undefined
        : q.query.${sn.tableKey}
            .findFirst({
              where: eq(${sn.table}.${ownerKey(settings)}, String(owner)),
              columns: { id: true },
              orderBy: (t, { asc }) => [asc(t.id)],
            })
            .sync();
    if (!theirs) return SETTINGS;
    from = ${sn.data}.getIn(q, viewer, theirs.id);
    if (!from) return READ;
  } else {
`
        : "  {\n";
    body.push(`  // Who it is from: the business details on the settings page.
  let from: Found | null;
${own}    try {
      from = ${sn.data}.firstIn(q, viewer);
    } catch (error) {
      if (error instanceof AccessDenied) return READ;
      throw error;
    }
    if (!from) return SETTINGS;
  }`);
    check("from", settings, doc.from);
    result.push(`from: pick(from, ${literal(keysOf(settings, doc.from))})`);
    props.push(
      `from={found.from ? { ui: ${sn.ui}, row: found.from, show: ${literal(doc.from.map((f) => keyOf(settings, f)))} } : undefined}`,
    );
  }
  // Whether a part may be refused (not readable, the settings missing, a value not there yet):
  // a document of the record's own stored fields alone never is.
  const reads = body.some((line) => line.includes("return READ"));
  const refuses = reads || Boolean(settings) || checks.length > 0;
  return {
    doc,
    n,
    serverImports,
    uiImports,
    checks,
    body,
    result,
    props,
    settings,
    reads,
    refuses,
  };
}

const importLines = (imports: Map<string, string[]>) =>
  [...imports]
    .map(([module, ns]) => `import { ${[...new Set(ns)].sort().join(", ")} } from "${module}";`)
    .join("\n");

/** The function that reads a record as its document, the page's and a sent copy's (§4.2, §5). */
export const documentReaderName = (model: ModelIR) => `read${model.name}Document`;

/**
 * The document's reader (`<model>.document.server.ts`): at once, on the connection given, so the
 * page reads it on the database and an action's mail in its own transaction, by the same rules.
 */
export function documentReader(
  page: PageIR,
  model: ModelIR,
  ir: SpecIR,
  t: Texts,
  auth: AuthIR,
): string | undefined {
  const parts = documentParts(page, model, ir, t, auth);
  if (!parts) return undefined;
  const { doc, n, serverImports, checks, body, result, settings, reads, refuses } = parts;
  return `${HEADER}${doc.lines || settings ? 'import { eq } from "drizzle-orm";\n' : ""}import type { db } from "#/db";
${doc.lines || settings ? `${SCHEMA_IMPORT}\n` : ""}${importLines(serverImports)}
import type { Viewer } from "#/kit/access";

type Found = { id: number } & Record<string, unknown>;
/** A value as the reader gives it: what a field holds, a referenced record, a list. */
type Value = string | number | boolean | null | Date | Value[] | { [key: string]: Value };
type Picked = { id: number } & { [key: string]: Value };

${reads ? 'const READ = { refused: "read" as const };\n' : ""}${settings ? 'const SETTINGS = { refused: "settings" as const };\n' : ""}
/** The named fields of a part, and nothing else. */
function pick(row: Found, keys: string[]): Picked {
  return { id: row.id, ...Object.fromEntries(keys.map((k) => [k, (row[k] ?? null) as Value])) };
}
${
  checks.length
    ? `
/** The label of the first worked-out field without a value. */
function missing(row: Found, worked: string[][]): string | undefined {
  return worked.find(([key]) => row[key as string] == null || Number.isNaN(row[key as string]))?.[1];
}
`
    : ""
}
/** The record and its parts as the person may read them, ${refuses ? "why it cannot be a document, " : ""}or null when they may not read it. */
export function ${documentReaderName(model)}(q: Pick<typeof db, "query">, viewer: Viewer | null, id: number) {
  const found = ${n.data}.getIn(q, viewer, id);
  if (!found) return null;
  const record: Found = found;
${body.join("\n")}${
  checks.length
    ? `
  const label = ${checks.join(" ?? ")};
  if (label) return { refused: "missing" as const, label };`
    : ""
}
  return { ${result.join(", ")} };
}
`;
}

/** The document's route file, or none for a page without a document. */
export function documentRoute(
  page: PageIR,
  model: ModelIR,
  ir: SpecIR,
  t: Texts,
  auth: AuthIR,
  /** Its record's mails send links to a copy (record-documents.md §5): the page lists them. */
  sends = false,
): string | undefined {
  const parts = documentParts(page, model, ir, t, auth);
  if (!parts) return undefined;
  const { uiImports, props, refuses } = parts;
  const n = parts.n;
  const component = `${model.name}DocumentPage`;
  const fn = `get${model.name}Document`;
  const settingsPage = ir.pages.find((p) => p.pattern.kind === "settings");
  const words = t.document(page.id);
  const title = words.title ?? n.label;
  const { title: _title, ...blockWords } = words;
  if (Object.keys(blockWords).length) props.push(`words={${literal(blockWords)}}`);
  const owner = !hasSignIn(auth)
    ? "undefined"
    : addressOwned(model)
      ? `addressOwner(row.owner, viewer)`
      : "row.owner";
  const sent = sends
    ? `
/** Whether the viewer may withdraw the record's links: whoever may read and change it. */
async function mayWithdraw(viewer: Viewer | null, id: number): Promise<boolean> {
  if (!(await ${n.data}.get(viewer, id))) return false;
  const row = db.select({ owner: ${n.table}.${hasSignIn(auth) ? ownerKey(model) : "id"} }).from(${n.table}).where(eq(${n.table}.id, id)).get();
  return row !== undefined && allows(${n.access}.write, viewer, ${owner});
}

/** What was sent of the record (only to whoever may read it), and whether they may withdraw it. */
const getSent = createServerFn()
  .validator(z.number().int())
  .handler(async ({ data: id }) => {
    const viewer = await currentViewer();
    if (!(await ${n.data}.get(viewer, id))) return { sent: [], withdraw: false };
    const sent = sentOf(${JSON.stringify(model.name)}, id).map(({ id, sentAt, to }) => ({ id, sentAt, to }));
    return { sent, withdraw: await mayWithdraw(viewer, id) };
  });

/** Ends every open link to the record's sent copies, for good. */
const withdrawSent = createServerFn({ method: "POST" })
  .validator(z.number().int())
  .handler(async ({ data: id }) => {
    const viewer = await currentViewer();
    writeAllowed(viewer, getRequestHeaders());
    if (!(await mayWithdraw(viewer, id))) throw new AccessDenied(viewer !== null);
    return db.transaction((tx) => endLinks(tx, viewer, ${JSON.stringify(model.name)}, id, "withdrawn"));
  });
`
    : "";
  return `${HEADER}import { createFileRoute, notFound${sends ? ", useRouter" : ""} } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";${sends ? '\nimport { getRequestHeaders } from "@tanstack/react-start/server";\nimport { eq } from "drizzle-orm";' : ""}
import { z } from "zod";
import { db } from "#/db";${sends ? `\n${SCHEMA_IMPORT}` : ""}
import { app } from "#/generated/app";
import { ${documentReaderName(model)} } from "#/generated/${kebab(model.name)}.document.server";
import { pageAccess } from "#/generated/pages";${sends ? `\nimport { ${n.access}, ${n.data} } from "#/generated/${kebab(model.name)}.server";` : ""}
${importLines(uiImports)}${sends ? `\nimport { AccessDenied, ${hasSignIn(auth) && addressOwned(model) ? "addressOwner, " : ""}allows, type Viewer } from "#/kit/access";` : ""}
import { ${refuses ? "DocumentRefused, " : ""}RecordDocument } from "#/kit/Document";${sends ? '\nimport { writeAllowed } from "#/kit/limit";' : ""}
import { guardPage } from "#/kit/page-guard";${sends ? '\nimport { SentDocuments } from "#/kit/SentDocuments";\nimport { endLinks, sentOf } from "#/kit/view.server";' : ""}
import { currentViewer } from "#/lib/viewer.server";

/** The record and its parts as the person may read them, or why the document cannot be printed. */
const ${fn} = createServerFn()
  .validator(z.number().int())
  .handler(async ({ data: id }) => ${documentReaderName(model)}(db, await currentViewer(), id));
${sent}
export const Route = createFileRoute(${JSON.stringify(join(page.route, "$id_/document"))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}  loader: async ({ params }) => {
    const found = await ${fn}({ data: Number(params.id) });
    if (!found) throw notFound();
    return ${sends ? "{ ...found, sent: await getSent({ data: Number(params.id) }) }" : "found"};
  },
  head: () => pageHead(${JSON.stringify(page.id)}, ${JSON.stringify(title)}),
  component: ${component},
});

function ${component}() {
  const found = Route.useLoaderData();${sends ? "\n  const { id } = Route.useParams();\n  const router = useRouter();" : ""}${
    refuses
      ? `
  if (found.refused)
    return <DocumentRefused refusal={found}${settingsPage ? ` settings=${JSON.stringify(settingsPage.route)}` : ""} />;`
      : ""
  }
  return ${
    sends
      ? `(
    <>
      <RecordDocument
        app={app}
        title=${attr(title)}
        ${props.join("\n        ")}
      />
      <SentDocuments
        sent={found.sent.sent}
        timeZone={app.timeZone}
        withdraw={
          found.sent.withdraw
            ? async () => {
                await withdrawSent({ data: Number(id) });
                await router.invalidate();
              }
            : undefined
        }
      />
    </>
  );`
      : `(
    <RecordDocument
      app={app}
      title=${attr(title)}
      ${props.join("\n      ")}
    />
  );`
  }
}
`;
}

/**
 * The page a sent document's link opens (record-documents.md §5): the stored copy alone, never
 * the live record, for whoever holds the link. A wrong, ended or withdrawn link is the same "not
 * found"; the page is kept out of search engines, caches and the next site's Referer.
 */
export function viewRoute(ir: SpecIR, t: Texts, auth: AuthIR, models: string[]): string {
  const uiImports = new Map<string, string[]>();
  const copies = models.flatMap((name) => {
    const model = modelNamed(ir, name);
    const page = ir.pages.find(
      (p) => p.pattern.kind === "crud" && p.pattern.model === name && p.document,
    );
    const parts = page && documentParts(page, model, ir, t, auth);
    if (!page || !parts) return [];
    for (const [module, ns] of parts.uiImports)
      uiImports.set(module, [...new Set([...(uiImports.get(module) ?? []), ...ns])]);
    const { title: given, ...blockWords } = t.document(page.id);
    const title = given ?? parts.n.label;
    const props = [...parts.props];
    if (Object.keys(blockWords).length) props.push(`words={${literal(blockWords)}}`);
    return [{ name, title, props, table: parts.n.table, trash: Boolean(model.trash) }];
  });
  return `${HEADER}import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { and, eq${copies.some((c) => c.trash) ? ", isNull" : ""} } from "drizzle-orm";
import { db } from "#/db";
${SCHEMA_IMPORT}
import { app } from "#/generated/app";
${importLines(uiImports)}
import { RecordDocument } from "#/kit/Document";
import { viewAllowed, viewMissed } from "#/kit/limit";
import { openCopy } from "#/kit/view.server";

/** The copy a link opens, or null: the same for a wrong, an ended and a withdrawn link. */
const getCopy = createServerFn()
  // Whatever is sent reaches the limiter, cut short: only a 43-character token can open a copy.
  .validator((token: unknown) => (typeof token === "string" ? token.slice(0, 100) : ""))
  .handler(({ data: token }) => {
    const headers = getRequestHeaders();
    viewAllowed(headers);
    const found = openCopy(token);
    // A record gone or in the trash by any way (a parent's with it, too) opens no copy.
    const copy =
      found && Object.hasOwn(LIVE, found.model) && LIVE[found.model]?.(found.record) ? found : null;
    if (!copy) viewMissed(headers);
    // The stored copy as it was sent: its parts, picked when it was sent.
    return copy && { model: copy.model, found: copy.content as Found };
  });

/** Whether a sent copy's record is still there and not in the trash, by its model. */
const LIVE: Record<string, (id: number) => boolean> = {
${copies.map((c) => `  ${c.name}: (id) =>\n    db\n      .select({ id: ${c.table}.id })\n      .from(${c.table})\n      .where(and(eq(${c.table}.id, id)${c.trash ? `, isNull(${c.table}.deletedAt)` : ""}))\n      .get() !== undefined,\n`).join("")}};

/** A value as the copy holds it: dates are text in the stored copy. */
type Value = string | number | boolean | null | Value[] | { [key: string]: Value };
type Part = { id: number } & { [key: string]: Value };
// The parts a document has are always in its copy: lines, when it has them, are a list.
type Found = { row: Part; to?: Part | null; lines: Part[]; from?: Part };

/** Each document's title, by its model. */
const TITLES: Record<string, string> = ${literal(Object.fromEntries(copies.map((c) => [c.name, c.title])))};

export const Route = createFileRoute("/d/$token")({
  loader: async ({ params }) => {
    const copy = await getCopy({ data: params.token });
    if (!copy || !(copy.model in TITLES)) throw notFound();
    return copy;
  },
  headers: () => ({
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex",
  }),
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? \`\${TITLES[loaderData.model]} · \${app.name}\` : app.name },
      { name: "robots", content: "noindex" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: SentDocumentPage,
});

function SentDocumentPage() {
  const { model, found } = Route.useLoaderData();
  switch (model) {${copies
    .map(
      (c) => `
    case ${JSON.stringify(c.name)}:
      return (
        <RecordDocument
          app={app}
          title=${attr(c.title)}
          ${c.props.join("\n          ")}
        />
      );`,
    )
    .join("")}
    default:
      return null;
  }
}
`;
}
