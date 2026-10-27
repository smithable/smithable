// Outgoing mail (docs/design/integrations.md §4.1b): the generated module that, inside a change's
// transaction, works out which entries count, whom they mail and what the mail shows, and queues
// it through src/kit/outgoing.server.ts. The data functions and actions call it.
import {
  type ContentIR,
  camel,
  type FieldIR,
  humanize,
  isUpload,
  kebab,
  type ModelIR,
  type OutgoingIR,
  pageModel,
  placeholdersOf,
  type RecipientIR,
  type SpecIR,
  sensitiveKind,
  titleField,
  USER_MODEL,
  type UxIR,
} from "@smithable/core";
import { apiFields, readCode } from "./api.js";
import { fieldUi } from "./data.js";
import { nameColumns, nameFunction } from "./names.js";
import {
  composedName,
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
 * Entries on a timer fire from the timers' tick (timed-actions.md §5), not from a write: they are
 * in the module's table as "timer:<name>", which no write says.
 */
export function outgoingOf(ir: SpecIR): RecordOutgoing[] {
  return ir.outgoing.filter(onRecords).filter((o) => !("timer" in o.when));
}

/** An entry about a record (a write, a standard action, a timer): it has a model. */
type RecordOutgoing = OutgoingIR & { when: Exclude<OutgoingIR["when"], { custom: string }> };
const onRecords = (o: OutgoingIR): o is RecordOutgoing => !("custom" in o.when);

/** The entries a custom action fires once it has returned (integrations.md §4.3). */
export function afterCustom(ir: SpecIR, action: string): OutgoingIR[] {
  return ir.outgoing.filter((o) => "custom" in o.when && o.when.custom === action);
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
  const entries = ir.outgoing.filter(onRecords);
  // A custom action's entries: no record, its input and output instead.
  const after = ir.outgoing.filter((o) => "custom" in o.when);
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
  // Records named by their parts (record-names.md), read with what their name needs.
  const composedUsed = new Set<ModelIR>();
  const namedOne = (target: ModelIR, id: string) => {
    composedUsed.add(target);
    return `${camel(target.name)}Named(tx, ${id})`;
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
        ? `and(eq(${n.table}.${back.name}Id, r.id as number), isNull(${n.table}.deletedAt))`
        : `eq(${n.table}.${back.name}Id, r.id as number)`;
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
  const sendable = (model: ModelIR) =>
    model.fields.filter(
      (f) =>
        !f.formula &&
        !isUpload(f) &&
        // What looks like a card number, a password or an identity number stays in the app.
        !sensitiveKind(f) &&
        !(f.type.kind === "relation" && f.type.many),
    );
  // Each field's formatted value by its name, and the labels beside, in the page's order.
  const shown = (model: ModelIR) =>
    sendable(model).map(
      (f) =>
        `        ${JSON.stringify(f.name)}: ${formatted(f, fieldUi(model, f, t, ir, ux), "r")},`,
    );
  const labels = (model: ModelIR) =>
    literal(sendable(model).map((f) => [f.name, fieldUi(model, f, t, ir, ux).label]));
  const uiLiteral = (ui: ReturnType<typeof fieldUi>) =>
    literal({
      name: ui.name,
      label: ui.label,
      kind: ui.kind,
      required: false,
      ...(ui.choices ? { choices: ui.choices.map(({ value, label }) => ({ value, label })) } : {}),
    });
  // A field's value as the record page shows it: `row` is the record's row, or for a hop the
  // code that reads the referenced record's column.
  const formatted = (f: FieldIR, ui: ReturnType<typeof fieldUi>, row: string): string => {
    const id = row === "r" ? `r.${f.name}Id` : row;
    if (f.type.kind !== "relation")
      return `formatValue(${uiLiteral(ui)}, ${row === "r" ? `r.${f.name}` : row}, app)`;
    if (f.type.model === USER_MODEL) {
      named = true;
      return `String(one(tx, schema.user, schema.user.id, schema.user.name, ${id}) ?? "—")`;
    }
    const target = modelNamed(ir, f.type.model);
    if (composedName(target)) return namedOne(target, `${id} as number | null`);
    const title = relatedTitle(ir, target.name);
    return title === "id"
      ? `((v) => (v == null ? "—" : \`#\${v}\`))(${id})`
      : `String(${value(target, title, id)} ?? "—")`;
  };
  // A placeholder one reference away, `{customer.email}` (outgoing-templates.md §3): the referenced
  // record's field as its page shows it; nothing for a path the model does not have.
  const hop = (model: ModelIR, path: string): string | undefined => {
    const [first, second] = path.split(".");
    const ref = model.fields.find((f) => f.name === first);
    if (!ref || !second || ref.type.kind !== "relation" || ref.type.many) return undefined;
    if (ref.type.model === USER_MODEL) {
      if (second !== "name" && second !== "email") return undefined;
      named = true;
      return `String(one(tx, schema.user, schema.user.id, schema.user.${second}, r.${first}Id) ?? "")`;
    }
    const target = modelNamed(ir, ref.type.model);
    const f = target.fields.find((x) => x.name === second);
    if (!f || !sendable(target).includes(f)) return undefined;
    const read = value(target, f.type.kind === "relation" ? `${second}Id` : second, `r.${first}Id`);
    return formatted(f, fieldUi(target, f, t, ir, ux), read);
  };
  const mails = entries.filter((o) => o.to === "mail");
  const calls = entries.filter((o) => o.to !== "mail");
  const mailsAfter = after.some((o) => o.to === "mail");
  const callsAfter = after.some((o) => o.to !== "mail");
  const modelsOf = (list: RecordOutgoing[]) =>
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
    // The record's own title, as its page's heading.
    const own = composedName(model)
      ? namedOne(model, "r.id as number")
      : title === "id"
        ? "`#${r.id}`"
        : shownTitle(model, `r.${title} ?? r.id`);
    let subject = `\`${n.label.replace(/[`$\\]/g, "\\$&")}: \${title}\``;
    let rest = page ? `\n      link: \`${page.route === "/" ? "" : page.route}/\${r.id}\`,` : "";
    if (thread) {
      threaded = true;
      const ownerTitle = titleField(thread.owner);
      // The subject is the thread's record's title (its first mail's subject), the tag after it.
      subject =
        thread.owner === model
          ? ownerTitle === "id"
            ? "`#${r.id}`"
            : `String(${shownTitle(model, `r.${ownerTitle} ?? r.id`)})`
          : ownerTitle === "id"
            ? `\`#\${${thread.record}}\``
            : `String(${value(thread.owner, ownerTitle, thread.record)} ?? "")`;
      rest = `${thread.letter ? `\n      letter: String(r.${thread.letter} ?? ""),` : rest}\n      thread: thread(tx, ${JSON.stringify(thread.owner.name)}, ${thread.record}, ${thread.address}),`;
    }
    const usesTx = thread || composedName(model) || lines.some((l) => /\btx\b/.test(l));
    return `  ${JSON.stringify(model.name)}: (${usesTx ? "tx" : "_tx"}, r) => {
    const title = String(${own});
    return {
      subject: ${subject},
      title,
      labels: ${labels(model)},
      values: {
${lines.join("\n")}
      },${rest}
    };
  },`;
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
      "event" in o.when
        ? o.when.event
        : "action" in o.when
          ? o.when.action
          : `timer:${o.when.timer}`;
    const fits = conditions(o);
    // The texts' placeholders (outgoing-templates.md §3): a hop is read with the record, and
    // {before.<field>} wants the record before the change shown too.
    const paths =
      o.to === "mail" ? placeholdersOf(`${words?.subject ?? ""} ${words?.text ?? ""}`) : [];
    const hops = [...new Set(paths.filter((p) => p.includes(".") && !p.startsWith("before.")))]
      .map((p) => [p, hop(model, p)] as const)
      .filter((x): x is readonly [string, string] => x[1] !== undefined);
    return `  {
    name: ${JSON.stringify(o.name)},
    model: ${JSON.stringify(o.when.model)},
    when: ${JSON.stringify(when)},${fits ? `\n    fits: ${fits},` : ""}${o.fields?.length ? `\n    fields: ${JSON.stringify(o.fields.map((f) => keyOf(model, f)))},` : ""}${words?.subject ? `\n    subject: ${JSON.stringify(words.subject)},` : ""}${words?.text ? `\n    text: ${JSON.stringify(words.text)},` : ""}${o.show ? `\n    show: ${JSON.stringify(o.show)},` : ""}${o.previous ? "\n    previous: true," : ""}${paths.some((p) => p.startsWith("before.")) ? "\n    before: true," : ""}${hops.length ? `\n    more: (tx, r) => ({ ${hops.map(([path, code]) => `${JSON.stringify(path)}: ${code}`).join(", ")} }),` : ""}
    ${o.to === "mail" ? toCode(recipients(model, o.recipient)) : `target: ${JSON.stringify(o.to)},`}
  },`;
  });
  // A custom action's entries: the mail shows its input and output by their labels.
  const afterList = after.map((o) => {
    const action = ir.actions.find((a) => "custom" in o.when && a.name === o.when.custom);
    const words = content?.outgoing?.[o.name];
    const shownFields = [
      ...(action?.input ?? []).map((f) => [f.name, "input"] as const),
      ...(action?.output ?? []).map((f) => [f.name, "output"] as const),
    ];
    const subject = words?.subject ?? (action ? t.action(action) : o.name);
    return `  {
    name: ${JSON.stringify(o.name)},
    action: ${JSON.stringify(action?.name ?? "")},${words?.text ? `\n    text: ${JSON.stringify(words.text)},` : ""}
    ${
      o.to === "mail"
        ? `subject: ${JSON.stringify(subject)},
    fields: (${shownFields.some(([, from]) => from === "input") ? "input" : "_input"}, ${shownFields.some(([, from]) => from === "output") ? "output" : "_output"}) => [${shownFields.map(([name, from]) => `[${JSON.stringify(humanize(name))}, shownValue(${from}?.${name})]`).join(", ")}],
    ${toCode(people(`eq(schema.user.role, ${JSON.stringify(o.recipient?.kind === "role" ? o.recipient.role : "admin")})`))}`
        : `target: ${JSON.stringify(o.to)},`
    }
  },`;
  });
  const body = [...showers, ...senders, ...list, ...afterList].join("\n");
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
${body.includes("formatValue(") || body.includes("titleOf(") ? `import { ${[...(body.includes("formatValue(") ? ["formatValue"] : []), ...(body.includes("titleOf(") ? ["titleOf"] : [])].join(", ")} } from "#/kit/format";\n` : ""}${entries.length ? `import { ${[...(mails.length ? ["blank"] : []), ...(calls.length ? ["changedBefore"] : []), "counts", ...(mails.length ? ["fillText"] : []), ...(calls.length ? ["picked"] : [])].join(", ")} } from "#/kit/outgoing";\n` : ""}${[...composedUsed].map((m) => `import { ${nameFunction(m)} } from "./${kebab(m.name)}.name";\n`).join("")}import { ${[...(mails.length ? ["type Happening", "linkTo"] : []), ...(calls.length || callsAfter ? ["queueCall"] : []), ...(mails.length || mailsAfter ? ["queueMail", "type Recipient"] : []), ...(mails.length ? ["shownFields"] : []), ...(threaded ? ["type Thread"] : [])].join(", ")} } from "#/kit/outgoing.server";

