// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).

import {
  type AuthIR,
  type FieldIR,
  humanize,
  isPicture,
  kebab,
  type ModelIR,
  type SpecIR,
  USER_MODEL,
} from "@smithable/core";
import { authTables, hasInvitations, hasSignIn } from "./auth.js";
import { calendarStart } from "./pages/calendar.js";
import { sampleRows } from "./sample-data.js";
import {
  dataKey,
  type GenerateOptions,
  HEADER,
  indent,
  literal,
  modelNamed,
  ownerKey,
  references,
  storedFields,
  tableNames,
  uniquePerOwner,
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
      return `${expr}.references(() => ${target}.id, { onDelete: ${JSON.stringify(onDelete)} })`;
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
  const pictures = ir.models.some((m) => m.fields.some(isPicture));
  return `${HEADER}${relationBlocks.length ? 'import { relations } from "drizzle-orm";\n' : ""}import { ${[...imports].sort().join(", ")} } from "drizzle-orm/sqlite-core";
${pictures ? 'import type { Picture } from "#/kit/uploads";\n' : ""}
${[...authBlock, ...tables, ...relationBlocks].join("\n\n")}
`;
}

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
        if (isPicture(field) && own && typeof own === "object" && "picture" in own)
          return `${dataKey(field)}: samplePicture(${JSON.stringify(kebab(model.name))}, ${JSON.stringify(own.picture)}, ${JSON.stringify(own.alt)})`;
        const value = sampleLiteral(field, row[field.name]);
        // A sample picture from public/images/samples/, when the app ships any.
        if (isPicture(field) && options.samples?.[model.name]) return `${dataKey(field)}: null`;
        if (isPicture(field)) {
          const title = Object.values(row).find((v) => typeof v === "string" && /\s/.test(v));
          return `${dataKey(field)}: samplePicture(${JSON.stringify(kebab(model.name))}, ${i % 3}, ${JSON.stringify(`A picture of ${title ?? `${humanize(model.name).toLowerCase()} ${i + 1}`}`)})`;
        }
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
  const pictures = ordered.some((m) => m.fields.some(isPicture));
  return `${HEADER}// Sample data for development. Run with \`pnpm db:seed\`; tables that already have rows are left alone.
import { db } from "./index";
${tables.length ? `import { ${tables.join(", ")} } from "./schema";\n` : ""}${pictures ? 'import { samplePicture } from "#/kit/uploads";\n' : ""}${
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
