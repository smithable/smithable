// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).

import {
  type AuthIR,
  type FieldIR,
  humanize,
  isPicture,
  isPictures,
  kebab,
  type ModelIR,
  type SpecIR,
  storesPictures,
  USER_MODEL,
  uniquePerOwner,
} from "@smithable/core";
import { authTables, hasInvitations, hasSignIn } from "./auth.js";
import { calendarStart } from "./pages/calendar.js";
import { sampleRows } from "./sample-data.js";
import {
  dataKey,
  type GenerateOptions,
  HEADER,
  hasFavorites,
  indent,
  literal,
  modelNamed,
  ownerKey,
  references,
  storedFields,
  tableNames,
} from "./shared.js";

// ── Database ─────────────────────────────────────────────────────────────────

export function schemaModule(ir: SpecIR, auth: AuthIR): string {
  const imports = new Set(["integer", "sqliteTable"]);
  if (hasSignIn(auth)) for (const i of ["index", "text"]) imports.add(i);
  const tables = ir.models.map((model) => {
    const n = tableNames(model);
    const perOwner = uniquePerOwner(model, auth);
    const reference = (field: FieldIR, target: string, type: string) => {
      const onDelete = field.required ? "restrict" : "set null";
      let expr = `${type}()`;
      if (field.required) expr += ".notNull()";
      if (field.unique && !perOwner) expr += ".unique()";
      // Tables that refer to each other (or to themselves) need the column's type said, as
      // Drizzle's docs show, or TypeScript cannot infer either table.
      const cycle =
        field.type.kind === "relation" &&
        field.type.model !== USER_MODEL &&
        reaches(ir, field.type.model, model.name);
      if (cycle) imports.add("type AnySQLiteColumn");
      return `${expr}.references(${cycle ? "(): AnySQLiteColumn" : "()"} => ${target}.id, { onDelete: ${JSON.stringify(onDelete)} })`;
    };
    const columns = model.fields.flatMap((field) => {
      if (field.type.kind === "relation") {
        if (field.type.many) return [];
        const isUser = field.type.model === USER_MODEL;
        if (isUser) imports.add("text");
        const target = isUser ? "user" : tableNames(modelNamed(ir, field.type.model)).table;
        return [`  ${field.name}Id: ${reference(field, target, isUser ? "text" : "integer")},`];
      }
      const { expr, uses } = column(perOwner ? { ...field, unique: false } : field);
      imports.add(uses);
      return [`  ${field.name}: ${expr},`];
    });
    if (hasSignIn(auth) && !model.ownedBy)
      columns.push(`  ownerId: text().references(() => user.id, { onDelete: "set null" }),`);
    const uniques = perOwner
      ? model.fields
          .filter((f) => f.unique)
          .map((f) => `unique().on(t.${ownerKey(model)}, t.${dataKey(f)})`)
      : [];
    if (uniques.length) imports.add("unique");
    const body = `{
  id: integer().primaryKey({ autoIncrement: true }),
${columns.join("\n")}
  createdAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer({ mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}`;
    return uniques.length
      ? `// Records are private to their owner, so unique values are unique per owner.
export const ${n.table} = sqliteTable(
  ${JSON.stringify(n.sqlTable)},
  ${indent(body, 2)},
  (t) => [${uniques.join(", ")}],
);`
      : `export const ${n.table} = sqliteTable(${JSON.stringify(n.sqlTable)}, ${body});`;
  });
  // Each viewer's own marks (marketplace.md §2.3): one per person and record, gone with either.
  for (const model of ir.models.filter((m) => hasFavorites(m, ir, auth))) {
    const n = tableNames(model);
    imports.add("unique");
    tables.push(`// The records people marked as favorites: each person's own, never shown to others.
export const ${n.table}Favorites = sqliteTable(
  ${JSON.stringify(`${n.sqlTable}_favorites`)},
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recordId: integer()
      .notNull()
      .references(() => ${n.table}.id, { onDelete: "cascade" }),
    createdAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [unique().on(t.userId, t.recordId)],
);`);
  }
  const relationBlocks = ir.models.flatMap((model) => {
    const n = tableNames(model);
    const entries = model.fields.flatMap((field) => {
      if (field.type.kind !== "relation") return [];
      const target =
        field.type.model === USER_MODEL
          ? "user"
          : tableNames(modelNamed(ir, field.type.model)).table;
      return field.type.many
        ? [`  ${field.name}: many(${target}),`]
        : [
            `  ${field.name}: one(${target}, { fields: [${n.table}.${field.name}Id], references: [${target}.id] }),`,
          ];
    });
    if (entries.length === 0) return [];
    const helpers = ["one", "many"].filter((h) => entries.some((e) => e.includes(`${h}(`)));
    return [
      `export const ${n.table}Relations = relations(${n.table}, ({ ${helpers.join(", ")} }) => ({\n${entries.join("\n")}\n}));`,
    ];
  });
  const authBlock = hasSignIn(auth) ? [authTables(auth, hasInvitations(ir, auth))] : [];
  for (const used of ["index", "integer", "text"]) imports.add(used);
  const pictures = ir.models.some((m) => m.fields.some(storesPictures));
  return `${HEADER}${relationBlocks.length ? 'import { relations } from "drizzle-orm";\n' : ""}import { ${[...imports].sort().join(", ")} } from "drizzle-orm/sqlite-core";
${pictures ? 'import type { Picture } from "#/kit/uploads";\n' : ""}
${[...authBlock, AUDIT_TABLE, ...tables, ...relationBlocks].join("\n\n")}
`;
}