type Tx = Pick<typeof db, "select" | "insert"${composedUsed.size ? ' | "query"' : ""}>;
type Row = Record<string, unknown>;

/** The targets the outgoing section calls: the only ones src/kit/tell.server.ts may call too. */
export const TARGETS = ${literal([...new Set(ir.outgoing.filter((o) => o.to !== "mail").map((o) => o.to))])} as const;
export type Target = (typeof TARGETS)[number];
${[...composedUsed]
  .map(
    (m) => `
/** A ${t.modelLabel(m).toLowerCase()}'s name, read with what it needs (record-names.md); one in the trash is gone. */
function ${camel(m.name)}Named(tx: Tx, id: number | null): string {
  if (id == null) return "—";
  const row = tx.query.${names(m, t).tableKey}.findFirst({ where: (t, { eq }) => eq(t.id, id), ...${nameColumns(ir, m, m.trash ? ", deletedAt: true" : "")} }).sync();
  return row${m.trash ? " && !row.deletedAt" : ""} ? ${nameFunction(m)}(row) : "—";
}
`,
  )
  .join("")}${
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
/** A record as a mail shows it: its subject and title, each field's label and value by its name, its page. */
type Shown = Omit<Happening, "entry" | "model" | "record" | "fields"> & {
  title: string;
  labels: [string, string][];
  values: Record<string, string>;
};

/** Each model's record as a mail shows it. */
const SHOWN: Record<string, (tx: Tx, r: Row) => Shown> = {
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
${
  entries.length
    ? `
/** The entries of smithable.yml's outgoing section, with their texts. */
const ENTRIES: {
  name: string;
  model: string;
  when: string;
  fits?: (r: Row) => boolean;
  /** For a change: only one of these fields changing counts. */
  fields?: string[];
  subject?: string;
  text?: string;
  /** The fields the mail lists and a call's record carries (outgoing-templates.md §2); none for the text alone. */
  show?: string[] | "none";
  /** For a change: what the listed fields were before, too. */
  previous?: true;${
    mails.length
      ? `
  /** The texts use {before.<field>}: the record before the change is read too. */
  before?: true;
  /** The texts' placeholders one reference away, read with the record. */
  more?: (tx: Tx, r: Row) => Record<string, string>;
  to?: (tx: Tx, r: Row) => Recipient[];`
      : ""
  }${calls.length ? "\n  /** A target whose address and secret are settings (OUTGOING_<TARGET>_URL, _SECRET). */\n  target?: string;" : ""}
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
          body: JSON.stringify({ event: entry.name, model, happened: what, at: new Date().toISOString(), record: picked(sent, entry.show), ...(entry.previous && before ? { before: changedBefore(SENT[model]?.(before) ?? {}, sent, entry.show) } : {}) }),
        });
      continue;
    }`
        : ""
    }${
      mails.length
        ? `
    const shown = SHOWN[model]?.(tx, record);
    if (!shown || !entry.to) continue;
    const { title, labels, values, ...rest } = shown;
    const prior = before && (entry.previous || entry.before) ? SHOWN[model]?.(tx, before) : undefined;
    const more = entry.more?.(tx, record);
    // The texts' placeholders (outgoing-templates.md §3): the record's values as its page shows them, its title and address, who made the change, and what a field was.
    const fill = (text: string, oneLine = false) =>
      fillText(text, (path) => path === "title" ? title : path === "link" ? linkTo(rest.link) : path === "by" ? (viewer && !viewer.system ? viewer.name : "") : path.startsWith("before.") ? blank(prior?.values[path.slice(7)]) : blank(more?.[path] ?? values[path]), oneLine);
    queueMail(
      tx,
      viewer,
      { ...rest, subject: entry.subject ? fill(entry.subject, true) : rest.subject, ...(entry.text ? { text: fill(entry.text) } : {}), fields: shownFields(labels, values, prior?.values, entry.show, entry.previous), entry: entry.name, model, record: record.id as number },
      entry.to(tx, record),
      entry.when === "created",
    );`
        : ""
    }
  }
}
`
    : ""
}${
  after.length
    ? `
