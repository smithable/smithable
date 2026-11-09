// Import from a file in the app and the API (A 238): for each model with a list page, the kit's
// import (src/kit/import.server.ts) with this model's parts, the server functions the list page's
// Import calls, and the batch the API's POST takes. Nothing new in the spec.
import {
  type FieldIR,
  kebab,
  type ModelIR,
  pageModel,
  plural,
  type SpecIR,
  USER_MODEL,
} from "@smithable/core";
import { dataKey, HEADER, modelNamed, names, SCHEMA_IMPORT, type Texts } from "./shared.js";

/**
 * The models records can be imported into: those with a list page (its Import), and those the API
 * offers (a JSON list; `api` names them), each undone through this module.
 */
export function importModels(ir: SpecIR, api: string[] = []): ModelIR[] {
  return ir.models.filter(
    (m) =>
      m.name !== USER_MODEL &&
      (api.includes(m.name) ||
        ir.pages.some((p) => p.pattern.kind === "crud" && pageModel(p) === m.name)),
  );
}

/** The names a list page and the API call it by. */
export function importNames(model: ModelIR) {
  const p = plural(model.name);
  return {
    module: `#/generated/${kebab(model.name)}.import`,
    server: `#/generated/${kebab(model.name)}.import.server`,
    run: `import${p}`,
    undo: `undoImport${p}`,
    rows: `import${p}Rows`,
    undoRows: `undo${p}Import`,
  };
}

/** A reference a file can fill by the title of the record it names (not people who sign in). */
const referenced = (f: FieldIR) =>
  f.type.kind === "relation" && !f.type.many && f.type.model !== USER_MODEL;

export function importModule(ir: SpecIR, model: ModelIR, t: Texts): string {
  const n = names(model, t);
  const i = importNames(model);
  const refs = model.fields.filter(referenced);
  const targets = [...new Set(refs.map((f) => (f.type as { model: string }).model))]
    .filter((m) => m !== model.name)
    .map((m) => modelNamed(ir, m));
  return `${HEADER}// Importing ${n.pluralLabel.toLowerCase()} from a file or a JSON list (the kit's import with this model's parts).
import { ${model.trash ? "and, inArray, isNull" : "inArray"} } from "drizzle-orm";
import { db } from "#/db";
${SCHEMA_IMPORT}
import { app } from "#/generated/app";
import type { Viewer } from "#/kit/access";
import { importRows, undoImport } from "#/kit/import.server";
import { ${n.ui} } from "./${kebab(model.name)}";
import { ${n.access}, ${n.data} } from "./${kebab(model.name)}.server";
import { ${n.schema} } from "./${kebab(model.name)}.schema";
${targets.map((m) => `import { ${names(m, t).data} } from "./${kebab(m.name)}.server";\n`).join("")}
${
  refs.length
    ? `/** A referenced record's id by its title, among those the viewer may read. */
async function lookup(viewer: Viewer | null) {
  const titles: Record<string, Map<string, number | "several">> = {};
  const add = (field: string, options: { value: number; label: string }[]) => {
    const found = new Map<string, number | "several">();
    for (const o of options) {
      const key = o.label.trim().toLowerCase();
      found.set(key, found.has(key) ? "several" : o.value);
    }
    titles[field] = found;
  };
${refs
  .map(
    (f) =>
      `  add(${JSON.stringify(dataKey(f))}, await ${names(modelNamed(ir, (f.type as { model: string }).model), t).data}.options(viewer));`,
  )
  .join("\n")}
  return (field: string, title: string) => titles[field]?.get(title.trim().toLowerCase());
}`
    : `/** No references: nothing to look up. */
const lookup = async () => () => undefined;`
}

/** A file's rows as ${n.pluralLabel.toLowerCase()}, or with \`dryRun\` what would go in. */
export function ${i.rows}(viewer: Viewer | null, file: string, rows: string[][], dryRun: boolean) {
  return importRows({
    viewer,
    ui: ${n.ui},
    access: ${n.access}.create,
    schema: ${n.schema},
    create: (who, values) => ${n.data}.create(who, values),
    lookup,
    file,
    rows,
    dryRun,
    timeZone: app.timeZone,
  });
}

/** Takes an import of ${n.pluralLabel.toLowerCase()} back (its importer, within a day). */
export function ${i.undoRows}(viewer: Viewer | null, id: number) {
  return undoImport({
    viewer,
    ui: ${n.ui},
    id,
    trash: ${Boolean(model.trash)},
    rows: (ids) =>
      db
        .select()
        .from(${n.table})
        .where(${model.trash ? `and(inArray(${n.table}.id, ids), isNull(${n.table}.deletedAt))` : `inArray(${n.table}.id, ids)`})
        .all()
        .map((r) => ({
          id: r.id,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
          title: String((r as Record<string, unknown>)[${n.ui}.titleField] ?? \`#\${r.id}\`),
        })),
    removeMany: (who, ids) => ${n.data}.removeMany(who, ids),
  });
}

`;
}

/** The server functions the list page's Import calls (the work is in the .import.server module). */
export function importFunctions(model: ModelIR): string {
  const i = importNames(model);
  return `${HEADER}// Importing from a file: the server functions a list page's Import calls (A 238).
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { IMPORT_MAX } from "#/kit/import";
import { writeAllowed } from "#/kit/limit";
import { currentViewer } from "#/lib/viewer.server";
import { ${i.rows}, ${i.undoRows} } from "./${kebab(model.name)}.import.server";

export const ${i.run} = createServerFn({ method: "POST" })
  .validator(
    z.object({
      file: z.string().max(500),
      rows: z.array(z.array(z.string())).max(IMPORT_MAX + 1),
      dryRun: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const viewer = await currentViewer();
    if (!data.dryRun) writeAllowed(viewer, getRequestHeaders());
    return ${i.rows}(viewer, data.file, data.rows, data.dryRun);
  });

export const ${i.undo} = createServerFn({ method: "POST" })
  .validator(z.number().int())
  .handler(async ({ data }) => {
    const viewer = await currentViewer();
    writeAllowed(viewer, getRequestHeaders());
    return ${i.undoRows}(viewer, data);
  });
`;
}
