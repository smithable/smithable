// Outgoing mail (docs/design/integrations.md §4.1b): the generated module that, inside a change's
// transaction, works out which entries count, whom they mail and what the mail shows, and queues
// it through src/kit/outgoing.server.ts. The data functions and actions call it.
import {
  type ContentIR,
  type FieldIR,
  isUpload,
  type ModelIR,
  type OutgoingIR,
  pageModel,
  type RecipientIR,
  type SpecIR,
  sensitiveKind,
  titleField,
  USER_MODEL,
  type UxIR,
} from "@smithable/core";
import { apiFields, readCode } from "./api.js";
import { fieldUi } from "./data.js";
import {
  HEADER,
  literal,
  modelNamed,
  names,
  ownerKey,
  relatedTitle,
  SCHEMA_IMPORT,
  shownTitle,
  type Texts,
} from "./shared.js";

/** The entries of the outgoing section: mail, and calls to named targets. */
export function outgoingOf(ir: SpecIR): OutgoingIR[] {
  return ir.outgoing;
}

/** Whether a change to the model's records may tell someone: its writes call `outgoing`. */
export function toldAbout(ir: SpecIR, model: string): boolean {
  return outgoingOf(ir).some((o) => o.when.model === model);
}

/** The import line for the data functions and actions of a model that mails. */
export const OUTGOING_IMPORT = 'import { outgoing } from "#/generated/outgoing.server";';

