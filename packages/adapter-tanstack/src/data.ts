// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import {
  type AuthIR,
  type FieldIR,
  humanize,
  isPicture,
  isPictures,
  kebab,
  type ModelIR,
  modelAccess,
  PICTURES_MAX,
  type SpecIR,
  storesPictures,
  USER_MODEL,
  type UxIR,
} from "@smithable/core";
import { hasSignIn } from "./auth.js";
import { aggregatedLists, defaultsName, hasFormulas, withFormulasName } from "./formulas.js";
import {
  code,
  dataKey,
  type GenContext,
  HEADER,
  hasFavorites,
  type importList,
  lists,
  literal,
  modelNamed,
  names,
  ownerKey,
  references,
  relatedTitle,
  shownFields,
  storedFields,
  type Texts,
  tableNames,
  titleField,
  userFields,
} from "./shared.js";

// ── Models: UI description, validation and server functions ─────────────────

/**
 * A table's default columns, at most five: the title, then pictures, then required fields, then
 * the rest, each in the spec's order; long texts never (a card shows the description instead).
 */
function columnsOf(model: ModelIR, shown: FieldIR[]): FieldIR[] {
  const rank = (f: FieldIR) =>
    f.name === titleField(model) ? 0 : storesPictures(f) ? 1 : f.required ? 2 : 3;
  return shown
    .filter((f) => !(f.type.kind === "scalar" && ["text", "markdown"].includes(f.type.name)))
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .slice(0, 5)
    .map(({ f }) => f);
}

