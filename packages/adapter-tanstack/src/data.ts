// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import {
  type AuthIR,
  apiOffers,
  type Condition,
  defaultColumns,
  FILES_MAX,
  type FieldIR,
  humanize,
  isFile,
  isFiles,
  isPicture,
  isPictures,
  isUpload,
  kebab,
  type ModelIR,
  modelAccess,
  PICTURES_MAX,
  pascal,
  plural,
  type SpecIR,
  snake,
  storesFiles,
  storesPictures,
  USER_MODEL,
  type UxIR,
} from "@smithable/core";
import { hasSignIn } from "./auth.js";
import { aggregatedLists, defaultsName, hasFormulas, withFormulasName } from "./formulas.js";
import { hasKeys } from "./keys.js";
import { OUTGOING_IMPORT, toldAbout } from "./outgoing.js";
import {
  addable,
  code,
  dataKey,
  type GenContext,
  HEADER,
  hasFavorites,
  type importList,
  keyOf,
  lists,
  literal,
  modelNamed,
  names,
  ownerKey,
  references,
  relatedTitle,
  SCHEMA_IMPORT,
  shownFields,
  storedFields,
  type Texts,
  tableRef,
  titleField,
  userFields,
} from "./shared.js";

// ── Models: UI description, validation and server functions ─────────────────

/**
 * A table's default columns, at most five: the title, then pictures, then required fields, then
 * the rest, each in the spec's order; long texts never (a card shows the description instead).
 */
/** The list's columns when its page names none (core's defaultColumns, as Studio shows them). */
function columnsOf(model: ModelIR, shown: FieldIR[]): FieldIR[] {
  const names = defaultColumns(model);
  return names.map((name) => shown.find((f) => f.name === name)).filter((f): f is FieldIR => !!f);
}

/** The trash's server functions of a model: its list, restore and removal for good. */
export function trashNames(model: ModelIR) {
  const many = pascal(plural(model.name));
  return { list: `trashed${many}`, restore: `restore${many}`, erase: `erase${many}` };
}

/** The most records a trash view shows; the oldest are removed after thirty days anyway. */
const TRASH_SHOWN = 1000;

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
  const adds = addable(model, ir);
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
${SCHEMA_IMPORT}
import { allows, type Rule } from "#/kit/access";
import { w } from "#/kit/words";
import type { RecordUi } from "#/kit/model";
${model.fields.some(isMarkdown) ? 'import { MarkdownEditor, MarkdownText } from "#/kit/Markdown";\n' : ""}${model.fields.some(storesPictures) ? `import { ${[...(model.fields.some(isPicture) ? ["bindPicture"] : []), ...(model.fields.some(isPictures) ? ["bindPictures"] : [])].join(", ")} } from "#/kit/PictureInput";\n` : ""}${model.fields.some(storesFiles) ? `import { ${[...(model.fields.some(isFile) ? ["bindFile"] : []), ...(model.fields.some(isFiles) ? ["bindFiles"] : [])].join(", ")} } from "#/kit/FileInput";\n` : ""}${formulas ? `import { ${defaultsName(model)}, ${withFormulasName(model)} } from "./${kebab(model.name)}.formulas";\n` : ""}import { ${n.access}, ${n.data} } from "./${kebab(model.name)}.server";
${perModel && perModel !== model ? `import { ${perData} } from "./${kebab(perModel.name)}.server";\n` : ""}${[
  ...new Set(adds.map((a) => a.target)),
]
  .filter((m) => m !== model)
  .map((m) => `import { ${names(m, t).access} } from "./${kebab(m.name)}.server";\n`)
  .join("")}import { writeAllowed } from "#/kit/limit";
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