/** A value of a custom action's input or output as its mail shows it. */
function shownValue(value: unknown): string {
  return value == null || value === "" ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** The entries of smithable.yml's outgoing section that wait for a custom action. */
const AFTER: {
  name: string;
  action: string;
  text?: string;${mailsAfter ? "\n  subject?: string;\n  fields?: (input: Row, output: Row | undefined) => [string, string][];\n  to?: (tx: Tx, r: Row) => Recipient[];" : ""}${callsAfter ? "\n  target?: string;" : ""}
}[] = [
${afterList.join("\n")}
];

/**
 * Queues what a custom action asks for once it has returned without an error (integrations.md
 * §4.3): a call carries its input and output, a mail shows them; there is no record.
 */
export function outgoingAfter(tx: Tx, ${mailsAfter ? "viewer" : "_viewer"}: Viewer | null, action: string, input: Row, output: unknown): void {
  for (const entry of AFTER) {
    if (entry.action !== action) continue;${
      callsAfter
        ? `
    if (entry.target) {
      queueCall(tx, {
        entry: entry.name,
        model: null,
        record: null,
        target: entry.target,
        body: JSON.stringify({ event: entry.name, action, at: new Date().toISOString(), input, output: output ?? null }),
      });
      continue;
    }`
        : ""
    }${
      mailsAfter
        ? `
    if (!entry.to || !entry.fields) continue;
    const out = output && typeof output === "object" ? (output as Row) : undefined;
    queueMail(
      tx,
      viewer,
      { entry: entry.name, model: null, record: null, subject: entry.subject ?? entry.name, ...(entry.text ? { text: entry.text } : {}), fields: entry.fields(input, out) },
      entry.to(tx, {}),
    );`
        : ""
    }
  }
}
`
    : ""
}`;
}