export function modelModule(model: ModelIR, t: Texts, ir: SpecIR, auth: AuthIR, ux: UxIR): string {
  const n = names(model, t);
  const stored = storedFields(model);
  const shown = shownFields(model);
  const formulas = hasFormulas(model);
  const long = (f: FieldIR) =>
    f.type.kind === "scalar" && ["text", "markdown"].includes(f.type.name);
  // A card's description: a long text called that (or a summary), else the first required one;
  // never an optional note.
  const description =
    shown.find((f) => long(f) && ["description", "summary"].includes(f.name)) ??
    shown.find((f) => long(f) && f.required);
  const ui = {
    model: model.name,
    label: n.label,
    pluralLabel: n.pluralLabel,
    titleField: titleField(model),
    ...(description ? { descriptionField: dataKey(description) } : {}),
    columns: columnsOf(model, shown).map(dataKey),
    fields: shown.map((field) => ({
      ...fieldUi(model, field, t, ir, ux),
      get: code(accessor(field)),
    })),
  };
  // A record as the kit reads it: its columns, and the references and computed values it may
  // carry (a list's rows have them, a record's own list of related records does not).
  const extras = shown.flatMap((f) => {
    if (f.type.kind === "relation") {
      const title = relatedTitle(ir, f.type.model);
      const user = f.type.model === USER_MODEL;
      // The title as Drizzle gives it: a user's name always, another model's title field
      // when it is required, else possibly null.
      const titleType =
        user || modelNamed(ir, f.type.model).fields.find((x) => x.name === title)?.required
          ? "string"
          : "string | null";
      return [
        `${f.name}?: { id: ${user ? "string" : "number"}${title === "id" ? "" : `; ${title}: ${titleType}`} } | null`,
      ];
    }
    return f.formula ? [`${f.name}?: unknown`] : [];
  });
  const rowType = `typeof ${n.table}.$inferSelect${extras.length ? ` & {\n  ${extras.join(";\n  ")};\n}` : ""}`;
  function accessor(f: FieldIR): string {
    if (f.type.kind !== "relation") return `(row) => row.${f.name}`;
    const title = relatedTitle(ir, f.type.model);
    return title === "id"
      ? `(row) => (row.${f.name} ? \`#\${row.${f.name}.id}\` : null)`
      : `(row) => row.${f.name}?.${title} ?? null`;
  }
  const uiSource = literal({
    ...ui,
    ...(formulas
      ? { compute: code(withFormulasName(model)), defaults: code(defaultsName(model)) }
      : {}),
  });
  // Records visitors add, without an account (e.g. a contact form's messages).
  const visitors = modelAccess(model, auth).create.public;
  const refinements = stored.flatMap((f) => {
    const r = refinement(f, visitors);
    return r ? [`  ${f.name}: ${r},`] : [];
  });
  const schema = refinements.length
    ? `createInsertSchema(${n.table}, {\n${refinements.join("\n")}\n})`
    : `createInsertSchema(${n.table})`;
  const omitted = [
    "id",
    ...(model.ownedBy || !hasSignIn(auth) ? [] : ["ownerId"]),
    "createdAt",
    "updatedAt",
  ];
  const referenced = ir.models.some((m) => references(m).some((f) => f.type.model === model.name));
  const owner = ownerKey(model);
  const options = referenced
    ? `
/** Choices for fields that refer to a ${n.label.toLowerCase()}. */
export const ${n.options} = createServerFn().handler(async () =>
  ${n.data}.options(await currentViewer()),
);
`
    : "";
  // A capacity: the reservation block's server functions (docs/design/booking.md): a
  // record's places, and taking one in a step. Canceling is the delete above.
  const capacity = hasSignIn(auth) ? model.capacity : undefined;
  const perModel = capacity && relationTarget(model, capacity.per, ir);
  const perData = perModel && names(perModel, t).data;
  const reservation =
    capacity && perModel
      ? `
/** A ${capacity.per}'s places for the reservation block: how many are left, and the viewer's own. */
export const ${reserveNames(model).places} = createServerFn()
  .validator(z.number().int())
  .handler(async ({ data: id }) => {
    const viewer = await currentViewer();
    if (!${perData}.canRead(viewer, id)) return null;
    const { taken, max } = ${n.data}.places(id);
    return {
      left: Math.max(0, max - taken),
      max,
      mine: viewer ? ${n.data}.mine(viewer, id) : undefined,
      canBook: allows(${n.access}.create, viewer),
      signedIn: viewer !== null,
    };
  });

/** Takes a place in one step: the other fields have their defaults. */
export const ${reserveNames(model).book} = createServerFn({ method: "POST" })
  .validator(z.number().int())
  .handler(async ({ data: id }) =>
    ${n.data}.create(await writer(), { ${capacity.per}Id: id } as ${n.values}),
  );
`
      : "";
  return `${HEADER}import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { ${n.table} } from "#/db/schema";
import { allows } from "#/kit/access";
import type { RecordUi } from "#/kit/model";
${model.fields.some(isMarkdown) ? 'import { MarkdownEditor } from "#/kit/Markdown";\n' : ""}${model.fields.some(storesPictures) ? `import { ${[...(model.fields.some(isPicture) ? ["bindPicture"] : []), ...(model.fields.some(isPictures) ? ["bindPictures"] : [])].join(", ")} } from "#/kit/PictureInput";\n` : ""}${formulas ? `import { ${defaultsName(model)}, ${withFormulasName(model)} } from "./${kebab(model.name)}.formulas";\n` : ""}import { ${n.access}, ${n.data} } from "./${kebab(model.name)}.server";
${perModel && perModel !== model ? `import { ${perData} } from "./${kebab(perModel.name)}.server";\n` : ""}import { writeAllowed } from "#/kit/limit";
import { currentViewer } from "#/lib/viewer.server";

/** The viewer about to write, counted against how often one may (see src/kit/limit.ts). */
async function writer() {
  const viewer = await currentViewer();
  writeAllowed(viewer, getRequestHeaders());
  return viewer;
}

/** ${model.name} records as the kit reads them. */
export type ${model.name}Row = ${rowType};

export const ${n.ui}: RecordUi<${model.name}Row> = ${uiSource};

export const ${n.schema} = ${schema}.omit({ ${omitted.map((k) => `${k}: true`).join(", ")} });

export type ${n.values} = z.output<typeof ${n.schema}>;

export const ${n.list} = createServerFn().handler(async () => {
  const viewer = await currentViewer();
  return { rows: await ${n.data}.list(viewer), canCreate: allows(${n.access}.create, viewer) };
});

export const ${n.get} = createServerFn()
  .validator(z.number().int())
  .handler(async ({ data: id }) => {
    const viewer = await currentViewer();
    const row = await ${n.data}.get(viewer, id);
    if (!row) return null;
    return {
      row,${
        hasFavorites(model, ir, auth)
          ? `
      saved: ${n.data}.saved(viewer).includes(id),`
          : ""
      }
      canWrite: allows(${n.access}.write, viewer${hasSignIn(auth) ? `, row.${owner}` : ""}),
      canDelete: allows(${n.access}.delete, viewer${hasSignIn(auth) ? `, row.${owner}` : ""}),
    };
  });
${options}
export const ${n.create} = createServerFn({ method: "POST" })
  .validator(${n.schema})
  .handler(async ({ data }) => ${n.data}.create(await writer(), data));

export const ${n.update} = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int(), values: ${n.schema} }))
  .handler(async ({ data }) => ${n.data}.update(await writer(), data.id, data.values));

export const ${n.remove} = createServerFn({ method: "POST" })
  .validator(z.number().int())
  .handler(async ({ data: id }) => ${n.data}.remove(await writer(), id));
${
  hasFavorites(model, ir, auth)
    ? `
/** Saves the record for the viewer, or unsaves it (their own mark); whether it is saved now. */
export const ${savedToggle(model)} = createServerFn({ method: "POST" })
  .validator(z.number().int())
  .handler(async ({ data: id }) => ${n.data}.toggleSaved(await writer(), id));
`
    : ""
}${reservation}`;
}

