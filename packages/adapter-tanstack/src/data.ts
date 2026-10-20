// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import {
  type AuthIR,
  apiOffers,
  type Condition,
  defaultColumns,
  emptyUx,
  FILES_MAX,
  type FieldIR,
  humanize,
  isFile,
  isFiles,
  isPicture,
  isPictures,
  isUpload,
  kebab,
  looseReferrers,
  type ModelIR,
  modelAccess,
  type PatternOf,
  PICTURES_MAX,
  pascal,
  plural,
  reviewRoles,
  type SpecIR,
  snake,
  storesFiles,
  storesPictures,
  trashGroup,
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
  Getter,
  HEADER,
  hasFavorites,
  type importList,
  keyOf,
  lists,
  literal,
  longTitle,
  modelNamed,
  names,
  ownerKey,
  references,
  relatedTitle,
  SCHEMA_IMPORT,
  sequenceEntries,
  shownFields,
  shownTitle,
  storedFields,
  type Texts,
  tableRef,
  threadLists,
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

/**
 * A model's form schema (the validation library and the table's columns), in a module of its own:
 * forms, the API and the server load it; a page that only lists or names the records does not
 * (docs/benchmarks/app-size-2026-10-07.md).
 */
export function modelSchemaModule(model: ModelIR, t: Texts, auth: AuthIR): string {
  const n = names(model, t);
  // Records visitors add, without an account (e.g. a contact form's messages).
  const visitors = modelAccess(model, auth).create.public;
  const refinements = storedFields(model).flatMap((f) => {
    const r = refinement(f, visitors, kebab(model.name));
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
    // What the app fills is never taken from a form (record-rules.md §1).
    ...storedFields(model)
      .filter((f) => f.byApp)
      .map(dataKey),
  ];
  return `${HEADER}import { createInsertSchema } from "drizzle-zod";
import ${/\bz\.(?!output)/.test(schema) ? "{ z }" : "type { z }"} from "zod";
${SCHEMA_IMPORT}
${schema.includes("w.") ? 'import { w } from "#/kit/words";\n' : ""}
/** What a ${n.label.toLowerCase()}'s form sends, checked. */
export const ${n.schema} = ${schema}.omit({ ${omitted.map((k) => `${k}: true`).join(", ")} });

export type ${n.values} = z.output<typeof ${n.schema}>;
`;
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
        `${f.name}?: { id: ${user ? "string" : "number"}${title === "id" ? "" : `; ${title}: ${titleType}`}${trashed(f) ? "; deletedAt?: Date | null" : ""} } | null`,
      ];
    }
    return f.formula ? [`${f.name}?: unknown`] : [];
  });
  const rowType = `typeof ${n.table}.$inferSelect${extras.length ? ` & {\n  ${extras.join(";\n  ")};\n}` : ""}`;
  function accessor(f: FieldIR): string {
    if (f.type.kind !== "relation") return `(row) => row.${f.name}`;
    const title = relatedTitle(ir, f.type.model);
    const live = trashed(f) ? ` && !row.${f.name}.deletedAt` : "";
    if (title === "id") return `(row) => (row.${f.name}${live} ? \`#\${row.${f.name}.id}\` : null)`;
    return live
      ? `(row) => (row.${f.name}${live} ? row.${f.name}.${title} : null)`
      : `(row) => row.${f.name}?.${title} ?? null`;
  }
  // A reference to a model with a trash: what it points to may be in the trash.
  function trashed(f: FieldIR) {
    return (
      f.type.kind === "relation" &&
      f.type.model !== USER_MODEL &&
      modelNamed(ir, f.type.model).trash
    );
  }
  const uiSource = literal({
    ...(t.translated ? localized(ui) : ui),
    ...(formulas
      ? { compute: code(withFormulasName(model)), defaults: code(defaultsName(model)) }
      : {}),
  });
  // Records visitors add, without an account (e.g. a contact form's messages).
  const visitors = modelAccess(model, auth).create.public;
  const refinements = stored.flatMap((f) => {
    const r = refinement(f, visitors, kebab(model.name));
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
  const adds = addable(model, ir, threadLists(model, ir, ux));
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
import { z } from "zod";
import type * as schema from "#/db/schema";
import { allows, type Rule } from "#/kit/access";
import { w } from "#/kit/words";
${t.translated ? 'import { tx } from "#/kit/words";\n' : ""}import type { RecordUi } from "#/kit/model";
${model.fields.some(isMarkdown) ? 'import { MarkdownEditor, MarkdownText } from "#/kit/Markdown";\n' : ""}${model.fields.some(storesPictures) ? `import { ${[...(model.fields.some(isPicture) ? ["bindPicture"] : []), ...(model.fields.some(isPictures) ? ["bindPictures"] : [])].join(", ")} } from "#/kit/PictureInput";\n` : ""}${model.fields.some(storesFiles) ? `import { ${[...(model.fields.some(isFile) ? ["bindFile"] : []), ...(model.fields.some(isFiles) ? ["bindFiles"] : [])].join(", ")} } from "#/kit/FileInput";\n` : ""}${formulas ? `import { ${defaultsName(model)}, ${withFormulasName(model)} } from "./${kebab(model.name)}.formulas";\n` : ""}import { ${n.access}, ${n.data} } from "./${kebab(model.name)}.server";
${perModel && perModel !== model ? `import { ${perData} } from "./${kebab(perModel.name)}.server";\n` : ""}${[
  ...new Set(adds.map((a) => a.target)),
]
  .filter((m) => m !== model)
  .map((m) => `import { ${names(m, t).access} } from "./${kebab(m.name)}.server";\n`)
  .join("")}import { writeAllowed } from "#/kit/limit";
import { currentViewer } from "#/lib/viewer.server";
import { ${n.schema}${capacity ? `, type ${n.values}` : ""} } from "./${kebab(model.name)}.schema";

export type { ${n.values} } from "./${kebab(model.name)}.schema";

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
      return gone && { row: gone.row, ${hasFavorites(model, ir, auth) ? "saved: false, " : ""}${model.review ? "review: [], " : ""}canWrite: false, canDelete: false,${adds.length ? ` canAdd: { ${adds.map((a) => `${a.list.name}: false`).join(", ")} },` : ""} trashed: { at: gone.deletedAt, by: gone.by, until: gone.until } };
    }`
        : ""
    }
    if (!row) return null;${
      model.fields.some((f) => threadLists(model, ir, ux).includes(f.name)) && hasSignIn(auth)
        ? `\n    // Opening its page reads its conversation (conversation.md §2).\n    ${n.data}.markRead(viewer, id);`
        : ""
    }
    return {
      row,${model.trash ? "\n      trashed: null," : ""}${model.review ? `\n      // Its files waiting for review, or rejected with the reason: for its owner and the reviewers.\n      review: ${n.data}.reviewNotes(viewer, id),` : ""}${
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

/** Deletes a ${n.label.toLowerCase()}; \`together\` takes what points to it along (docs/design/delete-together.md). */
export const ${n.remove} = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int(), together: z.boolean().optional() }))
  .handler(async ({ data }) => ${n.data}.remove(await writer(), data.id, data.together));

