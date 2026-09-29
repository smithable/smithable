// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).
import {
  type AuthIR,
  type FieldIR,
  humanize,
  kebab,
  type ModelIR,
  modelAccess,
  type SpecIR,
  USER_MODEL,
  type UxIR,
} from "@smithable/core";
import { hasSignIn } from "./auth.js";
import { aggregatedLists, defaultsName, hasFormulas, withFormulasName } from "./formulas.js";
import {
  code,
  dataKey,
  HEADER,
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
  titleField,
  userFields,
} from "./shared.js";

// ── Models: UI description, validation and server functions ─────────────────

export function modelModule(model: ModelIR, t: Texts, ir: SpecIR, auth: AuthIR, ux: UxIR): string {
  const n = names(model, t);
  const stored = storedFields(model);
  const shown = shownFields(model);
  const formulas = hasFormulas(model);
  const ui = {
    model: model.name,
    label: n.label,
    pluralLabel: n.pluralLabel,
    titleField: titleField(model),
    columns: shown
      .filter((f) => !(f.type.kind === "scalar" && f.type.name === "text"))
      .slice(0, 5)
      .map(dataKey),
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
      const id = f.type.model === USER_MODEL ? "string" : "number";
      return [`${f.name}?: { id: ${id}${title === "id" ? "" : `; ${title}: unknown`} } | null`];
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
  return `${HEADER}import { createServerFn } from "@tanstack/react-start";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { ${n.table} } from "#/db/schema";
import { allows } from "#/kit/access";
import type { RecordUi } from "#/kit/model";
${formulas ? `import { ${defaultsName(model)}, ${withFormulasName(model)} } from "./${kebab(model.name)}.formulas";\n` : ""}import { ${n.access}, ${n.data} } from "./${kebab(model.name)}.server";
import { currentViewer } from "#/lib/viewer.server";

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
      row,
      canWrite: allows(${n.access}.write, viewer${hasSignIn(auth) ? `, row.${owner}` : ""}),
      canDelete: allows(${n.access}.delete, viewer${hasSignIn(auth) ? `, row.${owner}` : ""}),
    };
  });
${options}
export const ${n.create} = createServerFn({ method: "POST" })
  .validator(${n.schema})
  .handler(async ({ data }) => ${n.data}.create(await currentViewer(), data));

export const ${n.update} = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.number().int(), values: ${n.schema} }))
  .handler(async ({ data }) => ${n.data}.update(await currentViewer(), data.id, data.values));

export const ${n.remove} = createServerFn({ method: "POST" })
  .validator(z.number().int())
  .handler(async ({ data: id }) => ${n.data}.remove(await currentViewer(), id));
`;
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
  const refs = references(model);
  for (const ref of refs)
    if (ref.type.model !== model.name) others.add(modelNamed(ir, ref.type.model));
  const withClause = (entries: string[], indent: string) =>
    entries.length ? `\n${indent}with: { ${entries.join(", ")} },` : "";
  const compute = (expr: string) => (formulas ? `${withFormulasName(model)}(${expr})` : expr);
  const titleColumn = titleField(model);
  const referenced = ir.models.some((m) => references(m).some((f) => f.type.model === model.name));
  const access = modelAccess(model, auth);
  const drizzle = [
    "and",
    "eq",
    "sql",
    ...(referenced && titleColumn !== "id" ? ["asc"] : []),
    ...(access.create.public ? ["count"] : []),
    ...(access.create.public && signedIn ? ["isNull"] : []),
  ];
  const ownerOf = signedIn ? `row.${owner}` : "undefined";
  const createValues = !signedIn
    ? "values"
    : model.ownedBy
      ? `{ ...values, ${owner}: ownerFor(viewer, values.${owner}) }`
      : `{ ...values, ownerId: viewer?.id ?? null }`;
  const self = n.data;
  const referenceChecks = refs.map(
    (ref) =>
      `  if (values.${ref.name}Id != null && !${names(modelNamed(ir, ref.type.model), t).data}.canRead(viewer, values.${ref.name}Id))
    throw new AccessDenied(viewer !== null);`,
  );
  const selectOwner = signedIn ? `{ ${owner}: ${n.table}.${owner} }` : `{ id: ${n.table}.id }`;
  return `${HEADER}import { ${drizzle.sort().join(", ")}, type SQL } from "drizzle-orm";
import { db } from "#/db";
import { ${n.table} } from "#/db/schema";
import { AccessDenied, check, type ModelAccess, readScope, refusal, type Viewer } from "#/kit/access";
${referenced && titleColumn !== "id" ? `import { contains } from "#/kit/search";\n` : ""}import { afterChange, afterDelete } from "./hooks";
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
    ${signedIn ? `return scope === "own" && viewer ? eq(${n.table}.${owner}, viewer.id) : sql\`false\`;` : "return sql`false`;"}
  },

  canRead(viewer: Viewer | null, id: number): boolean {
    const found = db
      .select({ id: ${n.table}.id })
      .from(${n.table})
      .where(and(eq(${n.table}.id, id), ${self}.readable(viewer)))
      .get();
    return found !== undefined;
  },

  /** The ${n.pluralLabel.toLowerCase()} the viewer may read; \`where\` narrows them, e.g. to a search. */
  async list(viewer: Viewer | null, where?: SQL) {
    if (readScope(${n.access}.read, viewer) === "none") throw new AccessDenied(viewer !== null);
    const rows = await db.query.${n.table}.findMany({
      where: and(${self}.readable(viewer), where),${withClause(listWith, "      ")}
      orderBy: (t, { desc }) => [desc(t.id)],
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

  async get(viewer: Viewer | null, id: number) {
    const row = await db.query.${n.table}.findFirst({
      where: and(eq(${n.table}.id, id), ${self}.readable(viewer)),${withClause(getWith, "      ")}
    });
    return row ? ${compute("row")} : null;
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
      row = db.insert(${n.table}).values(${createValues}).returning().get();
    } catch (error) {
      throw refusal(error);
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
    try {
      changed = db.update(${n.table}).set(${model.ownedBy && signedIn ? `{ ...values, ${owner}: ownerFor(viewer, values.${owner} ?? row.${owner}) }` : "values"}).where(eq(${n.table}.id, id)).returning().get();
    } catch (error) {
      throw refusal(error);
    }
    await afterChange("afterUpdate", "${model.name}", changed, viewer);
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
    await afterDelete("${model.name}", id, viewer);
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
  };
}

/** Records visitors may add to a model before it takes no more (see create in a data module). */
export const VISITOR_ROWS = 10_000;

/**
 * Longest texts by default, unless the spec gives a `max`: a line, and a longer text; shorter
 * where visitors write it (a contact form's message).
 */
export const TEXT_MAX = { string: 200, text: 10_000, publicText: 2_000 };

/** A text's length rules: required (not only spaces), `min` and `max` characters. */
export function textBounds(field: FieldIR, visitors = false): string {
  const long = visitors ? TEXT_MAX.publicText : TEXT_MAX.text;
  const max =
    field.max ??
    (field.type.kind === "scalar" && field.type.name === "text" ? long : TEXT_MAX.string);
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
      return `(s) => s${textBounds(field, visitors)}`;
    case "int":
    case "decimal":
      return bounds(1) ? `(s) => s${bounds(1)}` : undefined;
    case "money":
      return bounds(100) ? `(s) => s${bounds(100)}` : undefined;
    default:
      return undefined;
  }
}