/** The server function behind a model's hearts (marketplace.md §2.3). */
export function savedToggle(model: ModelIR): string {
  return `toggleSaved${model.name}`;
}

/** The model a reference of `model` points to. */
function relationTarget(model: ModelIR, field: string, ir: SpecIR): ModelIR | undefined {
  const f = model.fields.find((x) => x.name === field);
  return f?.type.kind === "relation" ? modelNamed(ir, f.type.model) : undefined;
}

/** The model whose capacity counts places on this model's records (Booking for Session), if any. */
export function placesOn(model: ModelIR, ir: SpecIR): ModelIR | undefined {
  return ir.models.find(
    (m) => m.capacity && relationTarget(m, m.capacity.per, ir)?.name === model.name,
  );
}

/**
 * The reservation block for a record of `model` (a session), when another model's capacity
 * counts places on it: its element, with `id` the record's id expression.
 */
export function reserveElement(
  model: ModelIR,
  { ir, t, auth }: Pick<GenContext, "ir" | "t" | "auth">,
  add: (module: string, ...names: string[]) => unknown,
  id: string,
): string | undefined {
  const booked = hasSignIn(auth) ? placesOn(model, ir) : undefined;
  if (!booked) return undefined;
  const bn = names(booked, t);
  const r = reserveNames(booked);
  add(bn.module, r.places, r.book, bn.remove);
  add("#/kit/Reserve", "Reserve");
  return `<Reserve id={${id}} load={${r.places}} book={${r.book}} cancel={${bn.remove}}${t.reserve(booked)} />`;
}

/** The reservation block's server functions for a model with a capacity, e.g. bookingPlaces. */
export function reserveNames(model: ModelIR) {
  const base = model.name.charAt(0).toLowerCase() + model.name.slice(1);
  return { places: `${base}Places`, book: `reserve${model.name}` };
}

/**
 * The model's data functions: every read and write goes through the access rules, for the
 * given viewer. Server-only; custom code uses these too.
 */
