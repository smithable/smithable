// Part of the TanStack adapter's generator (generate.ts), split out by concern (C7).

import {
  type AuthIR,
  emptyUx,
  type FieldIR,
  humanize,
  isPicture,
  isPictures,
  isUpload,
  kebab,
  type ModelIR,
  type SpecIR,
  snake,
  storesFiles,
  storesPictures,
  USER_MODEL,
  type UxIR,
  uniqueScope,
} from "@smithable/core";
import { authTables, hasInvitations, hasSignIn } from "./auth.js";
import { samplePeople } from "./dev-door.js";
import { INCOMING_SEEN_TABLE, MAIL_THREADS_TABLE } from "./incoming.js";
import { hasKeys, KEY_TABLE } from "./keys.js";
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
  threadLists,
} from "./shared.js";
import { TIMER_RUNS_TABLE } from "./timers.js";

// ── Database ─────────────────────────────────────────────────────────────────

export function schemaModule(ir: SpecIR, auth: AuthIR, ux: UxIR = emptyUx()): string {
  const imports = new Set(["integer", "sqliteTable"]);
  if (hasSignIn(auth)) for (const i of ["index", "text"]) imports.add(i);
  const tables = ir.models.map((model) => {
    const n = tableNames(model);
    // Where each unique field is unique (docs/design/uniqueness.md): among one owner's records
    // or in the whole app; a number counting up is unique by its nature (orders.md §4).
    const scopeOf = (f: FieldIR) => uniqueScope(f.unique || Boolean(f.sequence), model, auth);
    // A value unique per owner is an index over the owner and the field; with a trash, a unique
    // value is unique among the live records (docs/design/trash.md §2): an index over them, not
    // the column's own constraint.
    const indexed = (f: FieldIR) => scopeOf(f) === "owner" || Boolean(model.trash);
    const reference = (field: FieldIR, target: string, type: string) => {
      const onDelete = field.required ? "restrict" : "set null";
      let expr = `${type}()`;
      if (field.required) expr += ".notNull()";
      if (scopeOf(field) && !indexed(field)) expr += ".unique()";
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
      const { expr, uses } = column({
        ...field,
        unique: Boolean(scopeOf(field)) && !indexed(field),
      });
      imports.add(uses);
      return [`  ${field.name}: ${expr},`];
    });
    if (hasSignIn(auth) && !model.ownedBy)
      columns.push(`  ownerId: text().references(() => user.id, { onDelete: "set null" }),`);
    // The owner's column first for a per-owner value, once when the rule names it itself (ownedBy).
    const on = (fields: FieldIR[], owner: boolean) =>
      [
        ...new Set([
          ...(owner ? [`t.${ownerKey(model)}`] : []),
          ...fields.map((f) => `t.${dataKey(f)}`),
        ]),
      ].join(", ");
    const constraint = (fields: FieldIR[], owner: boolean) =>
      model.trash
        ? `uniqueIndex(${JSON.stringify(`${n.sqlTable}_${fields.map((f) => snake(dataKey(f))).join("_")}_unique`)}).on(${on(fields, owner)}).where(sql\`\${t.deletedAt} is null\`)`
        : `unique().on(${on(fields, owner)})`;
    const alone = model.fields
      .filter((f) => scopeOf(f) && indexed(f) && !(f.type.kind === "relation" && f.type.many))
      .map((f) => constraint([f], scopeOf(f) === "owner"));
    // Fields unique together (docs/design/uniqueness.md), per owner when their scope says so.
    const together = (model.unique ?? []).map((u) =>
      constraint(
        u.fields.map((name) => model.fields.find((f) => f.name === name) as FieldIR),
        uniqueScope(u.scope, model, auth) === "owner",
      ),
    );
    const uniques = [...alone, ...together];
    const perOwner =
      model.fields.some((f) => scopeOf(f) === "owner") ||
      (model.unique ?? []).some((u) => uniqueScope(u.scope, model, auth) === "owner");
    if (uniques.length) imports.add(model.trash ? "uniqueIndex" : "unique");
    // The trash (docs/design/trash.md): when and by whom a record was deleted, and with which
    // record when it went as part of a group (docs/design/delete-together.md); an index over the
    // live records only keeps every reader as fast as without it.
    const trash = model.trash
      ? `
  /** In the trash since, and by whom (docs/design/trash.md); live records have neither. */
  deletedAt: integer({ mode: "timestamp_ms" }),
  deletedBy: text(),
  /** The record it went to the trash with ("Customer:12"), restored with it (docs/design/delete-together.md). */
  deletedWith: text(),`
      : "";
    const live = model.trash
      ? [
          `index(${JSON.stringify(`${n.sqlTable}_live`)}).on(t.${hasSignIn(auth) || model.ownedBy ? ownerKey(model) : "id"}).where(sql\`\${t.deletedAt} is null\`)`,
          `index(${JSON.stringify(`${n.sqlTable}_deleted_with`)}).on(t.deletedWith).where(sql\`\${t.deletedWith} is not null\`)`,
        ]
      : [];
    const coveredOwner = Boolean(model.trash || (perOwner && uniques.length));
    const foreignKeys = [
      ...new Set([
        ...((hasSignIn(auth) || model.ownedBy) && !coveredOwner ? [ownerKey(model)] : []),
        ...model.fields
          .filter((f) => f.type.kind === "relation" && !f.type.many && !f.unique)
          .map((f) => `${f.name}Id`)
          .filter((col) => !(coveredOwner && col === ownerKey(model))),
      ]),
    ];
    if (foreignKeys.length) imports.add("index");
    const foreignIndexes = foreignKeys.map(
      (col) => `index(${JSON.stringify(`${n.sqlTable}_${snake(col)}_idx`)}).on(t.${col})`,
    );
    if (model.trash) imports.add("text");
    const extras = [...uniques, ...foreignIndexes, ...live];
    const body = `{
  id: integer().primaryKey({ autoIncrement: true }),
${columns.join("\n")}
  createdAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer({ mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),${trash}
}`;
    return extras.length
      ? `${perOwner ? "// Values unique per owner are unique among one owner's records (docs/design/uniqueness.md).\n" : ""}export const ${n.table} = sqliteTable(
  ${JSON.stringify(n.sqlTable)},
  ${indent(body, 2)},
  (t) => [${extras.join(", ")}],
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
  // Each viewer's read marks on a record whose page shows a conversation (conversation.md §2):
  // when they last read it, for its unread badge; one per person and record, gone with either.
  for (const model of ir.models.filter(
    (m) => hasSignIn(auth) && threadLists(m, ir, ux).length > 0,
  )) {
    const n = tableNames(model);
    imports.add("unique");
    tables.push(`// When each person last read a record's conversation: their own, never shown to others.
export const ${n.table}Reads = sqliteTable(
  ${JSON.stringify(`${n.sqlTable}_reads`)},
  {
    id: integer().primaryKey({ autoIncrement: true }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    recordId: integer()
      .notNull()
      .references(() => ${n.table}.id, { onDelete: "cascade" }),
    readAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
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
  if (ir.timers.length) imports.add("uniqueIndex");
  const pictures = ir.models.some((m) => m.fields.some(storesPictures));
  const documents = ir.models.some((m) => m.fields.some(storesFiles));
  const stored = [...(pictures ? ["Picture"] : []), ...(documents ? ["StoredFile"] : [])];
  const trashed = ir.models.some((m) => m.trash);
  const orm = [...(relationBlocks.length ? ["relations"] : []), ...(trashed ? ["sql"] : [])];
  return `${HEADER}${orm.length ? `import { ${orm.join(", ")} } from "drizzle-orm";\n` : ""}import { ${[...imports].sort().join(", ")} } from "drizzle-orm/sqlite-core";
${stored.length ? `import type { ${stored.join(", ")} } from "#/kit/uploads";\n` : ""}
${[...authBlock, AUDIT_TABLE, ...(ir.models.some((m) => m.review) ? [FILE_REVIEW_TABLE] : []), ...(ir.models.some((m) => m.fields.some(isUpload)) ? [UPLOADS_TABLE] : []), ...(hasKeys(ir, auth) ? [KEY_TABLE] : []), ...(ir.outgoing.length ? [OUTGOING_TABLE, OUTGOING_CALL_TABLE] : []), ...(ir.timers.length ? [TIMER_RUNS_TABLE] : []), ...(ir.incoming.length ? [INCOMING_SEEN_TABLE] : []), ...(ir.incoming.some((i) => i.reply) ? [MAIL_THREADS_TABLE] : []), ...(ir.models.some((m) => m.fields.some((f) => f.sequence)) ? [SEQUENCES_TABLE] : []), ...tables, ...relationBlocks].join("\n\n")}
`;
}

/**
 * Who changed what (docs/design/logging.md §3.3), in every app: written by src/kit/audit.server.ts
 * in the change's own transaction, never edited by the app.
 */
/**
 * The counters of the numbers counting up (`sequence: true`, docs/design/orders.md §4): one row per
 * field, or per field and owner where it is unique per owner, advanced by src/kit/sequence.server.ts
 * in the record's own transaction; a number is never given twice.
 */
const SEQUENCES_TABLE = `export const sequences = sqliteTable("sequences", {
  /** "Order.number", or "Order.number:<owner id>" where the number is unique per owner. */
  key: text().primaryKey(),
  /** The last number given. */
  last: integer().notNull(),
});`;

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

/**
 * Uploads that wait for review (docs/design/file-review.md): one row per file a person sent to a
 * reviewed field. Pending until a reviewer decides; a file with no row (sample data, files from
 * before review was turned on, a reviewer's own) is not held. Kept thirty days after the decision.
 */
/**
 * Files stored for a record that is not saved yet (docs/design/attachments.md §6): who uploaded
 * each one, for which field, and the receipt its upload gave. A record takes a new file only with
 * its receipt (src/kit/receipts.server.ts).
 */
const UPLOADS_TABLE = `export const uploads = sqliteTable(
  "uploads",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    /** The stored file's name under uploads/ (src/kit/uploads.ts). */
    file: text().notNull(),
    model: text().notNull(),
    field: text().notNull(),
    /** Who uploaded it; nothing for a visitor. */
    uploader: text(),
    receipt: text().notNull(),
    at: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("uploads_receipt").on(t.receipt), index("uploads_at").on(t.at)],
);`;

const FILE_REVIEW_TABLE = `export const fileReviews = sqliteTable(
  "file_reviews",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    model: text().notNull(),
    recordId: integer().notNull(),
    field: text().notNull(),
    /** The stored file's name under uploads/ (src/kit/uploads.ts). */
    file: text().notNull(),
    /** pending, approved or rejected. */
    state: text().notNull().default("pending"),
    /** Why it was rejected, shown to the uploader on the record. */
    reason: text(),
    uploadedBy: text(),
    uploadedAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    decidedBy: text(),
    decidedAt: integer({ mode: "timestamp_ms" }),
  },
  (t) => [
    index("file_reviews_record").on(t.model, t.recordId, t.state),
    index("file_reviews_state").on(t.state, t.uploadedAt),
  ],
);`;

/**
 * Outgoing mail (docs/design/integrations.md §4.1b): written by the change's own transaction,
 * sent after it by src/kit/outgoing.server.ts.
 */
const OUTGOING_TABLE = `export const outgoingMail = sqliteTable(
  "outgoing_mail",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    createdAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    /** The outgoing entry's name in smithable.yml. */
    entry: text().notNull(),
    /** The record told about; none for a custom action's or custom code's (integrations.md §4.3). */
    model: text(),
    recordId: integer(),
    to: text().notNull(),
    subject: text().notNull(),
    text: text().notNull(),
    /** A thread mail's headers (docs/design/mail-threads.md §4): its own id, what it answers, the thread. */
    messageId: text(),
    inReplyTo: text(),
    references: text(),
    replyTo: text(),
    tries: integer().notNull().default(0),
    nextAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    sentAt: integer({ mode: "timestamp_ms" }),
    /** Given up after a day of tries; "Send again" in Activity clears it. */
    failedAt: integer({ mode: "timestamp_ms" }),
    error: text(),
  },
  (t) => [index("outgoing_mail_due").on(t.sentAt, t.failedAt, t.nextAt)],
);`;

/**
 * Calls to named targets (docs/design/integrations.md §4.1), signed with the target's secret:
 * written by the change's own transaction, sent after it by src/kit/outgoing.server.ts.
 */
const OUTGOING_CALL_TABLE = `export const outgoingCall = sqliteTable(
  "outgoing_call",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    createdAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    entry: text().notNull(),
    /** The record told about; none for a custom action's or custom code's (integrations.md §4.3). */
    model: text(),
    recordId: integer(),
    /** The target's name; its address and secret are OUTGOING_<TARGET>_URL and _SECRET. */
    target: text().notNull(),
    body: text().notNull(),
    tries: integer().notNull().default(0),
    nextAt: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
    sentAt: integer({ mode: "timestamp_ms" }),
    failedAt: integer({ mode: "timestamp_ms" }),
    /** The answer's status, or why there was none. */
    status: integer(),
    error: text(),
  },
  (t) => [index("outgoing_call_due").on(t.sentAt, t.failedAt, t.nextAt)],
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
      case "file":
        // The stored document, the name it was sent with, its kind and size, as JSON.
        expr = `text({ mode: "json" }).$type<StoredFile>()`;
        break;
      case "files":
        expr = `text({ mode: "json" }).$type<StoredFile[]>()`;
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
  // A generated reference points at one of the related model's rows: a sample file may have
  // fewer than the generated ones (a starter's four clients).
  if (!own)
    return sampleRows(model).map((row) => {
      for (const field of model.fields) {
        const rows = field.type.kind === "relation" && options.samples?.[field.type.model];
        const id = row[field.name];
        if (rows && typeof id === "number")
          row[field.name] = rows.length ? ((id - 1) % rows.length) + 1 : null;
      }
      return row;
    });
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

export function seedModule(
  ir: SpecIR,
  options: Pick<GenerateOptions, "samples" | "people"> &
    Partial<Pick<GenerateOptions, "auth">> = {},
): string {
  // A record that must refer to a user cannot be invented, nor can records that need it; nor
  // a person's place (a model with a capacity): every place stays free. Nor bookings of someone's
  // time or their time away (appointments.md): every free time stays free.
  const skipped = new Set<string>(
    ir.models
      .filter((m) => m.capacity || m.occupies)
      .map((m) => m.name)
      .concat(ir.models.flatMap((m) => (m.schedule?.away ? [m.schedule.away.model] : []))),
  );
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
        // A sample file's picture an AI made says so (generated: true); the numbered ones are.
        const sample = (picture: string | number, alt: string, generated?: true) =>
          `samplePicture(${JSON.stringify(kebab(model.name))}, ${JSON.stringify(picture)}, ${JSON.stringify(alt)}${generated ? ", true" : ""})`;
        if (isPicture(field) && own && typeof own === "object" && "picture" in own)
          return `${dataKey(field)}: ${sample(own.picture, own.alt, own.generated)}`;
        if (isPictures(field) && Array.isArray(own))
          return `${dataKey(field)}: [${own.map((p) => sample(p.picture, p.alt, p.generated)).join(", ")}].filter((p) => p !== null)`;
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
    // A required picture may have no sample to come from: such a row is left out, not inserted
    // without its picture (the column refuses it, and the types would too).
    const needed = model.fields.filter((f) => isPicture(f) && f.required).map(dataKey);
    if (needed.length)
      return `if (db.select().from(schema.${n.table}).limit(1).all().length === 0) {
  type Row = typeof schema.${n.table}.$inferInsert;
  const rows: (Omit<Row, ${needed.map((k) => JSON.stringify(k)).join(" | ")}> & { ${needed.map((k) => `${k}: Picture | null`).join("; ")} })[] = [
${rows.map((r) => `  ${r}`).join("\n")}
  ];
  const pictured = rows.filter((r) => ${needed.map((k) => `r.${k} !== null`).join(" && ")}) as Row[];
  if (pictured.length) db.insert(schema.${n.table}).values(pictured).run();
}`;
    return `if (db.select().from(schema.${n.table}).limit(1).all().length === 0) {
  db.insert(schema.${n.table})
    .values([
${rows.join("\n")}
    ])
    .run();
}`;
  });
  // The sample users (samples/people.yml), in an app where people sign in: users of the
  // development database who sign in nowhere; the development door acts as them.
  const people = options.auth && hasSignIn(options.auth) ? samplePeople(options.people) : [];
  if (people.length)
    blocks.unshift(`// Only where the door that acts as them is (src/generated/people.ts): a seeded production
// database holds no user nobody controls.
if (process.env.NODE_ENV !== "production" || process.env.DEMO_SIGN_IN === "1") {
  db.insert(schema.user)
    .values([
${people.map((u) => `      { id: ${JSON.stringify(u.id)}, name: ${JSON.stringify(u.name)}, email: ${JSON.stringify(u.email)}, emailVerified: true, role: ${JSON.stringify(u.role)} },`).join("\n")}
    ])
    .onConflictDoNothing()
    .run();
}`);
  // Only when a sample row has a picture: samples may leave every picture out.
  const pictures = blocks.some((b) => b.includes("samplePicture("));
  // A model that needs a person who signs in gets no sample rows; with no rows at all, the seed
  // has nothing to import.
  return `${HEADER}// Sample data for development. Run with \`pnpm db:seed\`; tables that already have rows are left alone.
${blocks.length ? 'import { db } from "./index";\n' : ""}${tables.length || people.length ? 'import * as schema from "./schema";\n' : ""}${pictures ? `import { ${blocks.some((b) => b.includes(": Picture")) ? "type Picture, " : ""}samplePicture } from "#/kit/uploads";\n` : ""}${
  // The calendar's helper, only when a sample is moved with it (a skipped model moves none).
  blocks.some((b) => b.includes("aroundToday("))
    ? `import { app } from "#/generated/app";
import { ${blocks.some((b) => b.includes("instantOf(")) ? "instantOf, wallTime" : "wallTime"} } from "#/kit/zoned";

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
