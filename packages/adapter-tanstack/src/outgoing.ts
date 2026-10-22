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
  keyOf,
  literal,
  modelNamed,
  names,
  ownerKey,
  relatedTitle,
  SCHEMA_IMPORT,
  shownTitle,
  type Texts,
} from "./shared.js";

/**
 * The entries of the outgoing section a record's change fires: mail, and calls to named targets.
 * Entries on a timer fire from the timers' tick (timed-actions.md §5), not from a write.
 */
export function outgoingOf(ir: SpecIR): OutgoingIR[] {
  return ir.outgoing.filter((o) => !("timer" in o.when));
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
  // A user's name shown in the mail (the schema's user table, not the people() helper).
  let named = false;
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
    if (recipient.kind === "list") {
      // Every record of the list (the records referring back to this one, none in the trash):
      // each one's owner, or an address on it; a person is told once.
      const target = modelNamed(ir, recipient.model);
      const back = target.fields.find(
        (f) => f.type.kind === "relation" && !f.type.many && f.type.model === model.name,
      ) as FieldIR;
      const n = names(target, t);
      tables.add(n.table);
      const each = recipient.each;
      const column =
        each.kind === "owner"
          ? ownerKey(target)
          : each.via === "user"
            ? `${each.field}Id`
            : each.field;
      const where = target.trash
        ? `and(eq(${n.table}.${back.name}Id, r.id), isNull(${n.table}.deletedAt))`
        : `eq(${n.table}.${back.name}Id, r.id)`;
      const rows = `tx.select({ v: ${n.table}.${column} }).from(${n.table}).where(${where}).all()`;
      if (each.kind === "field" && each.via === "email")
        return `${rows}.map((x) => ({ email: x.v as string | null }))`;
      return `((ids) => (ids.length ? ${people("inArray(schema.user.id, ids)")} : []))(${rows}.map((x) => x.v).filter((v) => v != null).map(String))`;
    }
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
      named = true;
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
  // Mail threads (mail-threads.md §4): the record an incoming mail entry makes, and its replies.
  const threadOf = (model: ModelIR) => {
    for (const i of ir.incoming) {
      if (!i.reply || !i.create) continue;
      const address = `process.env.INCOMING_${i.name.toUpperCase()}_ADDRESS`;
      if (i.create === model.name) return { owner: model, record: "r.id as number", address };
      if (i.reply.create === model.name)
        return {
          owner: modelNamed(ir, i.create),
          record: `r.${i.reply.ref}Id as number`,
          address,
          letter: i.reply.mail.body,
        };
    }
    return undefined;
  };
  let threaded = false;
  // A change made from an incoming mail: its id joins the thread; an automatic one tells nobody.
  const threading = ir.incoming.some((i) => i.reply);
  const showers = modelsOf(mails).map((model) => {
    const n = names(model, t);
    const lines = shown(model);
    const title = titleField(model);
    const page = ir.pages.find((p) => p.pattern.kind === "crud" && pageModel(p) === model.name);
    const thread = threadOf(model);
    if (thread) {
      threaded = true;
      const ownerTitle = titleField(thread.owner);
      // The subject is the thread's record's title (its first mail's subject), the tag after it.
      const subject =
        thread.owner === model
          ? ownerTitle === "id"
            ? `\`#\${r.id}\``
            : `String(${shownTitle(model, `r.${ownerTitle} ?? r.id`)})`
          : ownerTitle === "id"
            ? `\`#\${${thread.record}}\``
            : `String(${value(thread.owner, ownerTitle, thread.record)} ?? "")`;
      return `  ${JSON.stringify(model.name)}: (tx, r) => ({
    subject: ${subject},
    fields: [
${lines.join("\n")}
    ],${thread.letter ? `\n    letter: String(r.${thread.letter} ?? ""),` : page ? `\n    link: \`${page.route === "/" ? "" : page.route}/\${r.id}\`,` : ""}
    thread: thread(tx, ${JSON.stringify(thread.owner.name)}, ${thread.record}, ${thread.address}),
  }),`;
    }
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
  // Whom to mail, naming only what it reads (a role's people need no record).
  const toCode = (code: string) =>
    `to: (${/\btx\b/.test(code) ? "tx" : "_tx"}, ${/\br\./.test(code) ? "r" : "_r"}) => ${code},`;
  const list = entries.map((o) => {
    const model = modelNamed(ir, o.when.model);
    const words = content?.outgoing?.[o.name];
    const when =
      "event" in o.when ? o.when.event : "action" in o.when ? o.when.action : o.when.timer;
    const fits = conditions(o);
    return `  {
    name: ${JSON.stringify(o.name)},
    model: ${JSON.stringify(o.when.model)},
    when: ${JSON.stringify(when)},${fits ? `\n    fits: ${fits},` : ""}${o.fields?.length ? `\n    fields: ${JSON.stringify(o.fields.map((f) => keyOf(model, f)))},` : ""}${words?.subject ? `\n    subject: ${JSON.stringify(words.subject)},` : ""}${words?.text ? `\n    text: ${JSON.stringify(words.text)},` : ""}
    ${o.to === "mail" ? toCode(recipients(model, o.recipient)) : `target: ${JSON.stringify(o.to)},`}
  },`;
  });
  const body = [...showers, ...senders, ...list].join("\n");
  const ones = body.includes("one(tx,");
  const trashOne = body.includes(".deletedAt)");
  const imports = threading ? 'import { AsyncLocalStorage } from "node:async_hooks";\n' : "";
  const drizzle = [
    ...(trashOne || threaded ? ["and"] : []),
    ...(threaded ? ["asc"] : []),
    ...(ones || users || threaded || body.includes("eq(") ? ["eq"] : []),
    ...(body.includes("inArray(") ? ["inArray"] : []),
    ...(trashOne ? ["isNull"] : []),
    ...(users ? ["type SQL"] : []),
  ];
  return `${HEADER}${imports}${drizzle.length ? `import { ${drizzle.join(", ")} } from "drizzle-orm";\n` : ""}${ones ? 'import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";\n' : ""}import type { db } from "#/db";
${tables.size || users || named || threaded ? `${SCHEMA_IMPORT}\n` : ""}${body.includes("formatValue(") || threaded ? 'import { app } from "#/generated/app";\n' : ""}import type { Viewer } from "#/kit/access";
${body.includes("formatValue(") || body.includes("titleOf(") ? `import { ${[...(body.includes("formatValue(") ? ["formatValue"] : []), ...(body.includes("titleOf(") ? ["titleOf"] : [])].join(", ")} } from "#/kit/format";\n` : ""}import { counts } from "#/kit/outgoing";
import { ${[...(mails.length ? ["type Happening"] : []), ...(calls.length ? ["queueCall"] : []), ...(mails.length ? ["queueMail", "type Recipient"] : []), ...(threaded ? ["type Thread"] : [])].join(", ")} } from "#/kit/outgoing.server";

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
  threading
    ? `
const arriving = new AsyncLocalStorage<{ messageId?: string; quiet: boolean }>();

/**
 * Runs a change made from an incoming mail (mail-threads.md §3): the mail's id joins the thread its
 * first answer starts, and an automatic mail (an auto-reply, a bounce) tells nobody.
 */
export function fromMail<T>(mail: { messageId?: string; quiet: boolean }, run: () => Promise<T>): Promise<T> {
  return arriving.run(mail, run);
}
`
    : ""
}${
  threaded
    ? `
/**
 * A record's mail thread (mail-threads.md §4): the tag at the end of the subject, the latest mail
 * received as the one answered, the thread's last twenty ids, where a reply goes, and each id sent kept.
 */
function thread(tx: Tx, model: string, record: number, replyTo: string | undefined): Thread {
  const ids = tx
    .select({ id: schema.mailThreads.messageId, received: schema.mailThreads.received })
    .from(schema.mailThreads)
    .where(and(eq(schema.mailThreads.model, model), eq(schema.mailThreads.recordId, record)))
    .orderBy(asc(schema.mailThreads.at), asc(schema.mailThreads.id))
    .all();
  // The mail this change came from is the one its first answer answers.
  const got = arriving.getStore()?.messageId;
  if (got && !ids.some((i) => i.id === got)) {
    tx.insert(schema.mailThreads).values({ model, recordId: record, messageId: got, received: true }).run();
    ids.push({ id: got, received: true });
  }
  return {
    tag: \`[\${app.name} #\${record}]\`,
    inReplyTo: (ids.filter((i) => i.received).at(-1) ?? ids.at(-1))?.id,
    references: ids.slice(-20).map((i) => i.id),
    replyTo: replyTo || undefined,
    keep: (messageId) => {
      tx.insert(schema.mailThreads).values({ model, recordId: record, messageId }).run();
    },
  };
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
  /** For a change: only one of these fields changing counts. */
  fields?: string[];
  subject?: string;
  text?: string;${mails.length ? "\n  to?: (tx: Tx, r: Row) => Recipient[];" : ""}${calls.length ? "\n  /** A target whose address and secret are settings (OUTGOING_<TARGET>_URL, _SECRET). */\n  target?: string;" : ""}
}[] = [
${list.join("\n")}
];

/**
 * Queues what a change asks for, in its transaction: \`what\` is created, changed, deleted or the
 * action's name; \`record\` the record after (a deleted one as it was), \`before\` before a change.
 */
export function outgoing(tx: Tx, ${mails.length ? "viewer" : "_viewer"}: Viewer | null, model: string, what: string, record: Row, before?: Row): void {${threading ? "\n  if (arriving.getStore()?.quiet) return;" : ""}
  for (const entry of ENTRIES) {
    if (entry.model !== model || !counts(entry.when, what, entry.fits, record, before, entry.fields)) continue;${
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