export function dataModule(model: ModelIR, t: Texts, ir: SpecIR, auth: AuthIR): string {
  const n = names(model, t);
  const formulas = hasFormulas(model);
  const signedIn = hasSignIn(auth);
  const owner = ownerKey(model);
  // A data page lists the model's newest records only: its list takes a limit.
  const capped = ir.pages.some(
    (p) => p.pattern.kind === "data" && p.pattern.models.includes(model.name),
  );
  // A page that lets its viewer sort the list: the order goes into the query (marketplace.md §2.2).
  const ordered = ir.pages.some(
    (p) => p.pattern.kind === "crud" && p.pattern.model === model.name && p.sortable?.length,
  );
  const title = (m: ModelIR) => {
    const f = titleField(m);
    return f === "id" ? "{ id: true }" : `{ id: true, ${f}: true }`;
  };
  // Related records to include: the title of each referenced record (and user), and for
  // lists the listed records the viewer may read, with the titles of what they refer to.
  const withReferences = (m: ModelIR, except?: string) => [
    ...references(m)
      .filter((f) => f.type.model !== except)
      .map((f) => `${f.name}: { columns: ${title(modelNamed(ir, f.type.model))} }`),
    ...userFields(m).map((f) => `${f.name}: { columns: { id: true, name: true } }`),
  ];
  const listWith = [
    ...withReferences(model),
    ...aggregatedLists(model).map((list) => `${list}: true`),
  ];
  const others = new Set<ModelIR>();
  const getWith = [
    ...withReferences(model),
    ...lists(model).map((f) => {
      const target = modelNamed(ir, f.type.model);
      others.add(target);
      const nested = withReferences(target, model.name);
      const where = `where: ${names(target, t).data}.readable(viewer)`;
      return `${f.name}: { ${where}${nested.length ? `, with: { ${nested.join(", ")} }` : ""} }`;
    }),
  ];
  // Totals over lists the viewer may not read in full (another's bookings): a record's page
  // must count them all, as lists do.
  const everyone = (m: ModelIR) => {
    const read = modelAccess(m, auth).read;
    return (
      auth.signIn === "none" ||
      read.public ||
      (!modelAccess(model, auth).read.public &&
        !read.owner &&
        read.roles.length >= auth.roles.length)
    );
  };
  const hiddenTotals = aggregatedLists(model).filter((list) => {
    const f = model.fields.find((x) => x.name === list);
    return f?.type.kind === "relation" && !everyone(modelNamed(ir, f.type.model));
  });
  const refs = references(model);
  for (const ref of refs)
    if (ref.type.model !== model.name) others.add(modelNamed(ir, ref.type.model));
  const withClause = (entries: string[], indent: string) =>
    entries.length ? `\n${indent}with: { ${entries.join(", ")} },` : "";
  const compute = (expr: string) => (formulas ? `${withFormulasName(model)}(${expr})` : expr);
  const titleColumn = titleField(model);
  const referenced = ir.models.some((m) => references(m).some((f) => f.type.model === model.name));
  const access = modelAccess(model, auth);
  // A capacity: at most so many of these per referenced record (docs/design/booking.md),
  // checked in the same transaction as the write. And the records that hold a capacity for
  // this model's records ("max" a field here): lowering it below what is taken is refused.
  const capacity = model.capacity;
  const holds = ir.models.filter((m) => {
    const c = m.capacity;
    if (!c) return false;
    const per = m.fields.find((f) => f.name === c.per);
    return (
      per?.type.kind === "relation" && per.type.model === model.name && typeof c.max === "string"
    );
  });
  const drizzle = [
    "and",
    "eq",
    "sql",
    ...(referenced && titleColumn !== "id" ? ["asc"] : []),
    ...(access.create.public || capped || capacity || holds.length ? ["count"] : []),
    ...(access.create.public && signedIn ? ["isNull"] : []),
    ...(capacity ? ["ne"] : []),
    ...(access.read.where && signedIn && access.read.owner ? ["or"] : []),
  ];
  // Visitors (and anyone reading only because it is public) read the records the public
  // condition fits; an owner reads their own too.
  const publicWhere = access.read.where
    ? `and(${Object.entries(access.read.where)
        .map(([k, v]) => `eq(${n.table}.${k}, ${JSON.stringify(v)})`)
        .join(", ")})`
    : undefined;
  const ownOrPublic = !signedIn
    ? "sql`false`"
    : publicWhere && access.read.owner
      ? `scope === "own" && viewer ? or(eq(${n.table}.${owner}, viewer.id), ${publicWhere}) : sql\`false\``
      : `scope === "own" && viewer ? eq(${n.table}.${owner}, viewer.id) : sql\`false\``;
  const capacityCounted = capacity
    ? [
        `eq(${n.table}.${capacity.per}Id, values.${capacity.per}Id)`,
        ...Object.entries(capacity.where ?? {}).map(
          ([k, v]) => `eq(${n.table}.${k}, ${JSON.stringify(v)})`,
        ),
      ]
    : [];
  const perField = capacity && model.fields.find((f) => f.name === capacity.per);
  const perTarget =
    perField?.type.kind === "relation" ? tableNames(modelNamed(ir, perField.type.model)).table : "";
  const capacityMax = capacity
    ? typeof capacity.max === "number"
      ? String(capacity.max)
      : `(tx.select({ n: ${perTarget}.${capacity.max.split(".")[1]} }).from(${perTarget}).where(eq(${perTarget}.id, values.${capacity.per}Id)).get()?.n ?? 0)`
    : "0";
  /** The check before a write inside its transaction; `except` leaves out the record being changed. */
  const capacityCheck = (except?: string) =>
    capacity
      ? `
      const taken = tx.select({ n: count() }).from(${n.table}).where(and(${[...capacityCounted, ...(except ? [`ne(${n.table}.id, ${except})`] : [])].join(", ")})).get()?.n ?? 0;
      if (taken >= ${capacityMax}) throw new Conflict("full");`
      : "";
  const holdChecks = holds.map((m) => {
    const c = m.capacity as { per: string; max: string; where?: Record<string, string | boolean> };
    const tn = tableNames(m);
    const field = c.max.split(".")[1];
    const conditions = [
      `eq(${tn.table}.${c.per}Id, id)`,
      ...Object.entries(c.where ?? {}).map(
        ([k, v]) => `eq(${tn.table}.${k}, ${JSON.stringify(v)})`,
      ),
    ];
    return `
      if (values.${field} != null) {
        const booked = tx.select({ n: count() }).from(${tn.table}).where(and(${conditions.join(", ")})).get()?.n ?? 0;
        if (values.${field} < booked) throw new Conflict(\`booked:\${booked}\`);
      }`;
  });
  const ownerOf = signedIn ? `row.${owner}` : "undefined";
  const createValues = !signedIn
    ? "values"
    : model.ownedBy
      ? `{ ...values, ${owner}: ownerFor(viewer, values.${owner}) }`
      : `{ ...values, ownerId: viewer?.id ?? null }`;
  const self = n.data;
  const favorites = hasFavorites(model, ir, auth) ? `${n.table}Favorites` : undefined;
  const referenceChecks = refs.map(
    (ref) =>
      `  if (values.${ref.name}Id != null && !${names(modelNamed(ir, ref.type.model), t).data}.canRead(viewer, values.${ref.name}Id))
    throw new AccessDenied(viewer !== null);`,
  );
  const singles = model.fields.filter(isPicture).map(dataKey);
  const pictureLists = model.fields.filter(isPictures).map(dataKey);
  const pictures = [...singles, ...pictureLists];
  const selectOwner = `{ ${signedIn ? `${owner}: ${n.table}.${owner}` : `id: ${n.table}.id`}${pictures.map((k) => `, ${k}: ${n.table}.${k}`).join("")} }`;
  // A replaced or removed picture's file goes, unless a record still shows the same one in any of
  // the model's picture fields (files are named by their content, so they may be shared).
  const stillShown = (_k: string, file: string) =>
    `!!db.select({ id: ${n.table}.id }).from(${n.table}).where(sql\`${pictures.map((k) => `\${${n.table}.${k}} like \${\`%"file":"\${${file}}"%\`}`).join(" or ")}\`).get()`;
  const dropPictures = (after: (key: string) => string, afterList: (key: string) => string) =>
    [
      ...singles.map(
        (k) =>
          `    if (row.${k} && row.${k}.file !== ${after(k)}) deletePicture(row.${k}, ${stillShown(k, `row.${k}.file`)});\n`,
      ),
      // Of several pictures, each one no longer among them.
      ...pictureLists.map(
        (k) =>
          `    for (const p of row.${k} ?? []) if (!${afterList(k)}.includes(p.file)) deletePicture(p, ${stillShown(k, "p.file")});\n`,
      ),
    ].join("");
  return `${HEADER}import { ${drizzle.sort().join(", ")}, type SQL } from "drizzle-orm";
import { db } from "#/db";
import { ${[...new Set([n.table, ...(perTarget && typeof capacity?.max === "string" ? [perTarget] : []), ...holds.map((m) => tableNames(m).table), ...(favorites ? [favorites] : [])])].sort().join(", ")} } from "#/db/schema";
import { AccessDenied, check, ${capacity || holds.length ? "Conflict, " : ""}type ModelAccess, readScope, refusal, type Viewer } from "#/kit/access";
${referenced && titleColumn !== "id" ? `import { contains } from "#/kit/search";\n` : ""}${pictures.length ? 'import { deletePicture } from "#/kit/uploads";\n' : ""}import { afterChange, afterDelete } from "./hooks";
${[...others]
  .map((m) => `import { ${names(m, t).data} } from "./${kebab(m.name)}.server";`)
  .join("\n")}${others.size ? "\n" : ""}import type { ${n.values} } from "./${kebab(model.name)}";
${formulas ? `import { ${withFormulasName(model)} } from "./${kebab(model.name)}.formulas";\n` : ""}
/** Who may read, create, change and delete ${n.pluralLabel.toLowerCase()}. */
export const ${n.access}: ModelAccess = ${literal(access)};
${
  model.ownedBy && signedIn
    ? `
