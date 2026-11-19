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
function settingsModel(ir: SpecIR): ModelIR | undefined {
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
export function documentRoute(
  page: PageIR,
  model: ModelIR,
  ir: SpecIR,
  t: Texts,
  auth: AuthIR,
): string | undefined {
  const doc = page.document;
  if (!doc) return undefined;
  const n = names(model, t);
  const component = `${model.name}DocumentPage`;
  const fn = `get${model.name}Document`;
  const imports = new Map<string, string[]>();
  const add = (module: string, ...ns: string[]) =>
    imports.set(module, [...(imports.get(module) ?? []), ...ns]);
  const server = (m: ModelIR) => `#/generated/${kebab(m.name)}.server`;
  add(server(model), n.data);
  add(n.module, n.ui);
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
    add(server(target), tn.data);
    add(tn.module, tn.ui);
    body.push(`    // Who it is for, by their own read rule.
    const toId = record.${doc.to.ref}Id;
    const to: Found | null = toId == null ? null : await ${tn.data}.get(viewer, Number(toId));
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
    add(server(listed), ln.data);
    add(ln.module, ln.ui);
    body.push(`    // Each live line by its own read rule: one the person may not read refuses the document.
    const listed = await db.query.${n.tableKey}.findFirst({
      where: eq(${n.table}.id, id),
      columns: { id: true },
      with: { ${doc.lines.list}: { columns: { id: true },${listed.trash ? " where: (t, { isNull }) => isNull(t.deletedAt)," : ""} orderBy: (t, { asc }) => [asc(t.id)] } },
    });
    const lines: Found[] = [];
    for (const line of listed?.${doc.lines.list} ?? []) {
      const read = await ${ln.data}.get(viewer, line.id);
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
  const settingsPage = ir.pages.find((p) => p.pattern.kind === "settings");
  if (doc.from && settings) {
    const sn = names(settings, t);
    add(server(settings), sn.data, sn.access);
    add(sn.module, sn.ui);
    add("#/kit/access", "AccessDenied");
    // Whose business details: where they are each person's own, those of the record's owner;
    // where they are the app's, the app's.
    const own =
      hasSignIn(auth) && !addressOwned(model) && !addressOwned(settings) && creatorOwned(settings)
        ? `    if (${sn.access}.read.owner) {
      const owner = record.${ownerKey(model)};
      const theirs =
        owner == null
          ? undefined
          : await db.query.${sn.tableKey}.findFirst({
              where: eq(${sn.table}.${ownerKey(settings)}, String(owner)),
              columns: { id: true },
              orderBy: (t, { asc }) => [asc(t.id)],
            });
      if (!theirs) return SETTINGS;
      from = await ${sn.data}.get(viewer, theirs.id);
      if (!from) return READ;
    } else {
`
        : "    {\n";
    body.push(`    // Who it is from: the business details on the settings page.
    let from: Found | null;
${own}      try {
        from = await ${sn.data}.first(viewer);
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
  const words = t.document(page.id);
  const title = words.title ?? n.label;
  const { title: _title, ...blockWords } = words;
  if (Object.keys(blockWords).length) props.push(`words={${literal(blockWords)}}`);
  // Whether a part may be refused (not readable, the settings missing, a value not there yet):
  // a document of the record's own stored fields alone never is.
  const reads = body.some((line) => line.includes("return READ"));
  const refuses = reads || Boolean(settings) || checks.length > 0;
  return `${HEADER}import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
${doc.lines || settings ? 'import { eq } from "drizzle-orm";\n' : ""}import { z } from "zod";
${doc.lines || settings ? `import { db } from "#/db";\n${SCHEMA_IMPORT}\n` : ""}import { app } from "#/generated/app";
import { pageAccess } from "#/generated/pages";
${[...imports].map(([module, ns]) => `import { ${[...new Set(ns)].sort().join(", ")} } from "${module}";`).join("\n")}
import { ${refuses ? "DocumentRefused, " : ""}RecordDocument } from "#/kit/Document";
import { guardPage } from "#/kit/page-guard";
import { currentViewer } from "#/lib/viewer.server";

type Found = { id: number } & Record<string, unknown>;
/** A value as the server function sends it: what a field holds, a referenced record, a list. */
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
/** The record and its parts as the person may read them, or why the document cannot be printed. */
const ${fn} = createServerFn()
  .validator(z.number().int())
  .handler(async ({ data: id }) => {
    const viewer = await currentViewer();
    const found = await ${n.data}.get(viewer, id);
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
  });

export const Route = createFileRoute(${JSON.stringify(join(page.route, "$id_/document"))})({
${guard(`pageAccess[${JSON.stringify(page.id)}]`)}  loader: async ({ params }) => {
    const found = await ${fn}({ data: Number(params.id) });
    if (!found) throw notFound();
    return found;
  },
  head: () => pageHead(${JSON.stringify(page.id)}, ${JSON.stringify(title)}),
  component: ${component},
});

function ${component}() {
  const found = Route.useLoaderData();${
    refuses
      ? `
  if (found.refused)
    return <DocumentRefused refusal={found}${settingsPage ? ` settings=${JSON.stringify(settingsPage.route)}` : ""} />;`
      : ""
  }
  return (
    <RecordDocument
      app={app}
      title=${attr(title)}
      ${props.join("\n      ")}
    />
  );
}
`;
}