/** Who may delete ${n.pluralLabel.toLowerCase()}: a list's selection offers Delete by it (the server checks again). */
export const ${n.deleteRule}: Rule = ${literal(modelAccess(model, auth).delete)};

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
    const row = await ${n.data}.get(viewer, id);${
      model.trash
        ? `
    // In the trash: its page shows it read-only, with when, by whom and Restore.
    if (!row) {
      const gone = await ${n.data}.trashed(viewer, id);
      return gone && { row: gone.row, ${hasFavorites(model, ir, auth) ? "saved: false, " : ""}canWrite: false, canDelete: false,${adds.length ? ` canAdd: { ${adds.map((a) => `${a.list.name}: false`).join(", ")} },` : ""} trashed: { at: gone.deletedAt, by: gone.by, until: gone.until } };
    }`
        : ""
    }
    if (!row) return null;
    return {
      row,${model.trash ? "\n      trashed: null," : ""}${
        hasFavorites(model, ir, auth)
          ? `
      saved: ${n.data}.saved(viewer).includes(id),`
          : ""
      }
      canWrite: allows(${n.access}.write, viewer${hasSignIn(auth) ? `, row.${owner}` : ""}),
      canDelete: allows(${n.access}.delete, viewer${hasSignIn(auth) ? `, row.${owner}` : ""}),${
        adds.length
          ? `\n      // Who may add to its related lists from here ("Add line" on an invoice).\n      canAdd: { ${adds.map((a) => `${a.list.name}: allows(${names(a.target, t).access}.create, viewer)`).join(", ")} },`
          : ""
      }
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

/** Deletes the chosen ${n.pluralLabel.toLowerCase()}, all or none (at most 1,000 at once). */
export const ${n.removeMany} = createServerFn({ method: "POST" })
  .validator(z.array(z.number().int()).max(1000))
  .handler(async ({ data: ids }) => ${n.data}.removeMany(await writer(), ids));${
    model.trash
      ? `

/** The viewer's trash of ${n.pluralLabel.toLowerCase()} (docs/design/trash.md). */
export const ${trashNames(model).list} = createServerFn().handler(async () => {
  const viewer = await currentViewer();
  return { rows: await ${n.data}.trash(viewer) };
});

/** Takes the chosen ${n.pluralLabel.toLowerCase()} out of the trash. */
export const ${trashNames(model).restore} = createServerFn({ method: "POST" })
  .validator(z.array(z.number().int()).max(1000))
  .handler(async ({ data: ids }) => ${n.data}.restore(await writer(), ids));

/** Removes the chosen ${n.pluralLabel.toLowerCase()} in the trash for good. */
export const ${trashNames(model).erase} = createServerFn({ method: "POST" })
  .validator(z.array(z.number().int()).max(1000))
  .handler(async ({ data: ids }) => ${n.data}.removeForGood(await writer(), ids));`
      : ""
  }
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
  // A model the API offers is listed a page at a time, counted and sliced in the query.
  // Finding, counting and adding up: for a model the API offers, and for every model when the
  // app has "Ask" (docs/design/assistant.md §6), which reads what its person may read.
  const paged =
    (hasKeys(ir, auth) && apiOffers(auth, ir).models.includes(model.name)) ||
    Boolean(auth.assistant);
  // Records with an owner the app keeps itself (not a field of the spec): who owns one is told only
  // to its owner and to roles that read every record, never to a visitor or another member.
  const ownedAuto = signedIn && !model.ownedBy;
  // An ownedBy field that must be filled: whose record it is is always someone.
  const ownerField = model.fields.find((f) => f.name === model.ownedBy);
  const ownerRequired = Boolean(ownerField?.required);
  const ownerLabel = ownerField
    ? (t.field(model, ownerField).label ?? ownerField.name).toLowerCase()
    : "";
  // A record page's contact block mails the owner, whom only the server may know.
  const mailsOwner =
    ownedAuto &&
    ir.pages.some(
      (p) => p.contact?.to === "owner" && "model" in p.pattern && p.pattern.model === model.name,
    );
  // Related records shown on a record's page, each as its own model shows it to the viewer.
  const ownedLists = signedIn
    ? lists(model).filter((f) => !modelNamed(ir, f.type.model).ownedBy)
    : [];
  // What a program or an assistant may filter, search and sort these records by (assistant.md §3).
  const stored = model.fields.filter(
    (f) => !f.formula && !isUpload(f) && !(f.type.kind === "relation" && f.type.many),
  );
  const filterable = (paged ? stored : []).map((f) => {
    const column = `${n.table}.${dataKey(f)}`;
    if (f.type.kind === "choice")
      return `${f.name}: { kind: "choice", column: ${column}, values: ${JSON.stringify(f.type.values)} }`;
    if (f.type.kind === "relation") {
      const target = f.type.model;
      const table = target === USER_MODEL ? "schema.user" : tableRef(modelNamed(ir, target));
      // By its record's title when that is a stored field of it (a user's name).
      const title = relatedTitle(ir, target);
      const titled =
        target === USER_MODEL ||
        modelNamed(ir, target).fields.some((t) => t.name === title && !t.formula);
      const titleKey =
        target === USER_MODEL ? title : titled ? keyOf(modelNamed(ir, target), title) : "";
      return `${f.name}: { kind: "reference", column: ${column}${titled ? `, title: { table: ${table}, column: ${table}.${titleKey} }` : ""} }`;
    }
    const name = f.type.kind === "scalar" ? f.type.name : "string";
    const kind =
      name === "int" || name === "decimal"
        ? "number"
        : name === "money"
          ? "money"
          : name === "date"
            ? "date"
            : name === "datetime"
              ? "instant"
              : name === "bool"
                ? "bool"
                : "text";
    return `${f.name}: { kind: "${kind}", column: ${column} }`;
  });
  const searched = stored.filter(
    (f) =>
      f.type.kind === "scalar" &&
      ["string", "text", "markdown", "email", "phone", "url"].includes(f.type.name),
  );
  // A reference given by its record's title, resolved among the records the viewer may read
  // (where that model is offered too, so it has named()).
  const offeredModels = apiOffers(auth, ir).models;
  const namedRefs = (paged ? stored : []).flatMap((f) => {
    if (f.type.kind !== "relation" || f.type.model === USER_MODEL) return [];
    const target = modelNamed(ir, f.type.model);
    if (!offeredModels.includes(target.name) || titleField(target) === "id") return [];
    const data = target.name === model.name ? self : names(target, t).data;
    return [`${f.name}: (text: string) => ${data}.named(viewer, text)`];
  });
  const numeric = stored.filter(
    (f) => f.type.kind === "scalar" && ["int", "decimal", "money"].includes(f.type.name),
  );
  // Computed number fields (an invoice's total): worked out in the app, so added up there too.
  const computedNumbers = model.fields.filter(
    (f) =>
      f.formula && f.type.kind === "scalar" && ["int", "decimal", "money"].includes(f.type.name),
  );
  // A model with a list page: it is read a page at a time (docs/design/paging.md).
  const hasListPage = ir.pages.some(
    (p) => p.pattern.kind === "crud" && p.pattern.model === model.name,
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
  // A list of a model with a trash counts its live records only (docs/design/trash.md).
  const liveList = (list: string) => {
    const f = model.fields.find((x) => x.name === list);
    const target =
      f?.type.kind === "relation"
        ? ir.models.find((m) => m.name === (f.type as { model: string }).model)
        : undefined;
    return target?.trash
      ? `${list}: { where: (t, { isNull }) => isNull(t.deletedAt) }`
      : `${list}: true`;
  };
  const listWith = [...withReferences(model), ...aggregatedLists(model).map(liveList)];
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
  // A list's rows as the viewer gets them: formulas worked out, related records kept for the
  // totals left out. No local of its own: a model's table may have any name (items, for Item).
  const asListed = (rows: string, lead: string, tail = "") =>
    aggregatedLists(model).length
      ? `// The related records are here for the totals only: some may not be the viewer's to read.
    ${lead}${rows}.map((row) => {
      const { ${aggregatedLists(model).join(", ")}, ...listed } = ${compute("row")};
      return listed;
    })${tail};`
      : `${lead}${formulas ? `${rows}.map(${withFormulasName(model)})` : rows}${tail};`;
  const titleColumn = titleField(model);
  // The references measureBy can name its groups by: those whose model has a title.
  const titled = references(model)
    .map((f) => ({ f, target: modelNamed(ir, f.type.model) }))
    .map(({ f, target }) => ({ f, target, title: titleField(target) }))
    .filter(({ title }) => title !== "id");
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
  /** One `where` entry as SQL: equality, or `inArray` for a list of choice values. */
  const fits = (table: string, [k, v]: [string, string | boolean | string[]]) =>
    Array.isArray(v)
      ? `inArray(${table}.${k}, ${JSON.stringify(v)})`
      : `eq(${table}.${k}, ${JSON.stringify(v)})`;
  const listed = [
    ...Object.values(access.read.where ?? {}),
    ...Object.values(capacity?.where ?? {}),
    ...holds.flatMap((m) => Object.values(m.capacity?.where ?? {})),
  ].some(Array.isArray);
  const drizzle = [
    "and",
    "eq",
    "inArray",
    "sql",
    ...((referenced && titleColumn !== "id") || paged ? ["asc"] : []),
    ...(access.create.public || capped || paged || hasListPage || capacity || holds.length
      ? ["count"]
      : []),
    ...(access.create.public && signedIn ? ["isNull"] : []),
    ...(capacity ? ["ne"] : []),
    ...(access.read.where && signedIn && access.read.owner ? ["or"] : []),
    ...(paged ? ["avg", "desc", "isNotNull", "max", "min", "sum"] : []),
    ...(model.trash ? ["desc", "isNotNull", "isNull", "lt"] : []),
    ...(holds.some((m) => m.trash) ? ["isNull"] : []),
  ];
  // Visitors (and anyone reading only because it is public) read the records the public
  // condition fits; an owner reads their own too.
  const publicWhere = access.read.where
    ? `and(${Object.entries(access.read.where)
        .map((entry) => fits(n.table, entry))
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
        ...Object.entries(capacity.where ?? {}).map((entry) => fits(n.table, entry)),
        // What is in the trash holds no place.
        ...(model.trash ? [`isNull(${n.table}.deletedAt)`] : []),
      ]
    : [];
  const perField = capacity && model.fields.find((f) => f.name === capacity.per);
  const perTarget =
    perField?.type.kind === "relation" ? tableRef(modelNamed(ir, perField.type.model)) : "";
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
    const c = m.capacity as { per: string; max: string; where?: Condition };
    const tn = { table: tableRef(m) };
    const field = c.max.split(".")[1];
    const conditions = [
      `eq(${tn.table}.${c.per}Id, id)`,
      ...Object.entries(c.where ?? {}).map((entry) => fits(tn.table, entry)),
      ...(m.trash ? [`isNull(${tn.table}.deletedAt)`] : []),
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
      : `{ ...values, ownerId: personOf(viewer) }`;
  const self = n.data;
  // The record's title as the audit log keeps it, and a create with its line.
  const titleKey = titleField(model);
  // Worked out, never entered: not a change of their own in the audit log.
  const computedKeys = model.fields.filter((f) => f.formula).map((f) => f.name);
  // Who is told of a change (outgoing mail, integrations.md §4.1b), in its transaction.
  const mails = toldAbout(ir, model.name);
  const tell = (what: string, record: string, before = "") =>
    mails
      ? `\n        outgoing(tx, viewer, "${model.name}", ${what}, ${record}${before && `, ${before}`});`
      : "";
  const insertAudited = `const made = tx.insert(${n.table}).values(${createValues}).returning().get();
        audit(tx, viewer, { action: "created", model: "${model.name}", record: made.id });${tell('"created"', "made")}
        return made;`;
  const favorites = hasFavorites(model, ir, auth) ? `${n.table}Favorites` : undefined;
  // The trash (docs/design/trash.md): a delete moves the record there; what still refers to it
  // with a required reference keeps it out, as it keeps a delete out today.
  const trashing = Boolean(model.trash);
  const holders = trashing
    ? ir.models.flatMap((m) =>
        m.fields
          .filter(
            (f) =>
              f.type.kind === "relation" &&
              !f.type.many &&
              f.type.model === model.name &&
              f.required,
          )
          .map((f) => ({ table: tableRef(m), column: `${f.name}Id` })),
      )
    : [];
  const inUse = (id: string, indent: string) =>
    holders
      .map(
        (h) =>
          `${indent}if (tx.select({ id: ${h.table}.id }).from(${h.table}).where(eq(${h.table}.${h.column}, ${id})).limit(1).get()) throw new Conflict("in-use");\n`,
      )
      .join("");
  const goneBy = (id: string) =>
    trashing
      ? `tx.update(${n.table}).set({ deletedAt: new Date(), deletedBy: personOf(viewer) }).where(and(eq(${n.table}.id, ${id}), isNull(${n.table}.deletedAt))).returning().get()`
      : `tx.delete(${n.table}).where(eq(${n.table}.id, ${id})).returning().get()`;
  const goneAction = trashing ? "trashed" : "deleted";
  const trashedRows = `and(isNotNull(${n.table}.deletedAt), ${self}.scoped(viewer))`;
  const allowed = `.filter((row) => allows(${n.access}.delete, viewer, ${ownerOf}))`;
  const named = signedIn
    ? `
    const ids = [...new Set(rows.map((row) => row.deletedBy).filter((id): id is string => Boolean(id)))];
    const people = new Map(
      db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, ids)).all().map((p) => [p.id, p.name]),
    );`
    : "";
  const byName = signedIn ? "(row.deletedBy && people.get(row.deletedBy)) ?? null" : "null";
  const trashFunctions = () => `

  /**
   * The viewer's trash (docs/design/trash.md): the ${n.pluralLabel.toLowerCase()} in it they may delete, the
   * latest first, with when and by whom, kept for thirty days.
   */
  async trash(viewer: Viewer | null) {
    const rows = (
      await db.query.${n.tableKey}.findMany({
        where: ${trashedRows},${withClause(listWith, "        ")}
        orderBy: (t) => [desc(t.deletedAt)],
        limit: ${TRASH_SHOWN},
      })
    )${allowed};${named}
    ${asListed(`rows.map((row) => ({ ...${ownedAuto ? "shownTo(viewer, row)" : "row"}, deletedByName: ${byName} }))`, "return ")}
  },

  /** A ${n.label.toLowerCase()} in the trash, as its page shows it read-only, with when and by whom; else nothing. */
  async trashed(viewer: Viewer | null, id: number) {
    const row = await db.query.${n.tableKey}.findFirst({
      where: and(eq(${n.table}.id, id), ${trashedRows}),${withClause(getWith, "      ")}
    });
    if (!row || !allows(${n.access}.delete, viewer, ${ownerOf})) return null;
    const rows = [row];${named.replace(/\n {4}/g, "\n    ")}
    return {
      row: ${compute(ownedAuto ? "shownTo(viewer, row)" : "row")},
      deletedAt: row.deletedAt as Date,
      by: ${byName},
      until: new Date((row.deletedAt as Date).getTime() + TRASH_DAYS * DAY),
    };
  },

  /** Takes the chosen ${n.pluralLabel.toLowerCase()} out of the trash, those the viewer may delete. */
  restore(viewer: Viewer | null, ids: number[]): { restored: number; skipped: number } {
    const rows = db
      .select(${selectOwner.replace("{ ", `{ id: ${n.table}.id, `)})
      .from(${n.table})
      .where(and(inArray(${n.table}.id, ids), ${trashedRows}))
      .all()${allowed};
    // A unique value a live record has taken since refuses it, as it refuses a new record.
    try {
      db.transaction((tx) => {
        for (const row of rows) {
          const back = tx.update(${n.table}).set({ deletedAt: null, deletedBy: null }).where(eq(${n.table}.id, row.id)).returning().get();
          audit(tx, viewer, { action: "restored", model: "${model.name}", record: row.id, title: back.${titleKey} });
        }
      });
    } catch (error) {
      throw refusal(error);
    }
    return { restored: rows.length, skipped: new Set(ids).size - rows.length };
  },

  /** Removes the chosen ${n.pluralLabel.toLowerCase()} in the trash for good, with their pictures and documents. */
  removeForGood(viewer: Viewer | null, ids: number[]): { deleted: number; skipped: number } {
    const rows = db
      .select(${selectOwner.replace("{ ", `{ id: ${n.table}.id, `)})
      .from(${n.table})
      .where(and(inArray(${n.table}.id, ids), ${trashedRows}))
      .all()${allowed};
    ${self}.erase(viewer, rows.map((row) => row.id));
    return { deleted: rows.length, skipped: new Set(ids).size - rows.length };
  },

  /** Deletes trashed records for good (Delete permanently, Empty trash, the daily job). */
  erase(viewer: Viewer | null, ids: number[]): void {
    if (ids.length === 0) return;
    const rows = db
      .select(${selectOwner.replace("{ ", `{ id: ${n.table}.id, `)})
      .from(${n.table})
      .where(and(inArray(${n.table}.id, ids), isNotNull(${n.table}.deletedAt)))
      .all();
    try {
      db.transaction((tx) => {
        for (const row of rows) {
          const gone = tx.delete(${n.table}).where(eq(${n.table}.id, row.id)).returning().get();
          if (gone) audit(tx, viewer, { action: "removed", model: "${model.name}", record: row.id, title: gone.${titleKey} });
        }
      });
    } catch (error) {
      throw refusal(error);
    }
${
  pictures.length
    ? `    for (const row of rows) {
${dropPictures(
  () => "undefined",
  () => "([] as string[])",
).replace(/^ {4}/gm, "      ")}    }
`
    : ""
}  },

  /** What has been in the trash for thirty days goes for good (once a day). */
  purge(now = Date.now()): number {
    const old = db
      .select({ id: ${n.table}.id })
      .from(${n.table})
      .where(lt(${n.table}.deletedAt, new Date(now - TRASH_DAYS * DAY)))
      .all()
      .map((row) => row.id);
    ${self}.erase(null, old);
    return old.length;
  },`;
  const referenceChecks = refs.map(
    (ref) =>
      `  if (values.${ref.name}Id != null && !${names(modelNamed(ir, ref.type.model), t).data}.canRead(viewer, values.${ref.name}Id))
    throw new AccessDenied(viewer !== null);`,
  );
  const singles = model.fields.filter(isPicture).map(dataKey);
  const pictureLists = model.fields.filter(isPictures).map(dataKey);
  const docSingles = model.fields.filter(isFile).map(dataKey);
  const docLists = model.fields.filter(isFiles).map(dataKey);
  // Every stored upload, pictures and documents: selected with the owner, looked for when one goes.
  const pictures = [...singles, ...pictureLists, ...docSingles, ...docLists];
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
      // Documents the same way.
      ...docSingles.map(
        (k) =>
          `    if (row.${k} && row.${k}.file !== ${after(k)}) deleteFile(row.${k}, ${stillShown(k, `row.${k}.file`)});\n`,
      ),
      ...docLists.map(
        (k) =>
          `    for (const p of row.${k} ?? []) if (!${afterList(k)}.includes(p.file)) deleteFile(p, ${stillShown(k, "p.file")});\n`,
      ),
    ].join("");
  return `${HEADER}import { ${paged ? "type AnyColumn, " : ""}${[...new Set(drizzle)].sort().join(", ")}, type SQL } from "drizzle-orm";