/**
 * Whose record it is: anyone's for a role that may change everyone's, otherwise the viewer's
 * own, whatever the form sent.
 */
function ownerFor(viewer: Viewer | null, given: string | null | undefined): string | null {
  if (viewer && ${n.access}.write.roles.includes(viewer.role)) return given ?? viewer.id;
  return viewer?.id ?? null;
}
`
    : ""
}${
  refs.length
    ? `
/** Checks that the viewer may read the records the values refer to. */
function checkReferences(viewer: Viewer | null, values: ${n.values}): void {
${referenceChecks.join("\n")}
}
`
    : ""
}
export const ${self} = {
  /** A condition for the ${n.pluralLabel.toLowerCase()} the viewer may read. */
  readable(viewer: Viewer | null) {
    const scope = readScope(${n.access}.read, viewer);
    if (scope === "all") return undefined;
${publicWhere ? `    if (scope === "public") return ${publicWhere};\n` : ""}    return ${ownOrPublic};
  },

  canRead(viewer: Viewer | null, id: number): boolean {
    const found = db
      .select({ id: ${n.table}.id })
      .from(${n.table})
      .where(and(eq(${n.table}.id, id), ${self}.readable(viewer)))
      .get();
    return found !== undefined;
  },
${
  favorites
    ? `
  /** The ${n.pluralLabel.toLowerCase()} the viewer saved, by id: their own marks, never anyone else's. */
  saved(viewer: Viewer | null): number[] {
    if (!viewer) return [];
    return db
      .select({ id: ${favorites}.recordId })
      .from(${favorites})
      .where(eq(${favorites}.userId, viewer.id))
      .all()
      .map((r) => r.id);
  },

  /** Saves a ${n.label.toLowerCase()} the viewer may read, or unsaves it; whether it is saved now. */
  toggleSaved(viewer: Viewer | null, id: number): boolean {
    if (!viewer || !${self}.canRead(viewer, id)) throw new AccessDenied(viewer !== null);
    const mark = and(eq(${favorites}.userId, viewer.id), eq(${favorites}.recordId, id));
    if (db.delete(${favorites}).where(mark).run().changes) return false;
    db.insert(${favorites}).values({ userId: viewer.id, recordId: id }).onConflictDoNothing().run();
    return true;
  },