/**
 * Who changed what (docs/design/logging.md §3.3), in every app: written by src/kit/audit.server.ts
 * in the change's own transaction, never edited by the app.
 */
const AUDIT_TABLE = `export const auditLog = sqliteTable(
  "audit_log",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    at: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    trace: text(),
    /** A user's id, a key's name, "visitor", or "the app" for its own work. */
    who: text().notNull(),
    role: text(),
    address: text(),
    browser: text(),
    /** created, changed, deleted, copied, or an action's name. */
    action: text().notNull(),
    model: text(),
    recordId: integer(),
    title: text(),
    fields: text({ mode: "json" }).$type<string[]>(),
    details: text({ mode: "json" }).$type<Record<string, unknown>>(),
  },
  (t) => [index("audit_log_at").on(t.at), index("audit_log_record").on(t.model, t.recordId)],
);`;

export function column(field: FieldIR): { expr: string; uses: string } {
  let expr: string;
  let uses = "text";
  if (field.type.kind === "relation") throw new Error("References are columns of their own.");
  if (field.type.kind === "choice") {
    expr = `text({ enum: ${literal(field.type.values)} })`;
  } else {
    switch (field.type.name) {
      case "int":
      case "money":
        uses = "integer";
        expr = "integer()";
        break;
      case "decimal":
        uses = "real";
        expr = "real()";
        break;
      case "bool":
        uses = "integer";
        expr = `integer({ mode: "boolean" })`;
        break;
      case "datetime":
        uses = "integer";
        expr = `integer({ mode: "timestamp_ms" })`;
        break;
      case "picture":
        // The stored file, its description and size (src/kit/uploads.ts), as JSON.
        expr = `text({ mode: "json" }).$type<Picture>()`;
        break;
      case "pictures":
        // Several of them, the first the cover.
        expr = `text({ mode: "json" }).$type<Picture[]>()`;
        break;
      default:
        expr = "text()";
    }
  }
  if (field.required) expr += ".notNull()";
  if (field.unique) expr += ".unique()";
  if (field.default !== undefined) {
    if (field.type.kind === "scalar" && field.type.name === "datetime") {
      expr += `.$defaultFn(() => new Date(${JSON.stringify(field.default)}))`;
    } else if (field.type.kind === "scalar" && field.type.name === "money") {
      expr += `.default(${Math.round(Number(field.default) * 100)})`;
    } else {
      expr += `.default(${JSON.stringify(field.default)})`;
    }
  }
  return { expr, uses };
}

/**
 * A model's rows for the seed: its sample file's (samples/<Model>.yml) when it has one, with a
 * date and time read as written, or generated ones.
 */
function seedRows(model: ModelIR, options: Pick<GenerateOptions, "samples">) {
  const own = options.samples?.[model.name];
  if (!own) return sampleRows(model);
  return own.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([name, value]) => {
        const field = model.fields.find((f) => f.name === name);
        return [
          name,
          field?.type.kind === "scalar" &&
          field.type.name === "datetime" &&
          typeof value === "string"
            ? `${value}:00Z`
            : value,
        ];
      }),
    ),
  );
}