import { db } from "#/db";
${SCHEMA_IMPORT}
import { AccessDenied, allows, check, Conflict, type ModelAccess, personOf, readScope, type Viewer } from "#/kit/access";
import { audit, changedFields } from "#/kit/audit.server";
import { ${trashing ? "log, " : ""}refusal } from "#/kit/log.server";
${mails ? `${OUTGOING_IMPORT}\n` : ""}${((referenced || paged) && titleColumn !== "id") || (paged && searched.length) ? `import { contains } from "#/kit/search";\n` : ""}${paged ? 'import { BadInput } from "#/kit/refusal";\nimport { aggregate, type Filterable, sortOf, whereOf, wordsOf } from "#/kit/where";\n' : ""}${pictures.length ? `import { ${[...(singles.length || pictureLists.length ? ["deletePicture"] : []), ...(docSingles.length || docLists.length ? ["deleteFile"] : [])].join(", ")} } from "#/kit/uploads";\n` : ""}import { afterChange, afterDelete } from "./hooks";
${[...others]
  .map((m) => `import { ${names(m, t).data} } from "./${kebab(m.name)}.server";`)
  .join("\n")}${others.size ? "\n" : ""}import type { ${n.values} } from "./${kebab(model.name)}";
${formulas ? `import { ${withFormulasName(model)} } from "./${kebab(model.name)}.formulas";\n` : ""}
/** Who may read, create, change and delete ${n.pluralLabel.toLowerCase()}. */
export const ${n.access}: ModelAccess = ${literal(access)};
${
  ownedAuto
    ? `
/** A record as the viewer gets it: who owns it only for its owner and roles that read every record. */
function shownTo<R extends { ownerId: string | null }>(viewer: Viewer | null, row: R): R {
  if (viewer && (row.ownerId === viewer.id || ${n.access}.read.roles.includes(viewer.role))) return row;
  return { ...row, ownerId: null };
}
`
    : ""
}
${
  paged
    ? `
/** What \`where\` may name, and how: the stored fields, by kind. */
const FILTERABLE: Record<string, Filterable> = {
${filterable.map((f) => `  ${f},`).join("\n")}
};

/** What the records can be sorted by. */
const SORTABLE = { ${["id", ...stored.filter((f) => f.type.kind !== "relation").map((f) => f.name), "createdAt"].map((k) => `${k}: ${n.table}.${k}`).join(", ")} };

/** The number fields \`measure\` adds up; amounts are stored in cents. */
const NUMBERS: Record<string, AnyColumn> = { ${numeric.map((f) => `${f.name}: ${n.table}.${f.name}`).join(", ")} };
const MONEY: string[] = ${JSON.stringify([...numeric, ...computedNumbers].filter((f) => f.type.kind === "scalar" && f.type.name === "money").map((f) => f.name))};

/** Computed number fields \`measure\` adds up from the records themselves. */
const COMPUTED: string[] = ${JSON.stringify(computedNumbers.map((f) => f.name))};

/** The titles of the referenced records \`measureBy\` splits by, to name its groups. */
function titlesOf(${titled.length ? "by" : "_by"}: string, ${titled.length ? "ids" : "_ids"}: number[]): Map<unknown, string> {
  switch (${titled.length ? "by" : "_by"}) {${titled
    .map(
      ({ target, f, title }) => `
    case "${f.name}":
      return new Map(db.select({ id: ${tableRef(target)}.id, title: ${tableRef(target)}.${title} }).from(${tableRef(target)}).where(inArray(${tableRef(target)}.id, ids)).all().map((r) => [r.id, String(r.title)]));`,
    )
    .join("")}
    default:
      return new Map();
  }
}

/** What \`measureBy\` may split by: choices, yes/no, references, and dates by month. */
const BY: string[] = ${JSON.stringify(stored.filter((f) => f.type.kind === "choice" || f.type.kind === "relation" || (f.type.kind === "scalar" && ["bool", "date", "datetime"].includes(f.type.name))).map((f) => f.name))};
`
    : ""
}
${
  model.ownedBy && signedIn
    ? `
/**
 * Whose record it is: anyone's for a role that may change everyone's, otherwise the viewer's
 * own, whatever the form sent.
 */
${
  ownerRequired
    ? `function ownerFor(viewer: Viewer | null, given: string | null | undefined): string {
  const owner = viewer && ${n.access}.write.roles.includes(viewer.role) ? (given ?? personOf(viewer)) : personOf(viewer);
  // The record must have one: a visitor or a key, who is no person, cannot be it.
  if (!owner)
    throw new AccessDenied(viewer !== null, viewer ? "A key owns nothing: name the ${ownerLabel} (${model.ownedBy})." : undefined);
  return owner;
}`
    : `function ownerFor(viewer: Viewer | null, given: string | null | undefined): string | null {
  if (viewer && ${n.access}.write.roles.includes(viewer.role)) return given ?? personOf(viewer);
  return personOf(viewer);
}`
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
${
  trashing
    ? `/** How long a record stays in the trash, and the most a trash view shows. */
const TRASH_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;
`
    : ""
}export const ${self} = {${ownedAuto ? "\n  shownTo," : ""}
  /** A condition for the ${n.pluralLabel.toLowerCase()} the viewer may read. */
  readable(viewer: Viewer | null) {${
    model.trash
      ? `
    // What is in the trash is gone to every reader (docs/design/trash.md).
    return and(isNull(${n.table}.deletedAt), ${self}.scoped(viewer));
  },

  /** The records the viewer may read by the read rule, the trashed ones too. */
  scoped(viewer: Viewer | null) {`
      : ""
  }
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
    const ${ownedAuto ? "found" : "rows"} = await db.query.${n.tableKey}.findMany({
      where: and(${self}.readable(viewer), where),${withClause(listWith, "      ")}
      orderBy: (t, { desc }) => [${ordered ? "...(order ? [order] : []), " : ""}desc(t.id)],${capped ? "\n      limit," : ""}
    });${ownedAuto ? "\n    const rows = found.map((row) => shownTo(viewer, row));" : ""}
    ${asListed("rows", "return ")}
  },
${
  hasListPage
    ? `
  /**
   * A page of the ${n.pluralLabel.toLowerCase()} the viewer may read that fit \`where\`, newest first (or in
   * \`order\`), and how many fit in all: for a list page. A page past the end is the last one.
   */
  async page(viewer: Viewer | null, where?: SQL, order?: SQL, page = 1, size = 50) {
    if (readScope(${n.access}.read, viewer) === "none") throw new AccessDenied(viewer !== null);
    const condition = and(${self}.readable(viewer), where);
    const total = db.select({ n: count() }).from(${n.table}).where(condition).get()?.n ?? 0;
    const at = Math.min(Math.max(1, Math.trunc(page)), Math.max(1, Math.ceil(total / size)));
    const ${ownedAuto ? "found" : "rows"} = await db.query.${n.tableKey}.findMany({
      where: condition,${withClause(listWith, "      ")}
      orderBy: (t, { desc }) => [...(order ? [order] : []), desc(t.id)],
      limit: size,
      offset: (at - 1) * size,
    });${ownedAuto ? "\n    const rows = found.map((row) => shownTo(viewer, row));" : ""}
    ${asListed("rows", "return { rows: ", ", total, page: at, size }")}
  },
`
    : ""
}${
  paged
    ? `
  /**
   * The ${n.pluralLabel.toLowerCase()} the viewer may read that fit \`where\` and \`search\`, in \`sort\`'s order (else newest
   * first), a page of them and how many there are: for the API and the assistants' tools.
   */
  async find(
    viewer: Viewer | null,
    options: { where?: unknown; search?: string; sort?: string; limit?: number; offset?: number } = {},
  ) {
    if (readScope(${n.access}.read, viewer) === "none") throw new AccessDenied(viewer !== null);
    const condition = ${self}.fitting(viewer, options.where, options.search);
    const order = sortOf(SORTABLE, options.sort);
    const total = db.select({ n: count() }).from(${n.table}).where(condition).get()?.n ?? 0;
    const ${ownedAuto ? "found" : "rows"} = await db.query.${n.tableKey}.findMany({
      where: condition,${withClause(listWith, "      ")}
      orderBy: (t, { desc }) => [...(order ? [order] : []), desc(t.id)],
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
    });${ownedAuto ? "\n    const rows = found.map((row) => shownTo(viewer, row));" : ""}
    ${asListed("rows", "return { items: ", ", total }")}
  },

  /**
   * A number from the ${n.pluralLabel.toLowerCase()} the viewer may read that fit \`where\`: how many, or the sum,
   * average, smallest or largest of a number field.
   */
  async measure(
    viewer: Viewer | null,
    how: "count" | "sum" | "average" | "smallest" | "largest",
    options: { field?: string; where?: unknown; search?: string } = {},
  ): Promise<number | null> {
    if (readScope(${n.access}.read, viewer) === "none") throw new AccessDenied(viewer !== null);
    const condition = ${self}.fitting(viewer, options.where, options.search);
    if (how === "count")
      return db.select({ n: count() }).from(${n.table}).where(condition).get()?.n ?? 0;
    const field = options.field ?? "";
    const money = MONEY.includes(field);
    if (COMPUTED.includes(field)) {
      const rows = await ${self}.computedRows(condition);
      const value = aggregate(rows.map((row) => row[field]), how);
      return value === null ? null : money ? value / 100 : value;
    }
    const column = NUMBERS[field];
    if (!column)
      throw new BadInput(
        \`\${how} needs a number field: \${[...Object.keys(NUMBERS), ...COMPUTED].join(", ") || "there are none"}.\`,
      );
    const pick = { sum, average: avg, smallest: min, largest: max }[how];
    const value = db.select({ v: pick(column) }).from(${n.table}).where(condition).get()?.v;
    if (value === null || value === undefined) return null;
    return money ? Number(value) / 100 : Number(value);
  },

  /** Which record holds the smallest or largest value of a number field (the first of a tie). */
  async holder(
    viewer: Viewer | null,
    how: "smallest" | "largest",
    options: { field?: string; where?: unknown; search?: string } = {},
  ): Promise<{ id: number; title: string } | null> {
    const condition = ${self}.fitting(viewer, options.where, options.search);
    const field = options.field ?? "";
    if (COMPUTED.includes(field)) {
      let best: Record<string, unknown> | undefined;
      for (const row of await ${self}.computedRows(condition)) {
        const v = row[field];
        if (typeof v !== "number") continue;
        if (!best || (how === "largest" ? v > (best[field] as number) : v < (best[field] as number))) best = row;
      }
      return best ? { id: best.id as number, title: String(best.${titleColumn}) } : null;
    }
    const column = NUMBERS[field];
    if (!column) return null;
    const row = db
      .select({ id: ${n.table}.id, title: ${n.table}.${titleColumn} })
      .from(${n.table})
      .where(and(condition, isNotNull(column)))
      .orderBy(how === "largest" ? desc(column) : asc(column), asc(${n.table}.id))
      .limit(1)
      .get();
    return row ? { id: row.id, title: String(row.title) } : null;
  },

  /**
   * The same number per value of a field (a choice, yes/no, a reference) or per month of a date:
   * \`[{ value, number }]\`, the most first.
   */
  async measureBy(
    viewer: Viewer | null,
    how: "count" | "sum" | "average" | "smallest" | "largest",
    by: string,
    options: { field?: string; where?: unknown; search?: string } = {},
  ): Promise<{ value: unknown; title?: string; number: number | null }[]> {
    if (readScope(${n.access}.read, viewer) === "none") throw new AccessDenied(viewer !== null);
    const split = FILTERABLE[by];
    if (!split || split.kind === "text" || split.kind === "number" || split.kind === "money")
      throw new BadInput(\`There is no field "\${by}" to split by. Fields: \${BY.join(", ")}.\`);
    const field = options.field ?? "";
    const money = MONEY.includes(field);
    const condition = ${self}.fitting(viewer, options.where, options.search);
    const amount = (n: number | null) => (n === null ? null : money ? n / 100 : n);
    const most = (a: { number: number | null }, b: { number: number | null }) => (b.number ?? 0) - (a.number ?? 0);
    // A reference's groups carry the referenced record's title beside its id.
    const named = (rows: { value: unknown; number: number | null }[]) => {
      if (split.kind !== "reference") return rows;
      const titles = titlesOf(by, rows.map((r) => r.value).filter((v): v is number => typeof v === "number"));
      return rows.map((r) => (titles.has(r.value) ? { value: r.value, title: titles.get(r.value), number: r.number } : r));
    };
    if (COMPUTED.includes(field)) {
      // Each record's month or value, then the computed numbers added up per group.
      const groups = new Map<unknown, unknown[]>();
      for (const row of await ${self}.computedRows(condition)) {
        const raw = row[split.kind === "reference" ? \`\${by}Id\` : by];
        const value = split.kind === "date" ? String(raw ?? "").slice(0, 7) || null : split.kind === "instant" ? (raw instanceof Date ? raw.toISOString().slice(0, 7) : null) : raw;
        groups.set(value, [...(groups.get(value) ?? []), row[field]]);
      }
      return named([...groups].map(([value, numbers]) => ({ value, number: amount(aggregate(numbers, how)) })).sort(most));
    }
    const key = split.kind === "date" ? sql<string>\`substr(\${split.column}, 1, 7)\` : split.kind === "instant" ? sql<string>\`strftime('%Y-%m', \${split.column} / 1000, 'unixepoch')\` : sql\`\${split.column}\`;
    const column = NUMBERS[field];
    if (how !== "count" && !column)
      throw new BadInput(\`\${how} needs a number field: \${[...Object.keys(NUMBERS), ...COMPUTED].join(", ") || "there are none"}.\`);
    const pick = how === "count" || !column ? count() : { sum, average: avg, smallest: min, largest: max }[how](column);
    return named(
      db
        .select({ value: key, number: pick })
        .from(${n.table})
        .where(condition)
        .groupBy(key)
        .all()
        .map((r) => ({ value: r.value, number: r.number === null ? null : amount(Number(r.number)) }))
        .sort(most),
    );
  },

  /**
   * The records that fit, with their computed fields worked out: for adding those up. At most
   * ${COMPUTED_ROWS.toLocaleString("en")}, so one call never reads a whole large table; more are refused with how to narrow them.
   */
  async computedRows(condition: SQL | undefined): Promise<Record<string, unknown>[]> {
    const rows = await db.query.${n.tableKey}.findMany({ where: condition,${withClause(listWith, " ").replace(/\n/g, "")} limit: ${COMPUTED_ROWS + 1} });
    if (rows.length > ${COMPUTED_ROWS})
      throw new BadInput("More than ${COMPUTED_ROWS.toLocaleString("en")} records to add up a computed field over: narrow them with where.");
    return rows.map((row) => ${formulas ? `${withFormulasName(model)}(row as never)` : "row"} as Record<string, unknown>);
  },

${
  titleColumn !== "id"
    ? `  /** The ${n.pluralLabel.toLowerCase()} the viewer may read whose ${titleColumn} has the text: a few, for naming one. */
  named(viewer: Viewer | null, text: string): { id: number; title: string }[] {
    return db
      .select({ id: ${n.table}.id, title: ${n.table}.${titleColumn} })
      .from(${n.table})
      .where(and(${self}.readable(viewer), contains([${n.table}.${titleColumn}], text)))
      .limit(6)
      .all()
      .map((row) => ({ id: row.id, title: String(row.title) }));
  },

`
    : ""
}  /** The condition for records the viewer may read that fit \`where\` and \`search\`. */
  fitting(viewer: Viewer | null, where?: unknown, search?: string) {
    return and(
      ${self}.readable(viewer),
      whereOf(FILTERABLE, where, ${signedIn ? `viewer ? eq(${n.table}.${owner}, viewer.id) : undefined, viewer?.id` : "undefined, undefined"}, {${namedRefs.join(", ")}}),
      // Every word somewhere in the texts ("ship lamp" finds "ship's lamp").
      ...wordsOf(search).map(${searched.length ? `(word) => contains([${searched.map((f) => `${n.table}.${f.name}`).join(", ")}], word)` : "() => sql`false`"}),
    );
  },
`
    : ""
}
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
    return db.select({ id: ${n.table}.id }).from(${n.table}).where(and(eq(${n.table}.${capacity.per}Id, ${capacity.per}Id), eq(${n.table}.${owner}, viewer.id)${model.trash ? `, isNull(${n.table}.deletedAt)` : ""})).get()?.id;
  },

`
    : ""
}  async get(viewer: Viewer | null, id: number) {
    const ${ownedAuto || ownedLists.length ? "found" : "row"} = await db.query.${n.tableKey}.findFirst({
      where: and(eq(${n.table}.id, id), ${self}.readable(viewer)),${withClause(getWith, "      ")}
    });${
      !ownedLists.length
        ? ownedAuto
          ? "\n    const row = found && shownTo(viewer, found);"
          : ""
        : `\n    const row = found && { ...${ownedAuto ? "shownTo(viewer, found)" : "found"}${ownedLists
            .map(
              (f) =>
                `, ${f.name}: found.${f.name}.map((r) => ${names(modelNamed(ir, f.type.model), t).data}.shownTo(viewer, r))`,
            )
            .join("")} };`
    }
${
  hiddenTotals.length
    ? `    if (!row) return null;
    // Totals count every related record, as in lists; the related records shown are the viewer's.
    const all = await db.query.${n.tableKey}.findFirst({ where: eq(${n.table}.id, id), with: { ${hiddenTotals.map(liveList).join(", ")} } });
    return { ...${compute(`{ ...row, ${hiddenTotals.map((l) => `${l}: all?.${l} ?? []`).join(", ")} }`)}, ${hiddenTotals.map((l) => `${l}: row.${l}`).join(", ")} };`
    : `    return row ? ${compute("row")} : null;`
}
  },

${
  mailsOwner
    ? `  /** Who owns a ${n.label.toLowerCase()} the viewer may read, for the server only (a message to its owner). */
  ownerOf(viewer: Viewer | null, id: number): string | null {
    return (
      db
        .select({ ownerId: ${n.table}.ownerId })
        .from(${n.table})
        .where(and(eq(${n.table}.id, id), ${self}.readable(viewer)))
        .get()?.ownerId ?? null
    );
  },

`
    : ""
}  async create(viewer: Viewer | null, values: ${n.values}) {
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
        ${insertAudited}
      });`
          : `row = db.transaction((tx) => {
        ${insertAudited}
      });`
      }
    } catch (error) {
      throw ${capacity ? "error instanceof Conflict ? error : " : ""}refusal(error);
    }
    await afterChange("afterCreate", "${model.name}", row, viewer);
    return row;
  },

  /** Changes the record; \`what\` names the change in the audit log (an action's name). */
  async update(viewer: Viewer | null, id: number, values: ${n.values}, what = "changed") {
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
      changed = db.transaction((tx) => {${capacity || holds.length ? `${capacityCheck("id")}${holdChecks.join("")}` : ""}
        const before = tx.select().from(${n.table}).where(eq(${n.table}.id, id)).get();
        const after = tx.update(${n.table}).set(updated).where(eq(${n.table}.id, id)).returning().get();
        audit(tx, viewer, { action: what, model: "${model.name}", record: id, fields: before && changedFields(before, after, Object.keys(updated)${computedKeys.length ? `.filter((k) => !${literal(computedKeys)}.includes(k))` : ""}) });${tell("what", "after", "before")}
        return after;
      });
    } catch (error) {
      throw ${capacity || holds.length ? "error instanceof Conflict ? error : " : ""}refusal(error);
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
      db.transaction((tx) => {
${inUse("id", "        ")}        const gone = ${goneBy("id")};
        if (gone) {
          audit(tx, viewer, { action: "${goneAction}", model: "${model.name}", record: id, title: gone.${titleKey} });${tell('"deleted"', "gone").replace("\n        ", "\n          ")}
        }
      });
    } catch (error) {
      throw refusal(error);
    }