`
    : ""
}
  /** The ${n.pluralLabel.toLowerCase()} the viewer may read; \`where\` narrows them, e.g. to a search${capped ? "; `limit` keeps the newest (a data page)" : ""}${ordered ? "; `order` sorts them before the newest-first rest" : ""}. */
  async list(viewer: Viewer | null, where?: SQL${capped ? ", limit?: number" : ""}${ordered ? ", order?: SQL" : ""}) {
    if (readScope(${n.access}.read, viewer) === "none") throw new AccessDenied(viewer !== null);
    const rows = await db.query.${n.table}.findMany({
      where: and(${self}.readable(viewer), where),${withClause(listWith, "      ")}
      orderBy: (t, { desc }) => [${ordered ? "...(order ? [order] : []), " : ""}desc(t.id)],${capped ? "\n      limit," : ""}
    });
    ${
      aggregatedLists(model).length
        ? `// The related records are here for the totals only: some may not be the viewer's to read.
    return rows.map((row) => {
      const { ${aggregatedLists(model).join(", ")}, ...listed } = ${compute("row")};
      return listed;
    });`
        : `return ${formulas ? `rows.map(${withFormulasName(model)})` : "rows"};`
    }
  },

${
  capped
    ? `  /** How many ${n.pluralLabel.toLowerCase()} the viewer may read, for a data page's overview; none to read: null. */
  count(viewer: Viewer | null): number | null {
    if (readScope(${n.access}.read, viewer) === "none") return null;
    return db.select({ n: count() }).from(${n.table}).where(${self}.readable(viewer)).get()?.n ?? 0;
  },

`
    : ""
}${
  capacity && signedIn
    ? `  /** How many of a ${capacity.per}'s places are taken, and how many it has: numbers only, never whose. */
  places(${capacity.per}Id: number): { taken: number; max: number } {
    const taken = db.select({ n: count() }).from(${n.table}).where(and(${capacityCounted.map((c) => c.replace(`values.${capacity.per}Id`, `${capacity.per}Id`)).join(", ")})).get()?.n ?? 0;
    return { taken, max: ${capacityMax.replaceAll("tx.", "db.").replace(`values.${capacity.per}Id`, `${capacity.per}Id`)} };
  },

  /** The viewer's own ${n.label.toLowerCase()} for a ${capacity.per}, if they have one. */
  mine(viewer: Viewer, ${capacity.per}Id: number): number | undefined {
    return db.select({ id: ${n.table}.id }).from(${n.table}).where(and(eq(${n.table}.${capacity.per}Id, ${capacity.per}Id), eq(${n.table}.${owner}, viewer.id))).get()?.id;
  },

`
    : ""
}  async get(viewer: Viewer | null, id: number) {
    const row = await db.query.${n.table}.findFirst({
      where: and(eq(${n.table}.id, id), ${self}.readable(viewer)),${withClause(getWith, "      ")}
    });
${
  hiddenTotals.length
    ? `    if (!row) return null;
    // Totals count every related record, as in lists; the related records shown are the viewer's.
    const all = await db.query.${n.table}.findFirst({ where: eq(${n.table}.id, id), with: { ${hiddenTotals.map((l) => `${l}: true`).join(", ")} } });
    return { ...${compute(`{ ...row, ${hiddenTotals.map((l) => `${l}: all?.${l} ?? []`).join(", ")} }`)}, ${hiddenTotals.map((l) => `${l}: row.${l}`).join(", ")} };`
    : `    return row ? ${compute("row")} : null;`
}
  },

  async create(viewer: Viewer | null, values: ${n.values}) {
    check(${n.access}.create, viewer);
${
  access.create.public
    ? `    // Visitors add these without an account: at most ${VISITOR_ROWS.toLocaleString("en")} of theirs, so a flood stops here.
    const made = db.select({ n: count() }).from(${n.table})${signedIn ? `.where(isNull(${n.table}.${owner}))` : ""}.get();
    if (viewer === null && (made?.n ?? 0) >= ${VISITOR_ROWS}) throw new AccessDenied(false);