export function seedModule(ir: SpecIR, options: Pick<GenerateOptions, "samples"> = {}): string {
  // A record that must refer to a user cannot be invented, nor can records that need it; nor
  // a person's place (a model with a capacity): every place stays free.
  const skipped = new Set<string>(ir.models.filter((m) => m.capacity).map((m) => m.name));
  for (const model of dependencyOrder(ir.models)) {
    const needs = model.fields.filter((f) => f.required && f.type.kind === "relation");
    if (
      needs.some(
        (f) =>
          (f.type as { model: string }).model === USER_MODEL ||
          skipped.has((f.type as { model: string }).model),
      )
    )
      skipped.add(model.name);
  }
  const ordered = dependencyOrder(ir.models).filter((m) => !skipped.has(m.name));
  const tables = ordered.map((m) => tableNames(m).table);
  const blocks = ordered.map((model) => {
    const n = tableNames(model);
    // A calendar's records are placed around the day the samples are loaded, never an empty week.
    const start = calendarStart(model, ir);
    const rows = seedRows(model, options).map((row, i) => {
      const entries = storedFields(model).map((field) => {
        // A sample file's picture: its file under public/images/samples/, and its description.
        const own = row[field.name];
        const sample = (picture: string | number, alt: string) =>
          `samplePicture(${JSON.stringify(kebab(model.name))}, ${JSON.stringify(picture)}, ${JSON.stringify(alt)})`;
        if (isPicture(field) && own && typeof own === "object" && "picture" in own)
          return `${dataKey(field)}: ${sample(own.picture, own.alt)}`;
        if (isPictures(field) && Array.isArray(own))
          return `${dataKey(field)}: [${own.map((p) => sample(p.picture, p.alt)).join(", ")}].filter((p) => p !== null)`;
        // A sample file's row without a field that has a default (one added since) gets the
        // default, as the form would: a required choice cannot be empty.
        const given =
          own === undefined && options.samples?.[model.name] && field.default !== undefined
            ? field.default
            : own;
        const value = sampleLiteral(field, given);
        // A sample picture from public/images/samples/, when the app ships any.
        if (storesPictures(field) && options.samples?.[model.name])
          return `${dataKey(field)}: null`;
        const title = Object.values(row).find((v) => typeof v === "string" && /\s/.test(v));
        const alt = `A picture of ${title ?? `${humanize(model.name).toLowerCase()} ${i + 1}`}`;
        if (isPicture(field)) return `${dataKey(field)}: ${sample(i % 3, alt)}`;
        // Several pictures: one to three of the starter's, in turn.
        if (isPictures(field))
          return `${dataKey(field)}: [${Array.from({ length: 1 + (i % 3) }, (_, k) => sample((i + k) % 3, alt)).join(", ")}].filter((p) => p !== null)`;
        if (field !== start || value === "null") return `${dataKey(field)}: ${value}`;
        return field.type.kind === "scalar" && field.type.name === "date"
          ? `${dataKey(field)}: aroundToday(new Date(${JSON.stringify(`${row[field.name]}T00:00:00Z`)}), ${i % 2}).slice(0, 10)`
          : `${dataKey(field)}: instantOf(aroundToday(${value}, ${i % 2}), app.timeZone)`;
      });
      return `    { ${entries.join(", ")} },`;
    });
    return `if (db.select().from(${n.table}).limit(1).all().length === 0) {
  db.insert(${n.table})
    .values([
${rows.join("\n")}
    ])
    .run();
}`;
  });
  // Only when a sample row has a picture: samples may leave every picture out.
  const pictures = blocks.some((b) => b.includes("samplePicture("));
  // A model that needs a person who signs in gets no sample rows; with no rows at all, the seed
  // has nothing to import.
  return `${HEADER}// Sample data for development. Run with \`pnpm db:seed\`; tables that already have rows are left alone.
${blocks.length ? 'import { db } from "./index";\n' : ""}${tables.length ? `import { ${tables.join(", ")} } from "./schema";\n` : ""}${pictures ? 'import { samplePicture } from "#/kit/uploads";\n' : ""}${
  ir.pages.some((p) => p.pattern.kind === "calendar")
    ? `import { app } from "#/generated/app";
import { instantOf, wallTime } from "#/kit/zoned";

/**
 * A sample moved to this week (0) or the next (1) in the app's time zone, as a wall time
 * ("2026-09-30T09:00"): the same weekday, and the clock time the sample is written with.
 */
function aroundToday(sample: Date, week: number): string {
  const today = Date.parse(\`\${wallTime(new Date(), app.timeZone).slice(0, 10)}T00:00:00Z\`);
  const monday = today - ((new Date(today).getUTCDay() + 6) % 7) * 86_400_000;
  const day = (sample.getUTCDay() + 6) % 7;
  const moved = new Date(monday + (week * 7 + day) * 86_400_000).toISOString().slice(0, 10);
  return \`\${moved}T\${sample.toISOString().slice(11, 16)}\`;
}
`
    : ""
}
${blocks.join("\n\n")}
`;
}

/** Models ordered so that referenced models come first (for inserting sample data). */
export function dependencyOrder(models: ModelIR[]): ModelIR[] {
  const done: ModelIR[] = [];
  const visit = (model: ModelIR, path: Set<string>) => {
    if (done.includes(model) || path.has(model.name)) return;
    path.add(model.name);
    for (const ref of references(model)) {
      const target = models.find((m) => m.name === ref.type.model);
      if (target && target !== model) visit(target, path);
    }
    done.push(model);
  };
  for (const model of models) visit(model, new Set());
  return done;
}

export function sampleLiteral(field: FieldIR, value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (field.type.kind === "scalar" && field.type.name === "datetime")
    return `new Date(${JSON.stringify(value)})`;
  return JSON.stringify(value);
}

/** Whether records of `from` refer, through references, to records of `to` (or are them). */
function reaches(ir: SpecIR, from: string, to: string, seen = new Set<string>()): boolean {
  if (from === to) return true;
  if (seen.has(from)) return false;
  seen.add(from);
  const model = ir.models.find((m) => m.name === from);
  return Boolean(
    model?.fields.some(
      (f) =>
        f.type.kind === "relation" &&
        !f.type.many &&
        f.type.model !== USER_MODEL &&
        reaches(ir, f.type.model, to, seen),
    ),
  );
}