${
  trashing
    ? ""
    : dropPictures(
        () => "undefined",
        () => "([] as string[])",
      )
}    await afterDelete("${model.name}", id, viewer);
  },

  /**
   * Deletes the chosen records the viewer may delete, all or none (one still in use stops them
   * all, and is named); the others are skipped.
   */
  async removeMany(viewer: Viewer | null, ids: number[]): Promise<{ deleted: number; skipped: number }> {
    const rows = db
      .select(${signedIn ? selectOwner.replace("{ ", `{ id: ${n.table}.id, `) : selectOwner})
      .from(${n.table})
      .where(and(inArray(${n.table}.id, ids), ${self}.readable(viewer)))
      .all()
      .filter((row) => allows(${n.access}.delete, viewer, ${ownerOf}));
    db.transaction((tx) => {
      for (const row of rows)
        try {
${inUse("row.id", "          ")}          const gone = ${goneBy("row.id")};
          if (gone) {
            audit(tx, viewer, { action: "${goneAction}", model: "${model.name}", record: row.id, title: gone.${titleKey} });${tell('"deleted"', "gone").replace("\n        ", "\n            ")}
          }
        } catch (error) {
          const refused = refusal(error);
          throw refused instanceof Conflict ? new Conflict(\`\${refused.message}:\${row.id}\`) : refused;
        }
    });
    for (const row of rows) {
${
  trashing
    ? ""
    : dropPictures(
        () => "undefined",
        () => "([] as string[])",
      ).replace(/^ {4}/gm, "      ")
}      await afterDelete("${model.name}", row.id, viewer);
    }
    return { deleted: rows.length, skipped: new Set(ids).size - rows.length };
  },${trashing ? trashFunctions() : ""}
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
      .select({ value: ${n.table}.id, label: ${
        titleColumn === "id"
          ? `sql<string>\`'${n.label} #' || \${${n.table}.id}\``
          : model.fields.find((f) => f.name === titleColumn)?.required
            ? `${n.table}.${titleColumn}`
            : // An optional title: the record's number where it is empty, so every choice has a name.
              `sql<string>\`coalesce(\${${n.table}.${titleColumn}}, '${n.label} #' || \${${n.table}.id})\``
      } })
      .from(${n.table})
      .where(${self}.readable(viewer))
      .orderBy(${titleColumn === "id" ? `${n.table}.id` : `asc(${n.table}.${titleColumn})`})
      .all();
  },
`
    : ""
}};
${
  trashing
    ? `
// Once a day, a minute after the server starts and then every day, in production.
if (import.meta.env.SSR && import.meta.env.PROD) {
  const purge = () => {
    try {
      ${self}.purge();
    } catch (error) {
      log.error("The trash could not be emptied", { model: "${model.name}", error });
    }
  };
  setTimeout(purge, 60_000).unref();
  setInterval(purge, DAY).unref();
}
`
    : ""
}`;
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
    ...(kind === "markdown" ? { input: code("MarkdownEditor"), view: code("MarkdownText") } : {}),
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
    ...(kind === "file"
      ? {
          input: code(
            `bindFile(${JSON.stringify(kebab(model.name))}, ${JSON.stringify(field.name)})`,
          ),
        }
      : {}),
    ...(kind === "files"
      ? {
          input: code(
            `bindFiles(${JSON.stringify(kebab(model.name))}, ${JSON.stringify(field.name)}, ${FILES_MAX})`,
          ),
        }
      : {}),
  };
}