`
    : ""
}${refs.length ? "    checkReferences(viewer, values);\n" : ""}    let row: typeof ${n.table}.$inferSelect;
    try {
      ${
        capacity
          ? `// The count and the insert in one transaction: two people cannot both take the last place.
      row = db.transaction((tx) => {${capacityCheck()}
        return tx.insert(${n.table}).values(${createValues}).returning().get();
      });`
          : `row = db.insert(${n.table}).values(${createValues}).returning().get();`
      }
    } catch (error) {
      throw ${capacity ? "error instanceof Conflict ? error : refusal(error)" : "refusal(error)"};
    }
    await afterChange("afterCreate", "${model.name}", row, viewer);
    return row;
  },

  async update(viewer: Viewer | null, id: number, values: ${n.values}) {
    const row = db
      .select(${selectOwner})
      .from(${n.table})
      .where(and(eq(${n.table}.id, id), ${self}.readable(viewer)))
      .get();
    if (!row) throw new AccessDenied(viewer !== null);
    check(${n.access}.write, viewer, ${ownerOf});
${refs.length ? "    checkReferences(viewer, values);\n" : ""}    let changed: typeof ${n.table}.$inferSelect;
    const updated = ${model.ownedBy && signedIn ? `{ ...values, ${owner}: ownerFor(viewer, values.${owner} ?? row.${owner}) }` : "values"};
    try {
      ${
        capacity || holds.length
          ? `changed = db.transaction((tx) => {${capacityCheck("id")}${holdChecks.join("")}
        return tx.update(${n.table}).set(updated).where(eq(${n.table}.id, id)).returning().get();
      });`
          : `changed = db.update(${n.table}).set(updated).where(eq(${n.table}.id, id)).returning().get();`
      }
    } catch (error) {
      throw ${capacity || holds.length ? "error instanceof Conflict ? error : refusal(error)" : "refusal(error)"};
    }
${dropPictures(
  (k) => `changed.${k}?.file`,
  (k) => `(changed.${k} ?? []).map((p) => p.file)`,
)}    await afterChange("afterUpdate", "${model.name}", changed, viewer);
    return changed;
  },

  async remove(viewer: Viewer | null, id: number): Promise<void> {
    const row = db
      .select(${selectOwner})
      .from(${n.table})
      .where(and(eq(${n.table}.id, id), ${self}.readable(viewer)))
      .get();
    if (!row) throw new AccessDenied(viewer !== null);
    check(${n.access}.delete, viewer, ${ownerOf});
    try {
      db.delete(${n.table}).where(eq(${n.table}.id, id)).run();
    } catch (error) {
      throw refusal(error);
    }
${dropPictures(
  () => "undefined",
  () => "([] as string[])",
)}    await afterDelete("${model.name}", id, viewer);
  },
${
  referenced
    ? `${
        titleColumn === "id"
          ? ""
          : `
  /**
   * The ${n.pluralLabel.toLowerCase()} the viewer may read whose ${titleColumn} contains the text: a search of records that
   * refer to them finds them only among these.
   */
  titled(viewer: Viewer | null, text: string): number[] {
    return db
      .select({ id: ${n.table}.id })
      .from(${n.table})
      .where(and(contains([${n.table}.${titleColumn}], text), ${self}.readable(viewer)))
      .all()
      .map((row) => row.id);
  },
`
      }
  /** Choices for fields that refer to a ${n.label.toLowerCase()}: the ones the viewer may read. */
  options(viewer: Viewer | null) {
    if (readScope(${n.access}.read, viewer) === "none") return [];
    return db
      .select({ value: ${n.table}.id, label: ${titleColumn === "id" ? `sql<string>\`'${n.label} #' || \${${n.table}.id}\`` : `${n.table}.${titleColumn}`} })
      .from(${n.table})
      .where(${self}.readable(viewer))
      .orderBy(${titleColumn === "id" ? `${n.table}.id` : `asc(${n.table}.${titleColumn})`})
      .all();
  },
`
    : ""
}};
`;
}

/** A field written as Markdown. */
export const isMarkdown = (f: FieldIR) => f.type.kind === "scalar" && f.type.name === "markdown";