export function outgoingModule(
  ir: SpecIR,
  t: Texts,
  ux: UxIR,
  content: ContentIR | undefined,
): string {
  const entries = outgoingOf(ir);
  const tables = new Set<string>();
  let users = false;
  const value = (target: ModelIR, column: string, id: string) => {
    const n = names(target, t);
    tables.add(n.table);
    // A record in the trash is gone to the mail too: no address, no title (docs/design/trash.md).
    return `one(tx, ${n.table}, ${n.table}.id, ${n.table}.${column}, ${id}${target.trash ? `, ${n.table}.deletedAt` : ""})`;
  };
  const people = (where: string) => {
    users = true;
    return `people(tx, ${where})`;
  };
  // Whom an entry mails, read from the record `r` inside the transaction.
  const recipients = (model: ModelIR, recipient: RecipientIR | undefined): string => {
    if (!recipient || recipient.kind === "owner")
      return `r.${ownerKey(model)} == null ? [] : ${people(`eq(schema.user.id, String(r.${ownerKey(model)}))`)}`;
    if (recipient.kind === "role")
      return people(`eq(schema.user.role, ${JSON.stringify(recipient.role)})`);
    const [first, second] = recipient.path;
    if (!second)
      return recipient.via === "email"
        ? `[{ email: r.${first} as string | null }]`
        : `r.${first}Id == null ? [] : ${people(`eq(schema.user.id, String(r.${first}Id))`)}`;
    const ref = model.fields.find((f) => f.name === first);
    const target = modelNamed(ir, ref?.type.kind === "relation" ? ref.type.model : "");
    return recipient.via === "email"
      ? `[{ email: ${value(target, second, `r.${first}Id`)} as string | null }]`
      : `((id) => (id == null ? [] : ${people("eq(schema.user.id, String(id))")}))(${value(target, `${second}Id`, `r.${first}Id`)})`;
  };
  // The record's fields as its page shows them: labels, formatted values, references by title;
  // nothing a picture or document field holds, nothing sensitive, and no lists of other records.
  const shown = (model: ModelIR) =>
    model.fields
      .filter(
        (f) =>
          !f.formula &&
          !isUpload(f) &&
          // What looks like a card number, a password or an identity number stays in the app.
          !sensitiveKind(f) &&
          !(f.type.kind === "relation" && f.type.many),
      )
      .map((f) => {
        const ui = fieldUi(model, f, t, ir, ux);
        return `      [${JSON.stringify(ui.label)}, ${formatted(f, ui)}],`;
      });
  const formatted = (f: FieldIR, ui: ReturnType<typeof fieldUi>): string => {
    if (f.type.kind !== "relation")
      return `formatValue(${literal({ name: ui.name, label: ui.label, kind: ui.kind, required: false, ...(ui.choices ? { choices: ui.choices.map(({ value, label }) => ({ value, label })) } : {}) })}, r.${f.name}, app)`;
    if (f.type.model === USER_MODEL) {
      users = true;
      return `String(one(tx, schema.user, schema.user.id, schema.user.name, r.${f.name}Id) ?? "—")`;
    }
    const target = modelNamed(ir, f.type.model);
    const title = relatedTitle(ir, target.name);
    return title === "id"
      ? `r.${f.name}Id == null ? "—" : \`#\${r.${f.name}Id}\``
      : `String(${value(target, title, `r.${f.name}Id`)} ?? "—")`;
  };
  const mails = entries.filter((o) => o.to === "mail");
  const calls = entries.filter((o) => o.to !== "mail");
  const modelsOf = (list: OutgoingIR[]) =>
    [...new Set(list.map((o) => o.when.model))].map((m) => modelNamed(ir, m));
  const showers = modelsOf(mails).map((model) => {
    const n = names(model, t);
    const lines = shown(model);
    const title = titleField(model);
    const page = ir.pages.find((p) => p.pattern.kind === "crud" && pageModel(p) === model.name);
    return `  ${JSON.stringify(model.name)}: (${lines.some((l) => /\btx\b/.test(l)) ? "tx" : "_tx"}, r) => ({
    subject: \`${n.label.replace(/[`$\\]/g, "\\$&")}: ${title === "id" ? "#${r.id}" : `\${${shownTitle(model, `r.${title} ?? r.id`)}}`}\`,
    fields: [
${lines.join("\n")}
    ],${page ? `\n    link: \`${page.route === "/" ? "" : page.route}/\${r.id}\`,` : ""}
  }),`;
  });
  // A record as a call sends it: as the API gives it (integrations.md §4.1), without what is
  // worked out on reading or what looks sensitive.
  const senders = modelsOf(calls).map(
    (model) => `  ${JSON.stringify(model.name)}: (row) => ({
    id: row.id,
${apiFields(model)
  .filter((f) => !f.formula && !sensitiveKind(f))
  .map((f) => `    ${f.name}: ${readCode(f)},`)
  .join("\n")}
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  }),`,
  );
  const conditions = (o: OutgoingIR) =>
    o.where
      ? `(r) => ${Object.entries(o.where)
          .map(([k, v]) =>
            Array.isArray(v)
              ? `${literal(v)}.includes(r.${k} as string)`
              : `r.${k} === ${JSON.stringify(v)}`,
          )
          .join(" && ")}`
      : undefined;
  const list = entries.map((o) => {
    const model = modelNamed(ir, o.when.model);
    const words = content?.outgoing?.[o.name];
    const when = "event" in o.when ? o.when.event : o.when.action;
    const fits = conditions(o);
    return `  {
    name: ${JSON.stringify(o.name)},
    model: ${JSON.stringify(o.when.model)},
    when: ${JSON.stringify(when)},${fits ? `\n    fits: ${fits},` : ""}${words?.subject ? `\n    subject: ${JSON.stringify(words.subject)},` : ""}${words?.text ? `\n    text: ${JSON.stringify(words.text)},` : ""}
    ${o.to === "mail" ? `to: (tx, r) => ${recipients(model, o.recipient)},` : `target: ${JSON.stringify(o.to)},`}
  },`;
  });
  const body = [...showers, ...senders, ...list].join("\n");
  const ones = body.includes("one(tx,");
  const trashOne = body.includes(".deletedAt)");
  return `${HEADER}${ones || users ? `import { ${trashOne ? "and, " : ""}eq${trashOne ? ", isNull" : ""}${users ? ", type SQL" : ""} } from "drizzle-orm";\n` : ""}${ones ? 'import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";\n' : ""}import type { db } from "#/db";