/** Deletes the chosen ${n.pluralLabel.toLowerCase()}, all or none (at most 1,000 at once). */
export const ${n.removeMany} = createServerFn({ method: "POST" })
  .validator(z.object({ ids: z.array(z.number().int()).max(1000), together: z.boolean().optional() }))
  .handler(async ({ data }) => ${n.data}.removeMany(await writer(), data.ids, data.together));${
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
/**
 * A model's ui with its texts read in the language now (languages.md §4): each label, plural,
 * help and choice a getter of tx, so the kit shows the page's language without a change.
 */
function localized<U extends { label: string; pluralLabel: string; fields: object[] }>(ui: U): U {
  const tx = (text: unknown) =>
    typeof text === "string" ? new Getter(`tx(${JSON.stringify(text)})`) : text;
  return {
    ...ui,
    label: tx(ui.label),
    pluralLabel: tx(ui.pluralLabel),
    fields: ui.fields.map((f) => {
      const field = f as { label?: string; help?: string; choices?: { label: string }[] };
      return {
        ...field,
        label: tx(field.label),
        ...(field.help ? { help: tx(field.help) } : {}),
        ...(field.choices
          ? { choices: field.choices.map((c) => ({ ...c, label: tx(c.label) })) }
          : {}),
      };
    }),
  } as unknown as U;
}

export function dataModule(
  model: ModelIR,
  t: Texts,
  ir: SpecIR,
  auth: AuthIR,
  ux: UxIR = emptyUx(),
): string {
  const n = names(model, t);
  // The order an order page makes (orders.md §3): its lines are written with it, priced here.
  const orderPage = ir.pages
    .map((p) => p.pattern)
    .find((p): p is PatternOf<"order"> => p.kind === "order" && p.into === model.name);
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
  const isPaged = (m: ModelIR) =>
    (hasKeys(ir, auth) && apiOffers(auth, ir).models.includes(m.name)) || Boolean(auth.assistant);
  const paged = isPaged(model);
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
      // A person by their name, which a signed-in viewer sees anyway; a record of another kind by
      // its title only through that kind's named(), among the records the viewer may read.
      const title =
        target === USER_MODEL
          ? `, title: { table: schema.user, column: schema.user.${relatedTitle(ir, target)} }`
          : "";
      return `${f.name}: { kind: "reference", column: ${column}${title} }`;
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
  // (where that model is read a page at a time too, so it has named()).
  const namedRefs = (paged ? stored : []).flatMap((f) => {
    if (f.type.kind !== "relation" || f.type.model === USER_MODEL) return [];
    const target = modelNamed(ir, f.type.model);
    if (!isPaged(target) || titleField(target) === "id") return [];
    const data = target.name === model.name ? self : names(target, t).data;
    return [
      `${f.name}: { find: (text: string) => ${data}.named(viewer, text), titles: () => ${data}.titles(viewer) }`,
    ];
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
  // With whether it is in the trash: its referrers then show a dash (docs/design/trash.md).
  const title = (m: ModelIR) => {
    const f = titleField(m);
    return `{ id: true${f === "id" ? "" : `, ${f}: true`}${m.trash ? ", deletedAt: true" : ""} }`;
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
  if (orderPage && orderPage.from !== model.name) others.add(modelNamed(ir, orderPage.from));
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
  // A related record's title only for who may read that record (its read rule, ownership, the
  // trash, review holds): each reference the viewer may not read is shown as nothing.
  const shownRefsMethod = () => `
  /** The rows with each reference to a record the viewer may not read set to nothing: a related record's title is shown only to who may read it (only its id stays). */
  shownRefs<R extends Record<string, unknown>>(${refs.length ? "viewer" : "_viewer"}: Viewer | null, rows: R[]): R[] {
    return ${refs.reduce((rows, f) => {
      const target = modelNamed(ir, f.type.model);
      const table = tableRef(target);
      const readable =
        target === model ? `${self}.readable(viewer)` : `${names(target, t).data}.readable(viewer)`;
      return `hideRefs(${rows}, "${f.name}", (ids, c = ${readable}) => (c ? db.select({ id: ${table}.id }).from(${table}).where(and(inArray(${table}.id, ids), c)).all().map((r) => r.id) : ids))`;
    }, "rows")};
  },
`;
  const shownOne = (v: string) => {
    const nested = lists(model)
      .filter((f) => withReferences(modelNamed(ir, f.type.model), model.name).length)
      .map(
        (f) =>
          `, ${f.name}: ${names(modelNamed(ir, f.type.model), t).data}.shownRefs(viewer, ${v}.${f.name})`,
      )
      .join("");
    return `${self}.shownRefs(viewer, [${nested ? `{ ...${v}${nested} }` : v}])[0]`;
  };
  const uploadFields = model.fields.filter(isUpload);
  for (const ref of refs)
    if (ref.type.model !== model.name) others.add(modelNamed(ir, ref.type.model));
  const withClause = (entries: string[], indent: string) =>
    entries.length ? `\n${indent}with: { ${entries.join(", ")} },` : "";
  const compute = (expr: string) => (formulas ? `${withFormulasName(model)}(${expr})` : expr);
  // A list's rows as the viewer gets them: formulas worked out, related records kept for the
  // totals left out. No local of its own: a model's table may have any name (items, for Item).
  const asListed = (given: string, lead: string, tail = "") => {
    const rows = (model.review ?? []).some((f) => !model.fields.find((x) => x.name === f)?.required)
      ? `veiled(viewer, ${given})`
      : given;
    return aggregatedLists(model).length
      ? `// The related records are here for the totals only: some may not be the viewer's to read.
    ${lead}${rows}.map((row) => {
      const { ${aggregatedLists(model).join(", ")}, ...listed } = ${compute("row")};
      return listed;
    })${tail};`
      : `${lead}${formulas ? `${rows}.map(${withFormulasName(model)})` : rows}${tail};`;
  };
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
  // A reviewed field that is required holds the whole record until its file is approved; the
  // reviewers are admin and the roles granted review (docs/design/file-review.md).
  const held = (model.review ?? []).filter((f) => model.fields.find((x) => x.name === f)?.required);
  const veils = (model.review ?? []).filter((f) => !held.includes(f));
  const drizzle = [
    ...(held.length ? ["notExists"] : []),
    ...(model.review ? ["or"] : []),
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
  // A person's default ME(): who makes the record; a field the form shows keeps what was chosen.
  const byMe = model.fields
    .filter((f) => f.defaultMe)
    .map((f) =>
      f.byApp
        ? `${dataKey(f)}: personOf(viewer)`
        : `${dataKey(f)}: values.${dataKey(f)} ?? personOf(viewer)`,
    );
  // A number counting up (`sequence: true`, orders.md §4): from the field's counter (per owner
  // where the number is unique per owner), kept ahead of the records' highest, in the change's
  // own transaction, so two records made at once never share one and a number is never given twice.
  const ownerValue = model.ownedBy ? `ownerFor(viewer, values.${owner})` : "personOf(viewer)";
  const counted = sequenceEntries(model, auth, n.table, ownerValue);
  const set = [...byMe, ...counted].map((e) => `, ${e}`).join("");
  const createValues = !signedIn
    ? counted.length
      ? `{ ...values${set} }`
      : "values"
    : model.ownedBy
      ? `{ ...values, ${owner}: ownerFor(viewer, values.${owner})${set} }`
      : `{ ...values, ownerId: personOf(viewer)${set} }`;
  // A field's rules on the record (record-rules.md §2–3): a lock on a change made in a form, the
  // API or Ask (an action's set may change a locked field it names, which is how a case is
  // reopened; `frees` lists them), and
  // a value required while the record fits a condition, on any change.
  const label = (f: FieldIR) => JSON.stringify(t.field(model, f).label ?? humanize(f.name));
  const locks = model.fields.flatMap((f) =>
    f.locked
      ? [
          `          if ((what === "changed" || !frees.includes(${JSON.stringify(dataKey(f))})) && ${JSON.stringify(dataKey(f))} in given && JSON.stringify(given.${dataKey(f)} ?? null) !== JSON.stringify(before.${dataKey(f)} ?? null)${f.locked === true ? "" : ` && fits(${literal(f.locked)}, was)`}) throw new BadInput(w.cannotChangeNow(${label(f)}));`,
        ]
      : [],
  );
  const needs = (record: string) =>
    model.fields.flatMap((f) =>
      f.requiredWhen
        ? [
            `if (fits(${literal(f.requiredWhen)}, ${record}) && (${record}.${dataKey(f)} ?? "") === "") throw new BadInput(w.requiredNow(${label(f)}));`,
          ]
        : [],
    );
  // A choice the request leaves out has its default, as the database gives it.
  const choiceDefaults = model.fields
    .filter((f) => f.type.kind === "choice" && typeof f.default === "string")
    .map((f) => `${f.name}: ${JSON.stringify(f.default)}, `)
    .join("");
  const ruled = locks.length > 0 || needs("next").length > 0;
  // A condition naming a computed field (record-rules.md §5) reads the record as the page loads
  // it, its formulas worked out: the stored row has none.
  const formulaNames = new Set(model.fields.filter((f) => f.formula).map((f) => f.name));
  const namesComputed = model.fields.some((f) =>
    [f.locked === true ? undefined : f.locked, f.requiredWhen].some(
      (c) => c && Object.keys(c).some((k) => formulaNames.has(k)),
    ),
  );
  const loadComputed =
    ruled && namesComputed
      ? `    const loaded: Record<string, unknown> = (await ${n.data}.get(viewer, id)) ?? {};\n`
      : "";
  const updateRules = ruled
    ? `
        if (before) {
          const given: Record<string, unknown> = updated;
          const was: Record<string, unknown> = ${loadComputed ? "{ ...before, ...loaded }" : "before"};${locks.length ? `\n${locks.join("\n")}` : ""}
          const next: Record<string, unknown> = { ...was, ...given };${needs("next")
            .map((l) => `\n          ${l}`)
            .join("")}
        }`
    : "";
  // On a create the record is not stored yet: its formulas are worked out on the values given.
  const createRules = needs("next").length
    ? `    const next: Record<string, unknown> = ${namesComputed ? `${withFormulasName(model)}({ ${choiceDefaults}...values })` : `{ ${choiceDefaults}...values }`};\n${needs(
        "next",
      )
        .map((l) => `    ${l}\n`)
        .join("")}`
    : "";
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
  // A new file in a reviewed field starts waiting, in the change's own transaction.
  const queue = (record: string, before: string, after: string) =>
    model.review ? `\n        queueReviews(tx, viewer, ${record}, ${before}, ${after});` : "";
  // An order's lines, in its transaction: each chosen record read as the viewer may, refused when
  // it is not available, its price copied (orders.md §3 items 1–2).
  const orderLines = (() => {
    if (!orderPage) return "";
    const from = modelNamed(ir, orderPage.from);
    const line = modelNamed(ir, orderPage.line);
    const nf = names(from, t);
    const nl = names(line, t);
    const field = (m: ModelIR, name: string) =>
      dataKey(m.fields.find((x) => x.name === name) as FieldIR);
    const back = line.fields.find(
      (x) => x.type.kind === "relation" && !x.type.many && x.type.model === model.name,
    );
    const title = titleField(from);
    return `
        for (const chosen of lines ?? []) {
          const item = tx.select().from(${nf.table}).where(and(eq(${nf.table}.id, chosen.id), ${nf.data}.readable(viewer))).get();
          if (!item) throw new BadInput("order-item");${
            orderPage.available
              ? `
          if (item.${field(from, orderPage.available)} === false) throw new Conflict(\`sold-out:\${${title && title !== "id" ? `item.${title}` : "item.id"}}\`);`
              : ""
          }
          tx.insert(${nl.table}).values({ ${back ? `${dataKey(back)}: made.id, ` : ""}${field(line, orderPage.item)}: item.id, ${orderPage.quantity ? `${field(line, orderPage.quantity)}: chosen.quantity, ` : ""}${field(line, orderPage.unitPrice)}: item.${field(from, orderPage.price)}${signedIn && !line.ownedBy ? ", ownerId: personOf(viewer)" : ""} }).run();
        }`;
  })();
  const insertAudited = `const made = tx.insert(${n.table}).values(${createValues}).returning().get();${orderLines}
        audit(tx, viewer, { action: "created", model: "${model.name}", record: made.id });${queue("made.id", "undefined", "made")}${tell('"created"', "made")}
        return made;`;
  const favorites = hasFavorites(model, ir, auth) ? `${n.table}Favorites` : undefined;
  // Read marks for a record whose page shows a conversation (conversation.md §2): when each person
  // last read it, and the messages after that by someone else as its unread.
  const threadList = signedIn
    ? model.fields.find((f) => threadLists(model, ir, ux).includes(f.name))
    : undefined;
  const threadTarget =
    threadList?.type.kind === "relation" ? modelNamed(ir, threadList.type.model) : undefined;
  const threadRef =
    threadTarget && references(threadTarget).find((f) => f.type.model === model.name);
  const reads = threadTarget && threadRef ? `${n.table}Reads` : undefined;
  // The trash (docs/design/trash.md): a delete moves the record there.
  const trashing = Boolean(model.trash);
  // What points to a record with a required reference cannot exist without it: it goes to the
  // trash with it, when the root and every model in the group have a trash; otherwise the delete
  // is refused, with the facts (docs/design/delete-together.md). Optional referrers stay.
  const group = trashGroup(ir, model.name);
  const members = [...new Set(group.map((e) => e.model))].map((m) => modelNamed(ir, m));
  const loose = looseReferrers(ir, model.name).map((r) => modelNamed(ir, r.model));
  const together = trashing && members.every((m) => m.trash);
  // The kinds' words, read from their modules (each written once, words-once.md).
  const labelledKinds = new Set<ModelIR>();
  const uiOf = (m: ModelIR) => {
    labelledKinds.add(m);
    return names(m, t).ui;
  };
  const missing = () =>
    [...(trashing ? [] : [model]), ...members.filter((m) => !m.trash)].map(
      (m) => `${uiOf(m)}.label`,
    );
  // The roots whose group this model is in: a member comes back with its root, not alone.
  const roots = trashing
    ? ir.models.filter((r) => {
        const edges = trashGroup(ir, r.name);
        return (
          r.trash &&
          edges.some((e) => e.model === model.name) &&
          edges.every((e) => modelNamed(ir, e.model).trash)
        );
      })
    : [];
  // The member modules this one calls: trashWith and restoreWith when the group goes together,
  // erase for the trashed members of a root removed for good. A root's module is never needed:
  // rootInTrash reads its table.
  for (const m of members)
    if (m !== model && ((together && group.length) || (trashing && m.trash))) others.add(m);
  const dataOf = (m: ModelIR) => (m === model ? self : names(m, t).data);
  let usesOr = false;
  const anyOf = (conditions: string[]): string => {
    if (conditions.length === 0) return "sql`false`";
    if (conditions.length > 1) usesOr = true;
    return conditions.length === 1 ? (conditions[0] as string) : `or(${conditions.join(", ")})`;
  };
  // Only live records count: a condition to add for a model with a trash.
  const liveIn = (m: ModelIR) => (m.trash ? `, isNull(${tableRef(m)}.deletedAt)` : "");
  const labelled = (m: ModelIR) =>
    `model: ${JSON.stringify(m.name)}, label: ${uiOf(m)}.label, plural: ${uiOf(m)}.pluralLabel`;
  // How many live records of a member point to the root: directly, or through their parent
  // (one join); deeper members are only named.
  const countIn = (m: ModelIR) => {
    const te = tableRef(m);
    const depth = Math.min(...group.filter((e) => e.model === m.name).map((e) => e.depth));
    const direct = group.filter((e) => e.model === m.name && e.depth === depth);
    if (depth === 1)
      return `tx.select({ n: count() }).from(${te}).where(and(${anyOf(direct.map((e) => `eq(${te}.${e.via}Id, id)`))}${liveIn(m)})).get()?.n ?? 0`;
    if (depth > 2) return "null";
    const parent = modelNamed(ir, (direct[0] as (typeof group)[number]).from);
    const tp = tableRef(parent);
    const via = direct.filter((e) => e.from === parent.name);
    const up = group.filter((e) => e.model === parent.name && e.depth === 1);
    return `tx.select({ n: count() }).from(${te}).innerJoin(${tp}, ${anyOf(via.map((e) => `eq(${te}.${e.via}Id, ${tp}.id)`))}).where(and(${anyOf(up.map((e) => `eq(${tp}.${e.via}Id, id)`))}${liveIn(parent)}${liveIn(m)})).get()?.n ?? 0`;
  };
  const usedBy = group.length
    ? `
/**
 * What points to a ${n.label.toLowerCase()} (docs/design/delete-together.md): the records that would go with it
 * to the trash, by model, and those that would show no ${n.label.toLowerCase()}; nothing when nothing does.
 */
function usedBy(tx: Tx, id: number, title: string) {
  const pointing: { model: string; from: string; label: string; plural: string; depth: number; count: number | null }[] = [
${members
  .map((m) => {
    const first = group.find((e) => e.model === m.name) as (typeof group)[number];
    return `    { ${labelled(m)}, from: ${JSON.stringify(first.from)}, depth: ${first.depth}, count: ${countIn(m)} },`;
  })
  .join("\n")}
  ];
  // A deeper member is named when its parent has records ("and what belongs to them").
  const with_: typeof pointing = [];
  for (const e of pointing)
    if (e.count === null ? with_.some((p) => p.model === e.from) : e.count > 0) with_.push(e);
  if (!with_.length) return undefined;
  const loose = [${
    loose.length
      ? `
${loose
  .map((m) => {
    const te = tableRef(m);
    const vias = looseReferrers(ir, model.name).filter((r) => r.model === m.name);
    return `    { ${labelled(m)}, count: tx.select({ n: count() }).from(${te}).where(and(${anyOf(vias.map((r) => `eq(${te}.${r.via}Id, id)`))}${liveIn(m)})).get()?.n ?? 0 },`;
  })
  .join("\n")}
  ].filter((e) => e.count > 0)`
      : "] as { model: string; label: string; plural: string; count: number }[]"
  };
  return { id, title, ${labelled(model).replace(/, plural: .*$/, "")}, with: with_, loose, together: ${together}, missing: [${missing().join(", ")}] };
}
`
    : "";
  const titleOf = (row: string, id: string) =>
    titleField(model) === "id" ? `\`#\${${id}}\`` : `String(${row}.${titleField(model)} ?? ${id})`;
  const groupCheck = (id: string, row: string, indent: string) =>
    group.length
      ? `${indent}const used = usedBy(tx, ${id}, ${titleOf(row, id)});\n${indent}if (used${together ? " && !together" : ""}) throw new Conflict(\`in-use:\${JSON.stringify(used)}\`);\n`
      : "";
  // The group goes with the root, level by level: each member's records that point to it, then
  // those that point to them (found by the group's mark), with the same time and mark.
  const groupTrash = (id: string, indent: string) =>
    together && group.length
      ? `\n${indent}if (used) {\n${indent}  const tag = \`${model.name}:\${${id}}\`;\n${group
          .map((e) => {
            const te = tableRef(modelNamed(ir, e.model));
            const tp = tableRef(modelNamed(ir, e.from));
            const fits =
              e.depth === 1
                ? `eq(${te}.${e.via}Id, ${id})`
                : `inArray(${te}.${e.via}Id, tx.select({ id: ${tp}.id }).from(${tp}).where(eq(${tp}.deletedWith, tag)))`;
            return `${indent}  ${dataOf(modelNamed(ir, e.model))}.trashWith(tx, viewer, ${fits}, tag, when);\n`;
          })
          .join("")}${indent}}`
      : "";
  const goneBy = (id: string) =>
    trashing
      ? `tx.update(${n.table}).set({ deletedAt: when, deletedBy: personOf(viewer) }).where(and(eq(${n.table}.id, ${id}), isNull(${n.table}.deletedAt))).returning().get()`
      : `tx.delete(${n.table}).where(eq(${n.table}.id, ${id})).returning().get()`;
  const goneAction = trashing ? "trashed" : "deleted";
  // The records in the trash that point to the roots, through the group's chain of references.
  const pointsAt = (m: string, path: string[]): string =>
    anyOf(
      group
        .filter((e) => e.model === m && (e.from === model.name || !path.includes(e.from)))
        .map((e) => {
          const te = tableRef(modelNamed(ir, e.model));
          const tf = tableRef(modelNamed(ir, e.from));
          return e.from === model.name
            ? `inArray(${te}.${e.via}Id, ids)`
            : `inArray(${te}.${e.via}Id, db.select({ id: ${tf}.id }).from(${tf}).where(${pointsAt(e.from, [...path, e.from])}))`;
        }),
    );
  // Removing roots for good takes the trashed members that point to them first, deepest first.
  const eraseMembers = trashing
    ? [...members]
        .reverse()
        .filter((m) => m.trash)
        .map((m) => {
          const tm = tableRef(m);
          return `    ${dataOf(m)}.erase(viewer, db.select({ id: ${tm}.id }).from(${tm}).where(and(isNotNull(${tm}.deletedAt), ${pointsAt(m.name, [m.name])})).all().map((r) => r.id));\n`;
        })
        .join("")
    : "";
  if (usesOr) drizzle.push("or");
  if (model.fields.some((f) => f.sequence)) drizzle.push("max");
  if (threadTarget?.trash) drizzle.push("isNull");
  if (reads) drizzle.push("gt", "inArray", "isNotNull", "isNull", "ne", "or");
  if (group.length) drizzle.push("count");
  if ((group.length && [...members, ...loose].some((m) => m.trash)) || roots.length)
    drizzle.push("isNull");
  // In the trash view: the record a member went with, by name, and how many went with a root.
  const groupShown = `${
    roots.length
      ? `
    const withTitle = new Map<string, string>();
${roots
  .map((r) => {
    const tr = tableRef(r);
    const rt = titleField(r);
    return `    for (const r of db.select({ id: ${tr}.id${rt === "id" ? "" : `, title: ${tr}.${rt}`} }).from(${tr}).where(inArray(${tr}.id, rows.flatMap((row) => (row.deletedWith?.startsWith("${r.name}:") ? [Number(row.deletedWith.slice(${r.name.length + 1}))] : [])))).all())
      withTitle.set(\`${r.name}:\${r.id}\`, ${rt === "id" ? "`#${r.id}`" : "String(r.title ?? r.id)"});`;
  })
  .join("\n")}`
      : ""
  }${
    together && group.length
      ? `
    const withCount = new Map<string, number>();
    const tags = rows.map((row) => \`${model.name}:\${row.id}\`);
${members
  .map((m) => {
    const tm = tableRef(m);
    return `    for (const r of db.select({ tag: ${tm}.deletedWith, n: count() }).from(${tm}).where(inArray(${tm}.deletedWith, tags)).groupBy(${tm}.deletedWith).all())
      withCount.set(r.tag as string, (withCount.get(r.tag as string) ?? 0) + r.n);`;
  })
  .join("\n")}`
      : ""
  }`;
  const rootInTrash = roots.length
    ? `
/** The record one went to the trash with, while it is still there: its label and title, by the mark ("Customer:12"). */
function rootInTrash(tag: string): string | undefined {
  const [model, id] = tag.split(":");
  switch (model) {
${roots
  .map((r) => {
    const tr = tableRef(r);
    const rt = titleField(r);
    return `    case "${r.name}": {
      const root = db.select({ deletedAt: ${tr}.deletedAt${rt === "id" ? "" : `, title: ${tr}.${rt}`} }).from(${tr}).where(eq(${tr}.id, Number(id))).get();
      return root?.deletedAt ? \`${names(r, t).label}:\${${rt === "id" ? "`#${id}`" : "String(root.title ?? id)"}}\` : undefined;
    }`;
  })
  .join("\n")}
    default:
      return undefined;
  }
}
`
    : "";
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
    const rows = ${self}.shownRefs(
      viewer,
      await db.query.${n.tableKey}.findMany({
        where: ${trashedRows},${withClause(listWith, "        ")}
        orderBy: (t) => [desc(t.deletedAt)],
        limit: ${TRASH_SHOWN},
      }),
    )${allowed};${named}${groupShown}
    ${asListed(`rows.map((row) => ({ ...${ownedAuto ? "shownTo(viewer, row)" : "row"}, deletedByName: ${byName}${roots.length ? ", withTitle: (row.deletedWith && withTitle.get(row.deletedWith)) ?? null" : ""}${together && group.length ? `, withCount: withCount.get(\`${model.name}:\${row.id}\`) ?? 0` : ""} }))`, "return ")}
  },

  /** A ${n.label.toLowerCase()} in the trash, as its page shows it read-only, with when and by whom; else nothing. */
  async trashed(viewer: Viewer | null, id: number) {
    const fetched = await db.query.${n.tableKey}.findFirst({
      where: and(eq(${n.table}.id, id), ${trashedRows}),${withClause(getWith, "      ")}
    });
    const row = fetched && ${shownOne("fetched")};
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
      .select(${selectOwner.replace("{ ", `{ id: ${n.table}.id, ${roots.length ? `deletedWith: ${n.table}.deletedWith, ` : ""}`)})
      .from(${n.table})
      .where(and(inArray(${n.table}.id, ids), ${trashedRows}))
      .all()${allowed};${
        roots.length
          ? `
    // One that went to the trash with another record comes back with it, not alone (delete-together.md).
    for (const row of rows) {
      const root = row.deletedWith && rootInTrash(row.deletedWith);
      if (root) throw new Conflict(\`restore-root-first:\${root}\`);
    }`
          : ""
      }
    // A unique value a live record has taken since refuses it, as it refuses a new record.
    try {
      db.transaction((tx) => {
        for (const row of rows) {
          const back = tx.update(${n.table}).set({ deletedAt: null, deletedBy: null, deletedWith: null }).where(eq(${n.table}.id, row.id)).returning().get();
          audit(tx, viewer, { action: "restored", model: "${model.name}", record: row.id, title: back.${titleKey} });${
            together && group.length
              ? `
          // What went to the trash with it comes back with it.
${members.map((m) => `          ${dataOf(m)}.restoreWith(tx, viewer, \`${model.name}:\${row.id}\`);`).join("\n")}`
              : ""
          }
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
    if (ids.length === 0) return;${
      eraseMembers
        ? `
    // What is in the trash pointing to them goes first, deepest first (docs/design/delete-together.md).
${eraseMembers}`
        : ""
    }
    const rows = db
      .select(${selectOwner.replace("{ ", `{ id: ${n.table}.id, `)})
      .from(${n.table})
      .where(and(inArray(${n.table}.id, ids), isNotNull(${n.table}.deletedAt)))
      .all();
    try {
      db.transaction((tx) => {
        for (const row of rows) {
          const gone = tx.delete(${n.table}).where(eq(${n.table}.id, row.id)).returning().get();
          if (gone) audit(tx, viewer, { action: "removed", model: "${model.name}", record: row.id, title: ${longTitle(model) ? `titleOf(gone.${titleKey})` : `gone.${titleKey}`} });
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

  /** What has been in the trash for thirty days goes for good (once a day, see trash.server.ts). */
  purge(now = Date.now()): number {
    const old = db
      .select({ id: ${n.table}.id })
      .from(${n.table})
      .where(lt(${n.table}.deletedAt, new Date(now - TRASH_DAYS * DAY)))
      .all()
      .map((row) => row.id);
    ${self}.erase(null, old);
    return old.length;
  },${
    roots.length
      ? `

  /**
   * Moves the live ${n.pluralLabel.toLowerCase()} the condition fits to the trash with another record
   * (docs/design/delete-together.md), marked as its group; the viewer must be allowed to delete each.
   */
  trashWith(tx: Tx, viewer: Viewer | null, fits: SQL, tag: string, when: Date): void {
    const rows = tx.select().from(${n.table}).where(and(fits, isNull(${n.table}.deletedAt))).all();
    for (const row of rows)
      if (!allows(${n.access}.delete, viewer, ${ownerOf})) throw new Conflict("no-right:${names(model, t).label}");
    if (rows.length === 0) return;
    tx.update(${n.table}).set({ deletedAt: when, deletedBy: personOf(viewer), deletedWith: tag }).where(and(fits, isNull(${n.table}.deletedAt))).run();
    for (const row of rows) {
      audit(tx, viewer, { action: "trashed", model: "${model.name}", record: row.id, title: row.${titleKey}, details: { with: tag } });${tell('"deleted"', "row").replace("\n        ", "\n      ")}
    }
  },

  /** Takes the ${n.pluralLabel.toLowerCase()} that went to the trash with a record out of it again. */
  restoreWith(tx: Tx, viewer: Viewer | null, tag: string): void {
    const back = tx.update(${n.table}).set({ deletedAt: null, deletedBy: null, deletedWith: null }).where(eq(${n.table}.deletedWith, tag)).returning().all();
    for (const row of back)
      audit(tx, viewer, { action: "restored", model: "${model.name}", record: row.id, title: row.${titleKey}, details: { with: tag } });
  },`
      : ""
  }`;
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
  // With the title, for the facts a refused delete carries.
  const selectTitled =
    group.length && titleField(model) !== "id"
      ? selectOwner.replace("{ ", `{ ${titleField(model)}: ${n.table}.${titleField(model)}, `)
      : selectOwner;
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
import { refusal } from "#/kit/log.server";
${longTitle(model) ? 'import { titleOf } from "#/kit/format";\n' : ""}${mails ? `${OUTGOING_IMPORT}\n` : ""}${((referenced || paged) && titleColumn !== "id") || (paged && searched.length) ? `import { contains } from "#/kit/search";\n` : ""}${paged || ruled || orderPage ? 'import { BadInput } from "#/kit/refusal";\n' : ""}${ruled ? 'import { fits } from "#/kit/model";\n' : ""}${paged ? 'import { aggregate, type Filterable, nearest, sortOf, whereOf, wordsOf } from "#/kit/where";\n' : ""}${ruled ? 'import { w } from "#/kit/words";\n' : ""}${pictures.length ? `import { ${[...(singles.length || pictureLists.length ? ["deletePicture"] : []), ...(docSingles.length || docLists.length ? ["deleteFile"] : [])].join(", ")} } from "#/kit/uploads";\n` : ""}${model.fields.some(isUpload) ? 'import { acceptFiles } from "#/kit/receipts.server";\n' : ""}${model.review && signedIn ? 'import { tellReviewers } from "#/kit/review-mail.server";\n' : ""}import { afterChange, afterDelete } from "./hooks";
${[...others]
  .map((m) => `import { ${names(m, t).data} } from "./${kebab(m.name)}.server";`)
  .join("\n")}${others.size ? "\n" : ""}${[...labelledKinds]
  .filter((m) => m !== model)
  .map((m) => `import { ${names(m, t).ui} } from "./${kebab(m.name)}";\n`)
  .join(
    "",
  )}import { ${labelledKinds.has(model) ? `${n.ui}, ` : ""}type ${n.values} } from "./${kebab(model.name)}";
${formulas ? `import { ${withFormulasName(model)} } from "./${kebab(model.name)}.formulas";\n` : ""}${counted.length ? 'import { nextInSequence } from "#/kit/sequence.server";\n' : ""}${trashing ? 'import "./trash.server";\n' : ""}${
  group.length || roots.length
    ? `
/** A transaction, as the group's functions are called inside one (docs/design/delete-together.md). */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
`
    : ""
}${usedBy}${rootInTrash}
${
  model.review
    ? `/**
 * Each new file in a reviewed field waits for a reviewer (docs/design/file-review.md), unless a
 * reviewer sent it; a file that is replaced or removed leaves the list, and with it a rejection
 * and its reason.
 */
function queueReviews(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  viewer: Viewer | null,
  recordId: number,
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown>,
) {
  const files = (value: unknown) =>
    (Array.isArray(value) ? value : value ? [value] : []).map((v) => (v as { file: string }).file);
${signedIn ? "  let queued = false;" : ""}
  for (const [field, key] of ${JSON.stringify(model.review.map((f) => [f, dataKey(model.fields.find((x) => x.name === f) as FieldIR)]))} as [string, string][]) {
    const had = files(before?.[key]);
    const has = files(after[key]);
    const gone = had.filter((f) => !has.includes(f));
    if (gone.length)
      tx.delete(schema.fileReviews)
        .where(and(eq(schema.fileReviews.model, ${JSON.stringify(model.name)}), eq(schema.fileReviews.recordId, recordId), eq(schema.fileReviews.field, field), inArray(schema.fileReviews.file, gone)))
        .run();
    if (viewer && REVIEWERS.includes(viewer.role)) continue;
    for (const file of has.filter((f) => !had.includes(f))) {
      // A new file answers what was asked: the field's rejections go (their reasons were shown
      // until now), and an earlier decision about the same file (files are named by their
      // content) is replaced.
      tx.delete(schema.fileReviews)
        .where(and(eq(schema.fileReviews.model, ${JSON.stringify(model.name)}), eq(schema.fileReviews.recordId, recordId), eq(schema.fileReviews.field, field), or(eq(schema.fileReviews.file, file), eq(schema.fileReviews.state, "rejected"))))
        .run();
      tx.insert(schema.fileReviews)
        .values({ model: ${JSON.stringify(model.name)}, recordId, field, file, uploadedBy: viewer?.id ?? null })
        .run();
${signedIn ? "      queued = true;\n" : ""}    }
  }
${
  signedIn
    ? `  // The reviewers are told once the change is saved (a rolled-back one leaves nothing waiting).
  if (queued) setTimeout(() => void tellReviewers(${JSON.stringify(ir.app.name)}, ${JSON.stringify(model.name)}), 0);
`
    : ""
}}

`
    : ""
}${
  veils.length
    ? `/**
 * The waiting or rejected files of the optional reviewed fields, left out for everyone but the
 * record's owner and the reviewers (docs/design/file-review.md): the record shows, the file not.
 */
function veiled<R extends { id: number }>(viewer: Viewer | null, rows: R[]): R[] {
  if (!rows.length || (viewer && REVIEWERS.includes(viewer.role))) return rows;
  const waiting = db
    .select({ recordId: schema.fileReviews.recordId, field: schema.fileReviews.field, file: schema.fileReviews.file })
    .from(schema.fileReviews)
    .where(and(eq(schema.fileReviews.model, ${JSON.stringify(model.name)}), inArray(schema.fileReviews.recordId, rows.map((r) => r.id)), inArray(schema.fileReviews.state, ["pending", "rejected"]), inArray(schema.fileReviews.field, ${JSON.stringify(veils)})))
    .all();
  if (!waiting.length) return rows;${
    signedIn
      ? `
  const owners = new Map(
    db.select({ id: ${n.table}.id, owner: ${n.table}.${owner} }).from(${n.table}).where(inArray(${n.table}.id, waiting.map((w) => w.recordId))).all().map((o) => [o.id, o.owner]),
  );`
      : ""
  }
  const keys: Record<string, string> = ${JSON.stringify(Object.fromEntries(veils.map((f) => [f, dataKey(model.fields.find((x) => x.name === f) as FieldIR)])))};
  return rows.map((row) => {
    const mine = waiting.filter((w) => w.recordId === row.id);
    if (!mine.length${signedIn ? " || (viewer && owners.get(row.id) === viewer.id)" : ""}) return row;
    const shown: Record<string, unknown> = { ...row };
    for (const w of mine) {
      const key = keys[w.field] as string;
      const value = shown[key];
      shown[key] = Array.isArray(value)
        ? value.filter((v) => (v as { file: string }).file !== w.file)
        : (value as { file?: string } | null)?.file === w.file
          ? null
          : value;
    }
    return shown as R;
  });
}

`
    : ""
}/** Who may read, create, change and delete ${n.pluralLabel.toLowerCase()}. */
export const ${n.access}: ModelAccess = ${literal(access)};${
    model.review
      ? `
/** The roles that approve or reject ${n.pluralLabel.toLowerCase()}' waiting files (docs/design/file-review.md). */
export const REVIEWERS: string[] = ${JSON.stringify(reviewRoles(model.name, auth))};`
      : ""
  }
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
function titlesOf(${titled.length ? "viewer" : "_viewer"}: Viewer | null, ${titled.length ? "by" : "_by"}: string, ${titled.length ? "ids" : "_ids"}: number[]): Map<unknown, string> {
  switch (${titled.length ? "by" : "_by"}) {${titled
    .map(
      ({ target, f, title }) => `
    case "${f.name}":
      return new Map(db.select({ id: ${tableRef(target)}.id, title: ${tableRef(target)}.${title} }).from(${tableRef(target)}).where(and(inArray(${tableRef(target)}.id, ids), ${target === model ? self : names(target, t).data}.readable(viewer))).all().map((r) => [r.id, String(r.title)]));`,
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
  uploadFields.length
    ? `
/** Each picture or document new to the record must come with the receipt its upload gave the viewer (src/kit/receipts.server.ts); the receipts are not kept. */
function checkFiles<V extends Partial<${n.values}>>(viewer: Viewer | null, values: V, before?: Record<string, unknown>): V {
  return {
    ...values,
${uploadFields.map((f) => `    ...("${dataKey(f)}" in values ? { ${dataKey(f)}: acceptFiles(viewer, ${JSON.stringify(kebab(model.name))}, ${JSON.stringify(f.name)}, values.${dataKey(f)}, before?.${dataKey(f)}) } : {}),`).join("\n")}
  };
}
`
    : ""
}${
  refs.length
    ? `
/** Checks that the viewer may read the records the values refer to. */
function checkReferences(viewer: Viewer | null, values: Partial<${n.values}>): void {
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
}${
  refs.length
    ? `/** \`rows\` with each \`field\` reference \`readable\` leaves out set to nothing (only its id stays). */
function hideRefs<R extends Record<string, unknown>>(rows: R[], field: string, readable: (ids: number[]) => number[]): R[] {
  const idOf = (row: R) => (row[field] as { id?: unknown } | null | undefined)?.id;
  const ids = [...new Set(rows.map(idOf).filter((id): id is number => typeof id === "number"))];
  if (!ids.length) return rows;
  const shown = new Set(readable(ids));
  return rows.map((row) => {
    const id = idOf(row);
    return typeof id === "number" && !shown.has(id) ? { ...row, [field]: null } : row;
  });
}

`
    : ""
}export const ${self} = {${ownedAuto ? "\n  shownTo," : ""}${shownRefsMethod()}${
    pictures.length
      ? `\n  /** Whether a stored picture or document is on any record (the trash too): a file no record has may go. */\n  uses(file: string): boolean {\n    return ${stillShown("", "file")};\n  },\n`
      : ""
  }
  /** A condition for the ${n.pluralLabel.toLowerCase()} the viewer may read. */
  readable(viewer: Viewer | null) {${
    model.trash || held.length
      ? `
${model.trash ? "    // What is in the trash is gone to every reader (docs/design/trash.md).\n" : ""}${held.length ? "    // A record waiting for its required file to be approved is its owner's and the reviewers' only (docs/design/file-review.md).\n" : ""}    return and(${model.trash ? `isNull(${n.table}.deletedAt), ` : ""}${held.length ? `${self}.unheld(viewer), ` : ""}${self}.scoped(viewer));
  },${
    held.length
      ? `

  /** Records whose required file waits for review (or was rejected) are left out, except for their owner and the reviewers. */
  unheld(viewer: Viewer | null) {
    if (viewer && REVIEWERS.includes(viewer.role)) return undefined;
    const waiting = notExists(
      db
        .select({ id: schema.fileReviews.id })
        .from(schema.fileReviews)
        .where(
          and(
            eq(schema.fileReviews.model, ${JSON.stringify(model.name)}),
            eq(schema.fileReviews.recordId, ${n.table}.id),
            inArray(schema.fileReviews.state, ["pending", "rejected"]),
            inArray(schema.fileReviews.field, ${JSON.stringify(held)}),
          ),
        ),
    );
    return viewer ? or(waiting, eq(${n.table}.${owner}, viewer.id)) : waiting;
  },`
      : ""
  }

  /** The records the viewer may read by the read rule, the trashed ones too. */
  scoped(viewer: Viewer | null) {`
      : ""
  }
    const scope = readScope(${n.access}.read, viewer);
    if (scope === "all") return undefined;
${publicWhere ? `    if (scope === "public") return ${publicWhere};\n` : ""}    return ${ownOrPublic};
  },

${
  model.review
    ? `  /** The record's files waiting for review, or rejected with a reason: for its owner and the reviewers only. */
  reviewNotes(viewer: Viewer | null, id: number): { field: string; state: string; reason: string | null }[] {
    if (!viewer) return [];
    if (!REVIEWERS.includes(viewer.role)) {${
      signedIn
        ? `
      const own = db.select({ owner: ${n.table}.${owner} }).from(${n.table}).where(eq(${n.table}.id, id)).get();
      if (own?.owner !== viewer.id) return [];`
        : "\n      return [];"
    }
    }
    return db
      .select({ field: schema.fileReviews.field, state: schema.fileReviews.state, reason: schema.fileReviews.reason })
      .from(schema.fileReviews)
      .where(and(eq(schema.fileReviews.model, ${JSON.stringify(model.name)}), eq(schema.fileReviews.recordId, id), inArray(schema.fileReviews.state, ["pending", "rejected"])))
      .all();
  },

`
    : ""
}  canRead(viewer: Viewer | null, id: number): boolean {
    const found = db
      .select({ id: ${n.table}.id })
      .from(${n.table})
      .where(and(eq(${n.table}.id, id), ${self}.readable(viewer)))
      .get();
    return found !== undefined;
  },
${
  reads && threadTarget && threadRef
    ? `
  /** Marks the ${n.label.toLowerCase()}'s conversation read for the viewer, now. */
  markRead(viewer: Viewer | null, id: number): void {
    if (!viewer) return;
    db.insert(${reads})
      .values({ userId: viewer.id, recordId: id, readAt: new Date() })
      .onConflictDoUpdate({ target: [${reads}.userId, ${reads}.recordId], set: { readAt: new Date() } })
      .run();
  },

  /** Each ${n.label.toLowerCase()}'s messages, and how many the viewer has not read: a message is read once they opened the conversation after it, and their own always. */
  threadCounts(viewer: Viewer | null, ids: number[]): Record<number, { count: number; unread: number }> {
    const counts: Record<number, { count: number; unread: number }> = {};
    if (!ids.length) return counts;
    const marks = new Map(
      viewer
        ? db.select({ id: ${reads}.recordId, at: ${reads}.readAt }).from(${reads}).where(and(eq(${reads}.userId, viewer.id), inArray(${reads}.recordId, ids))).all().map((r) => [r.id, r.at.getTime()])
        : [],
    );
    const target = ${tableRef(threadTarget)};
    for (const m of db.select({ parent: target.${dataKey(threadRef)}, at: target.createdAt, by: target.${ownerKey(threadTarget)} }).from(target).where(${threadTarget.trash ? `and(inArray(target.${dataKey(threadRef)}, ids), isNull(target.deletedAt))` : `inArray(target.${dataKey(threadRef)}, ids)`}).all()) {
      if (m.parent === null) continue;
      const c = (counts[m.parent] ??= { count: 0, unread: 0 });
      c.count++;
      if (viewer && m.by !== viewer.id && m.at.getTime() > (marks.get(m.parent) ?? 0)) c.unread++;
    }
    return counts;
  },

  /** The ${n.pluralLabel.toLowerCase()} with a message the viewer has not read, as a list's condition. */
  unread(viewer: Viewer | null): SQL {
    if (!viewer) return sql\`false\`;
    const target = ${tableRef(threadTarget)};
    // Not correlated: a list's relational query names the outer table its own way.
    const fresh = db
      .select({ id: target.${dataKey(threadRef)} })
      .from(target)
      .leftJoin(${reads}, and(eq(${reads}.recordId, target.${dataKey(threadRef)}), eq(${reads}.userId, viewer.id)))
      .where(and(isNotNull(target.${dataKey(threadRef)}),${threadTarget.trash ? " isNull(target.deletedAt)," : ""} or(isNull(target.${ownerKey(threadTarget)}), ne(target.${ownerKey(threadTarget)}, viewer.id)), gt(target.createdAt, sql\`coalesce(\${${reads}.readAt}, 0)\`)));
    return inArray(${n.table}.id, fresh) as SQL;
  },
`
    : ""
}${
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
    const ${ownedAuto ? "found" : "rows"} = ${self}.shownRefs(viewer, await db.query.${n.tableKey}.findMany({
      where: and(${self}.readable(viewer), where),${withClause(listWith, "      ")}
      orderBy: (t, { desc }) => [${ordered ? "...(order ? [order] : []), " : ""}desc(t.id)],${capped ? "\n      limit," : ""}
    }));${ownedAuto ? "\n    const rows = found.map((row) => shownTo(viewer, row));" : ""}
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
    const ${ownedAuto ? "found" : "rows"} = ${self}.shownRefs(viewer, await db.query.${n.tableKey}.findMany({
      where: condition,${withClause(listWith, "      ")}
      orderBy: (t, { desc }) => [...(order ? [order] : []), desc(t.id)],
      limit: size,
      offset: (at - 1) * size,
    }));${ownedAuto ? "\n    const rows = found.map((row) => shownTo(viewer, row));" : ""}
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
    const ${ownedAuto ? "found" : "rows"} = ${self}.shownRefs(viewer, await db.query.${n.tableKey}.findMany({
      where: condition,${withClause(listWith, "      ")}
      orderBy: (t, { desc }) => [...(order ? [order] : []), desc(t.id)],
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
    }));${ownedAuto ? "\n    const rows = found.map((row) => shownTo(viewer, row));" : ""}
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
      return best ? { id: best.id as number, title: ${shownTitle(model, `best.${titleColumn}`)} } : null;
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
    return row ? { id: row.id, title: ${shownTitle(model, "row.title")} } : null;
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
      const titles = titlesOf(viewer, by, rows.map((r) => r.value).filter((v): v is number => typeof v === "number"));
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
      .map((row) => ({ id: row.id, title: ${shownTitle(model, "row.title")} }));
  },

  /** Every ${titleColumn} the viewer may read (at most 2,000): the nearest when a name fits none. */
  titles(viewer: Viewer | null): string[] {
    return db
      .select({ title: ${n.table}.${titleColumn} })
      .from(${n.table})
      .where(${self}.readable(viewer))
      .limit(2000)
      .all()
      .map((row) => ${shownTitle(model, "row.title")});
  },

`
    : ""
}  /** Why \`where\` found none when it names a text no record has: the field's nearest values. */
  whyNone(viewer: Viewer | null, where: unknown): string | undefined {
    if (!where || typeof where !== "object") return undefined;
    for (const [name, v] of Object.entries(where)) {
      const field = FILTERABLE[name];
      if (field?.kind !== "text" || (typeof v !== "string" && typeof v !== "number")) continue;
      const values = db
        .selectDistinct({ v: sql<string>\`\${field.column}\` })
        .from(${n.table})
        .where(and(${self}.readable(viewer), isNotNull(field.column)))
        .limit(2000)
        .all()
        .map((row) => String(row.v));
      const asked = String(v);
      if (values.length && !values.some((x) => x.toLowerCase().includes(asked.toLowerCase())))
        return \`No ${n.label.toLowerCase()} has "\${asked}" in \${name}; the nearest: \${nearest(asked, values).join(", ")}.\`;
    }
    return undefined;
  },

  /** The condition for records the viewer may read that fit \`where\` and \`search\`. */
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
    const fetched = await db.query.${n.tableKey}.findFirst({
      where: and(eq(${n.table}.id, id), ${self}.readable(viewer)),${withClause(getWith, "      ")}
    });
    const ${ownedAuto || ownedLists.length ? "found" : "row"} = fetched && ${shownOne("fetched")};${
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
    return { ...${compute(`{ ...${veils.length ? "veiled(viewer, [row])[0]" : "row"}, ${hiddenTotals.map((l) => `${l}: all?.${l} ?? []`).join(", ")} }`)}, ${hiddenTotals.map((l) => `${l}: row.${l}`).join(", ")} };`
    : `    return row ? ${compute(veils.length ? "veiled(viewer, [row])[0]" : "row")} : null;`
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
}  async create(viewer: Viewer | null, values: ${n.values}${orderPage ? ", lines?: { id: number; quantity: number }[]" : ""}) {
    check(${n.access}.create, viewer);
${
  access.create.public
    ? `    // Visitors add these without an account: at most ${VISITOR_ROWS.toLocaleString("en")} of theirs, so a flood stops here.
    const made = db.select({ n: count() }).from(${n.table})${signedIn ? `.where(isNull(${n.table}.${owner}))` : ""}.get();
    if (viewer === null && (made?.n ?? 0) >= ${VISITOR_ROWS}) throw new AccessDenied(false);
`
    : ""
}${uploadFields.length ? "    values = checkFiles(viewer, values);\n" : ""}${refs.length ? "    checkReferences(viewer, values);\n" : ""}${createRules}    let row: typeof ${n.table}.$inferSelect;
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
  /** Changes the fields given; what names the action ("changed" for a form), frees the fields it may change although locked (its own set). */
  async update(viewer: Viewer | null, id: number, values: Partial<${n.values}>, what = "changed", frees: readonly string[] = []) {
    const row = db
      .select(${selectOwner})
      .from(${n.table})
      .where(and(eq(${n.table}.id, id), ${self}.readable(viewer)))
      .get();
    if (!row) throw new AccessDenied(viewer !== null);
    check(${n.access}.write, viewer, ${ownerOf});
${uploadFields.length ? `    values = checkFiles(viewer, values, db.select({ ${uploadFields.map((f) => `${dataKey(f)}: ${n.table}.${dataKey(f)}`).join(", ")} }).from(${n.table}).where(eq(${n.table}.id, id)).get());\n` : ""}${refs.length ? "    checkReferences(viewer, values);\n" : ""}${loadComputed}    let changed: typeof ${n.table}.$inferSelect;
    const updated = ${
      model.ownedBy && signedIn
        ? ownerRequired
          ? `{ ...values, ${owner}: ownerFor(viewer, values.${owner} ?? row.${owner}) }`
          : // A change keeps who is in it, as given: left out the record's own, empty stays empty (a
            // writer never takes it by changing it); anyone else changes only their own.
            `{ ...values, ${owner}: viewer && ${n.access}.write.roles.includes(viewer.role) ? (values.${owner} === undefined ? row.${owner} : values.${owner}) : personOf(viewer) }`
        : "values"
    };
    try {
      changed = db.transaction((tx) => {${capacity || holds.length ? `${capacityCheck("id")}${holdChecks.join("")}` : ""}
        // Read again in the change itself: a record that left the viewer's reach meanwhile is refused.
        const before = tx.select().from(${n.table}).where(and(eq(${n.table}.id, id), ${self}.readable(viewer))).get();
        if (!before) throw new AccessDenied(viewer !== null);${updateRules}
        const after = tx.update(${n.table}).set(updated).where(eq(${n.table}.id, id)).returning().get();
        audit(tx, viewer, { action: what, model: "${model.name}", record: id, fields: before && changedFields(before, after, Object.keys(updated)${computedKeys.length ? `.filter((k) => !${literal(computedKeys)}.includes(k))` : ""}) });${queue("id", "before", "after")}${tell("what", "after", "before")}
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

  /** Deletes the record; \`together\` takes the records that point to it along to the trash (delete-together.md). */
  async remove(viewer: Viewer | null, id: number, ${together && group.length ? "" : "_"}together = false): Promise<void> {
    const row = db
      .select(${selectTitled})
      .from(${n.table})
      .where(and(eq(${n.table}.id, id), ${self}.readable(viewer)))
      .get();
    if (!row) throw new AccessDenied(viewer !== null);
    check(${n.access}.delete, viewer, ${ownerOf});
    try {
      db.transaction((tx) => {
        // Read again in the change itself: a record that left the viewer's reach meanwhile is refused.
        if (!tx.select({ id: ${n.table}.id }).from(${n.table}).where(and(eq(${n.table}.id, id), ${self}.readable(viewer))).get())
          throw new AccessDenied(viewer !== null);
${groupCheck("id", "row", "        ")}${trashing ? "        const when = new Date();\n" : ""}        const gone = ${goneBy("id")};
        if (gone) {
          audit(tx, viewer, { action: "${goneAction}", model: "${model.name}", record: id, title: ${longTitle(model) ? `titleOf(gone.${titleKey})` : `gone.${titleKey}`} });${tell('"deleted"', "gone").replace("\n        ", "\n          ")}${groupTrash("id", "          ")}
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
  async removeMany(viewer: Viewer | null, ids: number[], ${together && group.length ? "" : "_"}together = false): Promise<{ deleted: number; skipped: number }> {
    const rows = db
      .select(${signedIn ? selectTitled.replace("{ ", `{ id: ${n.table}.id, `) : selectTitled})
      .from(${n.table})
      .where(and(inArray(${n.table}.id, ids), ${self}.readable(viewer)))
      .all()
      .filter((row) => allows(${n.access}.delete, viewer, ${ownerOf}));
    db.transaction((tx) => {${trashing ? "\n      const when = new Date();" : ""}
      for (const row of rows)
        try {
${groupCheck("row.id", "row", "          ")}          const gone = ${goneBy("row.id")};
          if (gone) {
            audit(tx, viewer, { action: "${goneAction}", model: "${model.name}", record: row.id, title: ${longTitle(model) ? `titleOf(gone.${titleKey})` : `gone.${titleKey}`} });${tell('"deleted"', "gone").replace("\n        ", "\n            ")}${groupTrash("row.id", "            ")}
          }
        } catch (error) {
          const refused = refusal(error);
          throw refused instanceof Conflict && refused.message === "in-use" ? new Conflict(\`in-use:\${row.id}\`) : refused;
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
`;
}

/**
 * The trash's daily emptying, once for the app (docs/design/trash.md): what has been in a trash
 * for thirty days goes for good, the models that point to others first, so a record that goes
 * is pointed to by nothing (docs/design/delete-together.md).
 */
export function trashModule(ir: SpecIR, t: Texts): string {
  // How far a model's required references reach: Customer 0, Order 1, OrderLine 2.
  const reach = (name: string, path: string[]): number =>
    Math.max(
      0,
      ...references(modelNamed(ir, name))
        .filter((f) => f.required && !path.includes(f.type.model))
        .map((f) => 1 + reach(f.type.model, [...path, f.type.model])),
    );
  const models = ir.models
    .filter((m) => m.trash)
    .map((m, i) => ({ m, i, reach: reach(m.name, [m.name]) }))
    .sort((a, b) => b.reach - a.reach || a.i - b.i)
    .map(({ m }) => m);
  return `${HEADER}// The trash's daily emptying (docs/design/trash.md): what has been in a trash for thirty days goes
// for good, the models that point to others first (docs/design/delete-together.md).
import { log } from "#/kit/log.server";
${models.map((m) => `import { ${names(m, t).data} } from "./${kebab(m.name)}.server";`).join("\n")}

/** Empties every trash of what is thirty days old; how many records went. */
export function purgeTrash(now = Date.now()): number {
  let gone = 0;
  for (const [model, data] of [${models.map((m) => `["${m.name}", ${names(m, t).data}]`).join(", ")}] as const) {
    try {
      gone += data.purge(now);
    } catch (error) {
      log.error("The trash could not be emptied", { model, error });
    }
  }
  return gone;
}

// Once a day, a minute after the server starts and then every day, in production.
if (import.meta.env.SSR && import.meta.env.PROD) {
  setTimeout(purgeTrash, 60_000).unref();
  setInterval(purgeTrash, 24 * 60 * 60 * 1000).unref();
}
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
    // Its rules on the record (record-rules.md §1–3); a condition names choice and yes/no fields,
    // whose keys in a row are their names.
    ...(field.byApp ? { byApp: true } : {}),
    ...(field.locked ? { locked: field.locked } : {}),
    ...(field.requiredWhen ? { requiredWhen: field.requiredWhen } : {}),
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

/**
 * Zod refinements that go beyond the column types: formats, required text, bounds. A picture or
 * document is one stored in this model's own folder (`folder`, as src/kit/uploads.ts names it),
 * never a path the browser made up or another model's file.
 */
export function refinement(field: FieldIR, visitors = false, folder = ""): string | undefined {
  const optional = field.required ? "" : ".nullish()";
  const stored = (ext: string) => `z.string().regex(/^${folder}\\/[a-f0-9]{24}\\.${ext}$/)`;
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
      return `z.object({ file: ${stored("webp")}, alt: z.string().trim().max(200), width: z.int().positive(), height: z.int().positive(), generated: z.literal(true).optional(), receipt: z.string().max(64).optional() })${optional}`;
    case "pictures":
      // Several of them, at most the field's maximum.
      return `z.array(z.object({ file: ${stored("webp")}, alt: z.string().trim().max(200), width: z.int().positive(), height: z.int().positive(), generated: z.literal(true).optional(), receipt: z.string().max(64).optional() })).max(${field.max ?? PICTURES_MAX})${optional}`;
    case "file":
      // What src/kit/uploads.ts returned for a document. Its type is shown, never served: the
      // file is sent with the type of its extension (fileHeaders).
      return `z.object({ file: ${stored("[a-z0-9]{2,4}")}, name: z.string().max(200), type: z.string().max(100), size: z.int().nonnegative(), receipt: z.string().max(64).optional() })${optional}`;
    case "files":
      return `z.array(z.object({ file: ${stored("[a-z0-9]{2,4}")}, name: z.string().max(200), type: z.string().max(100), size: z.int().nonnegative(), receipt: z.string().max(64).optional() })).max(${FILES_MAX})${optional}`;
    default:
      return undefined;
  }
}