export function fieldUi(model: ModelIR, field: FieldIR, t: Texts, ir: SpecIR, ux: UxIR) {
  const tones = ux.tones[`${model.name}.${field.name}`] ?? {};
  const isUser = field.type.kind === "relation" && field.type.model === USER_MODEL;
  const kind = isUser ? "user" : field.type.kind === "scalar" ? field.type.name : field.type.kind;
  const own = t.field(model, field);
  return {
    name: dataKey(field),
    label: own.label ?? humanize(field.name),
    kind,
    required: field.required,
    ...(field.formula ? { computed: true } : {}),
    ...(own.help ? { help: own.help } : {}),
    ...(field.type.kind === "choice"
      ? {
          choices: field.type.values.map((value) => ({
            value,
            label: own.values?.[value] ?? humanize(value),
            ...(tones[value] && tones[value] !== "neutral" ? { tone: tones[value] } : {}),
          })),
        }
      : {}),
    ...(field.type.kind === "relation"
      ? { relation: { key: field.name, titleField: relatedTitle(ir, field.type.model) } }
      : {}),
    ...(field.default !== undefined
      ? { default: kind === "money" ? Math.round(Number(field.default) * 100) : field.default }
      : {}),
    ...(field.min !== undefined && kind !== "string" && kind !== "text" ? { min: field.min } : {}),
    ...(field.max !== undefined && kind !== "string" && kind !== "text" ? { max: field.max } : {}),
    ...(kind === "markdown" ? { input: code("MarkdownEditor") } : {}),
    ...(kind === "picture"
      ? {
          input: code(
            `bindPicture(${JSON.stringify(kebab(model.name))}, ${JSON.stringify(field.name)})`,
          ),
        }
      : {}),
    ...(kind === "pictures"
      ? {
          input: code(
            `bindPictures(${JSON.stringify(kebab(model.name))}, ${JSON.stringify(field.name)}, ${field.max ?? PICTURES_MAX})`,
          ),
        }
      : {}),
  };
}

/** Records visitors may add to a model before it takes no more (see create in a data module). */
export const VISITOR_ROWS = 10_000;

/**
 * Longest texts by default, unless the spec gives a `max`: a line, and a longer text; shorter
 * where visitors write it (a contact form's message).
 */
export const TEXT_MAX = { string: 200, text: 10_000, markdown: 50_000, publicText: 2_000 };

/** A text's length rules: required (not only spaces), `min` and `max` characters. */
export function textBounds(field: FieldIR, visitors = false): string {
  const long = (max: number) => (visitors ? TEXT_MAX.publicText : max);
  const max =
    field.max ??
    (field.type.kind === "scalar" && field.type.name === "text"
      ? long(TEXT_MAX.text)
      : field.type.kind === "scalar" && field.type.name === "markdown"
        ? long(TEXT_MAX.markdown)
        : TEXT_MAX.string);
  const min = field.min ?? (field.required ? 1 : 0);
  return `${field.required ? ".trim()" : ""}${min > 0 ? `.min(${min}, ${JSON.stringify(min === 1 ? "Required" : `At least ${min} characters`)})` : ""}.max(${max}, "At most ${max.toLocaleString("en")} characters")`;
}

/** Zod refinements that go beyond the column types: formats, required text, bounds. */
export function refinement(field: FieldIR, visitors = false): string | undefined {
  const optional = field.required ? "" : ".nullish()";
  if (field.type.kind !== "scalar") return undefined;
  const bounds = (scale: number) =>
    `${field.min !== undefined ? `.min(${field.min * scale})` : ""}${field.max !== undefined ? `.max(${field.max * scale})` : ""}`;
  switch (field.type.name) {
    case "email":
      return `z.email("Enter a valid email address")${optional}`;
    case "url":
      return `z.url("Enter a valid web address")${optional}`;
    case "phone":
      return `(s) => s.regex(/^\\+?[0-9 ()-]{5,20}$/, "Enter a valid phone number")`;
    case "date":
      return `(s) => s.regex(/^\\d{4}-\\d{2}-\\d{2}$/, "Enter a valid date")`;
    case "string":
    case "text":
    case "markdown":
      return `(s) => s${textBounds(field, visitors)}`;
    case "int":
    case "decimal":
      return bounds(1) ? `(s) => s${bounds(1)}` : undefined;
    case "money":
      return bounds(100) ? `(s) => s${bounds(100)}` : undefined;
    case "picture":
      // What src/kit/uploads.ts returned, plus the description a person wrote.
      return `z.object({ file: z.string().max(100), alt: z.string().trim().max(200), width: z.int().positive(), height: z.int().positive() })${optional}`;
    case "pictures":
      // Several of them, at most the field's maximum.
      return `z.array(z.object({ file: z.string().max(100), alt: z.string().trim().max(200), width: z.int().positive(), height: z.int().positive() })).max(${field.max ?? PICTURES_MAX})${optional}`;
    default:
      return undefined;
  }
}