${tables.size || users ? `${SCHEMA_IMPORT}\n` : ""}${body.includes("formatValue(") ? 'import { app } from "#/generated/app";\n' : ""}import type { Viewer } from "#/kit/access";
${body.includes("formatValue(") || body.includes("titleOf(") ? `import { ${[...(body.includes("formatValue(") ? ["formatValue"] : []), ...(body.includes("titleOf(") ? ["titleOf"] : [])].join(", ")} } from "#/kit/format";\n` : ""}import { counts } from "#/kit/outgoing";
import { ${[...(mails.length ? ["type Happening"] : []), ...(calls.length ? ["queueCall"] : []), ...(mails.length ? ["queueMail", "type Recipient"] : [])].join(", ")} } from "#/kit/outgoing.server";

type Tx = Pick<typeof db, "select" | "insert">;
type Row = Record<string, unknown>;
${
  ones
    ? `
/** One column of the record with the id, inside the transaction${trashOne ? "; nothing of one in the trash" : ""}. */
function one(tx: Tx, table: SQLiteTable, id: SQLiteColumn, column: SQLiteColumn, value: unknown${trashOne ? ", trashed?: SQLiteColumn" : ""}): unknown {
  if (value == null) return undefined;
  return tx.select({ v: column }).from(table).where(${trashOne ? "trashed ? and(eq(id, value), isNull(trashed)) : eq(id, value)" : "eq(id, value)"}).get()?.v;
}
`
    : ""
}${
  users
    ? `
/** The users that fit, with their addresses. */
function people(tx: Tx, where: SQL): Recipient[] {
  return tx.select({ id: schema.user.id, email: schema.user.email }).from(schema.user).where(where).all();
}
`
    : ""
}${
  mails.length
    ? `
/** Each model's record as a mail shows it: the subject, its fields, its page. */
const SHOWN: Record<string, (tx: Tx, r: Row) => Omit<Happening, "entry" | "model" | "record">> = {
${showers.join("\n")}
};
`
    : ""
}${
  calls.length
    ? `
/** Each model's record as a call sends it: as the API gives it. */
const SENT: Record<string, (row: Row) => Row> = {
${senders.join("\n")}
};
`
    : ""
}
/** The entries of smithable.yml's outgoing section, with their texts. */
const ENTRIES: {
  name: string;
  model: string;
  when: string;
  fits?: (r: Row) => boolean;
  subject?: string;
  text?: string;${mails.length ? "\n  to?: (tx: Tx, r: Row) => Recipient[];" : ""}${calls.length ? "\n  /** A target whose address and secret are settings (OUTGOING_<TARGET>_URL, _SECRET). */\n  target?: string;" : ""}
}[] = [
${list.join("\n")}
];

/**
 * Queues what a change asks for, in its transaction: \`what\` is created, changed, deleted or the
 * action's name; \`record\` the record after (a deleted one as it was), \`before\` before a change.
 */
export function outgoing(tx: Tx, ${mails.length ? "viewer" : "_viewer"}: Viewer | null, model: string, what: string, record: Row, before?: Row): void {
  for (const entry of ENTRIES) {
    if (entry.model !== model || !counts(entry.when, what, entry.fits, record, before)) continue;${
      calls.length
        ? `
    if (entry.target) {
      const sent = SENT[model]?.(record);
      if (sent)
        queueCall(tx, {
          entry: entry.name,
          model,
          record: record.id as number,
          target: entry.target,
          body: JSON.stringify({ event: entry.name, model, happened: what, at: new Date().toISOString(), record: sent }),
        });
      continue;
    }`
        : ""
    }${
      mails.length
        ? `
    const shown = SHOWN[model]?.(tx, record);
    if (!shown || !entry.to) continue;
    queueMail(
      tx,
      viewer,
      { ...shown, ...(entry.subject ? { subject: entry.subject } : {}), ...(entry.text ? { text: entry.text } : {}), entry: entry.name, model, record: record.id as number },
      entry.to(tx, record),
      entry.when === "created",
    );`
        : ""
    }
  }
}
`;
}