/** Records a computed field is added up over in one call, at most (computedRows in a data module). */
export const COMPUTED_ROWS = 10_000;

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
  return `${field.required ? ".trim()" : ""}${min > 0 ? `.min(${min}, ${min === 1 ? "w.required" : `w.atLeastCharacters(${min})`})` : ""}.max(${max}, w.atMostCharacters(${max}))`;
}

/** Zod refinements that go beyond the column types: formats, required text, bounds. */
export function refinement(field: FieldIR, visitors = false): string | undefined {
  const optional = field.required ? "" : ".nullish()";
  if (field.type.kind !== "scalar") return undefined;
  const bounds = (scale: number) =>
    `${field.min !== undefined ? `.min(${field.min * scale})` : ""}${field.max !== undefined ? `.max(${field.max * scale})` : ""}`;
  switch (field.type.name) {
    case "email":
      return `z.email(w.enterValidEmail)${optional}`;
    case "url":
      return `z.url(w.enterValidUrl)${optional}`;
    case "phone":
      return `(s) => s.regex(/^\\+?[0-9 ()-]{5,20}$/, w.enterValidPhone)`;
    case "date":
      return `(s) => s.regex(/^\\d{4}-\\d{2}-\\d{2}$/, w.enterValidDate)`;
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
    case "file":
      // What src/kit/uploads.ts returned for a document.
      return `z.object({ file: z.string().max(100), name: z.string().max(200), type: z.string().max(100), size: z.int().nonnegative() })${optional}`;
    case "files":
      return `z.array(z.object({ file: z.string().max(100), name: z.string().max(200), type: z.string().max(100), size: z.int().nonnegative() })).max(${FILES_MAX})${optional}`;
    default:
      return undefined;
  }
}
