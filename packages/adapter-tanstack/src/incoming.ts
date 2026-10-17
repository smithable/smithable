// Incoming calls (docs/design/integrations.md §3): a route per entry at /incoming/<name> that
// checks the caller's secret or signature, answers a repeat as received, and adds the record
// (through the model's schema and data function, as the entry's role) or hands the call to the
// project's code in src/custom/incoming/.
import {
  type FieldIR,
  type IncomingIR,
  type IncomingMailIR,
  type IncomingValueIR,
  kebab,
  type ModelIR,
  type SpecIR,
} from "@smithable/core";
import { formulaCompiler } from "./formulas.js";
import { dataKey, HEADER, modelNamed, names, type Texts } from "./shared.js";

/** The setting that holds an entry's secret: INCOMING_MONITORDOWN_SECRET. */
export const incomingSecret = (incoming: IncomingIR) =>
  `INCOMING_${incoming.name.toUpperCase()}_SECRET`;

/** Calls already acted on, by their id, for a day: a service's retry is not a second record. */
export const INCOMING_SEEN_TABLE = `export const incomingSeen = sqliteTable(
  "incoming_seen",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    /** The incoming entry's name, and the call's own id (Idempotency-Key, or the entry's id). */
    name: text().notNull(),
    key: text().notNull(),
    at: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("incoming_seen_key").on(t.name, t.key)],
);`;

/**
 * The message ids of each threaded record's mails, sent and received (docs/design/mail-threads.md
 * §3): a reply's In-Reply-To or References finds its record here. Ids keep their angle brackets.
 */
export const MAIL_THREADS_TABLE = `export const mailThreads = sqliteTable(
  "mail_threads",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    /** The record the thread is about: the model an incoming mail entry creates, and its id. */
    model: text().notNull(),
    recordId: integer().notNull(),
    messageId: text().notNull(),
    /** A mail that came in, not one the app sent. */
    received: integer({ mode: "boolean" }).notNull().default(false),
    at: integer({ mode: "timestamp_ms" }).notNull().$defaultFn(() => new Date()),
  },
  (t) => [index("mail_threads_message").on(t.messageId), index("mail_threads_record").on(t.model, t.recordId)],
);`;

/** A template's text as the field's stored value: numbers, cents, yes/no, a date and time. */
function coerced(field: FieldIR, text: string): string {
  if (field.type.kind !== "scalar") return text;
  switch (field.type.name) {
    case "int":
      return `whole(${text})`;
    case "decimal":
      return `number(${text})`;
    case "money":
      return `cents(${text})`;
    case "bool":
      return `${text} === "true"`;
    case "datetime":
      return `new Date(${text})`;
    default:
      return text;
  }
}

/** A value an entry sets, as code: a literal, a formula on `row`, or a filled-in template. */
function valueCode(model: ModelIR, ir: SpecIR, v: IncomingValueIR): string {
  const compiler = formulaCompiler(model, ir);
  const field = model.fields.find((f) => f.name === v.field) as FieldIR;
  const scalar = field.type.kind === "scalar" ? field.type.name : field.type.kind;
  if ("template" in v)
    return `${field.name}: ${coerced(field, `fill(${JSON.stringify(v.template)}, body)`)},`;
  const code =
    "formula" in v
      ? compiler.stored(field, compiler.compile(v.formula, model as never, "row"))
      : "value" in v
        ? scalar === "money"
          ? String(Math.round(Number(v.value) * 100))
          : JSON.stringify(v.value)
        : "undefined";
  return `${field.name}: ${scalar === "datetime" ? `new Date(${code})` : code},`;
}

/** Where a mail's parts go in a record of `model`: the address, the subject, the text, the files. */
function mailLinesOf(mail: IncomingMailIR, model: ModelIR): string[] {
  const files = mail.attachments
    ? model.fields.find((f) => f.name === mail.attachments)
    : undefined;
  return [
    ...(mail.from ? [`${mail.from}: address(mail.from),`] : []),
    ...(mail.subject ? [`${mail.subject}: text(mail.subject),`] : []),
    ...(mail.body ? [`${mail.body}: bodyOf(mail),`] : []),
    ...(files
      ? [
          `${files.name}: ${files.type.kind === "scalar" && files.type.name === "files" ? "files" : "(files[0] ?? null)"},`,
        ]
      : []),
  ];
}

export function incomingRoute(incoming: IncomingIR, ir: SpecIR, t: Texts): string {
  const model = incoming.create ? modelNamed(ir, incoming.create) : undefined;
  const n = model ? names(model, t) : undefined;
  const compiler = model ? formulaCompiler(model, ir) : undefined;
  const value = (v: IncomingValueIR) => {
    const field = model?.fields.find((f) => f.name === v.field) as FieldIR;
    const scalar = field.type.kind === "scalar" ? field.type.name : field.type.kind;
    if ("template" in v)
      return `${field.name}: ${coerced(field, `fill(${JSON.stringify(v.template)}, body)`)},`;
    const code =
      "formula" in v && compiler
        ? compiler.stored(field, compiler.compile(v.formula, model as never, "row"))
        : "value" in v
          ? scalar === "money"
            ? String(Math.round(Number(v.value) * 100))
            : JSON.stringify(v.value)
          : "undefined";
    return `${field.name}: ${scalar === "datetime" ? `new Date(${code})` : code},`;
  };
  const header = (
    incoming.header ?? (incoming.signed ? "X-Signature-256" : "Authorization")
  ).toLowerCase();
  const usesNumbers = incoming.set.some((v) => {
    if (!("template" in v)) return false;
    const field = model?.fields.find((f) => f.name === v.field);
    return field?.type.kind === "scalar" && ["int", "decimal", "money"].includes(field.type.name);
  });
  // A mail's parts go to the fields "fields" names; attachments are saved as uploads are.
  const mailFields = incoming.mail ?? {};
  const attachmentsField = mailFields.attachments
    ? model?.fields.find((f) => f.name === mailFields.attachments)
    : undefined;
  const mailLines = incoming.mail && model ? mailLinesOf(incoming.mail, model) : [];
  const lines = [...incoming.set.map((v) => value(v)), ...mailLines];
  // A mail of one of its records' threads (mail-threads.md §3): a record of the reply model.
  const reply = incoming.reply && model && n ? replyParts(incoming, model, ir, t) : undefined;
  const replyMail = incoming.reply?.mail ?? {};
  const saves = Boolean(attachmentsField || reply?.files);
  const usesFill =
    incoming.id !== undefined ||
    [...incoming.set, ...(incoming.reply?.set ?? []), ...(incoming.reply?.update ?? [])].some(
      (v) => "template" in v,
    );
  // A formula on the record reads fields of an empty one: only when one does.
  const readsRow = lines.some((l) => /\brow\b/.test(l));
  const usesF = [...lines, ...(reply?.code ? [reply.code] : [])].some((l) => l.includes("F."));
  return `${HEADER}// Incoming call "${incoming.name}" (smithable.yml incoming): another service calls this address
// with its secret${incoming.signed ? " (a sha256 signature of the body)" : ""}; the secret is the setting ${incomingSecret(incoming)}.
import { createHash, ${incoming.signed ? "createHmac, " : ""}timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { and, ${reply ? "desc, " : ""}eq, gt${reply ? ", inArray" : ""} } from "drizzle-orm";
import { db } from "#/db";
import { incomingSeen${reply ? ", mailThreads" : ""} } from "#/db/schema";
import { AccessDenied, type Viewer } from "#/kit/access";
${
  n && model
    ? `import { ${n.data} } from "#/generated/${kebab(model.name)}.server";
import { ${n.schema} } from "#/generated/${kebab(model.name)}.schema";`
    : `import { handle } from "#/custom/incoming/${kebab(incoming.name)}";`
}${reply?.imports ?? ""}${usesF ? '\nimport { F } from "#/kit/formula";' : ""}${saves ? '\nimport { BadFile, FILE_MAX_BYTES, saveFile, scanned, type StoredFile } from "#/kit/uploads";' : ""}

const NAME = ${JSON.stringify(incoming.name)};
const DAY = 86_400_000;
/** The call acts as this role; nothing it adds is anyone's own (a "key:" id owns nothing, as a key's). */
const caller: Viewer = { id: "key:incoming-${incoming.name}", name: NAME, email: "", role: ${JSON.stringify(incoming.as)} };

const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
// Both sides hashed first: the same length whatever was sent, so the compare tells nothing of it.
const digest = (s: string) => createHash("sha256").update(s).digest();
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));
${
  usesFill
    ? `/** A value of the call's JSON by its path ("check.name", "items.0.id"), as text; missing is "". */
const at = (body: unknown, path: string): string => {
  let v: unknown = body;
  // The call's own keys only, never what objects inherit ("constructor", "__proto__").
  for (const part of path.split(".")) v = v !== null && typeof v === "object" && Object.hasOwn(v, part) ? (v as Record<string, unknown>)[part] : undefined;
  return v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
};
const fill = (template: string, body: unknown) =>
  template.replace(/\\{([^{}]+)\\}/g, (_, path: string) => at(body, path.trim()));`
    : ""
}${
  incoming.mail
    ? `
/** The mail a host passes on: from, to, subject, text, html, attachments ({ name, type, data }). */
type Mail = { from?: unknown; to?: unknown; subject?: unknown; text?: unknown; html?: unknown; attachments?: unknown${reply ? "; messageId?: unknown; inReplyTo?: unknown; references?: unknown; autoSubmitted?: unknown" : ""} };
const text = (v: unknown) => (typeof v === "string" ? v : "");${
        mailFields.from || replyMail.from
          ? `
/** "Ada <ada@example.com>" → ada@example.com. */
const address = (v: unknown) => (/<([^<>]+)>/.exec(text(v))?.[1] ?? text(v)).trim();`
          : ""
      }${
        mailFields.body || replyMail.body
          ? `
/** The mail's text, or its HTML without the tags when it has no text. */
const bodyOf = (mail: Mail) =>
  text(mail.text) || text(mail.html).replace(/<[^>]*>/g, " ").replace(/\\s+/g, " ").trim();`
          : ""
      }${
        saves
          ? `
/** Each attachment checked and kept as an upload is; one too large or refused is the answer instead. */
async function saved(mail: Mail, model: string): Promise<StoredFile[] | Response> {
  const files: StoredFile[] = [];
  for (const one of Array.isArray(mail.attachments) ? mail.attachments : []) {
    const { name, data } = one as { name?: unknown; data?: unknown };
    const bytes = Buffer.from(text(data), "base64");
    if (bytes.byteLength === 0) continue;
    if (bytes.byteLength > FILE_MAX_BYTES)
      return answer(413, { error: \`\${text(name) || "An attachment"} is over \${FILE_MAX_BYTES / 1_000_000} MB.\` });
    try {
      await scanned(bytes);
      files.push(saveFile(model, bytes, text(name) || "attachment"));
    } catch (error) {
      if (error instanceof BadFile) return answer(422, { error: error.message });
      throw error;
    }
  }
  return files;
}`
          : ""
      }${reply?.helpers ?? ""}`
    : ""
}${
  usesNumbers
    ? `
const number = (text: string) => (text.trim() === "" ? null : Number(text));
const whole = (text: string) => (text.trim() === "" ? null : Math.trunc(Number(text)));
const cents = (text: string) => (text.trim() === "" ? null : Math.round(Number(text) * 100));`
    : ""
}

export const Route = createFileRoute("/incoming/${incoming.name}")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.${incomingSecret(incoming)};
        if (!secret) return answer(401, { error: "This address is not set up: ${incomingSecret(incoming)} is not set." });
        const raw = await request.text();
        const given = request.headers.get(${JSON.stringify(header)}) ?? "";
        ${
          incoming.signed
            ? `const expected = \`sha256=\${createHmac("sha256", secret).update(raw).digest("hex")}\`;`
            : `const expected = ${header === "authorization" ? "`Bearer ${secret}`" : "secret"};`
        }
        if (!same(given, expected)) return answer(401, { error: "Wrong secret or signature." });
        let body: unknown;
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          return answer(400, { error: "The body is not JSON." });
        }
        // A call seen in the last day is answered as received and not acted on again.
        const key = request.headers.get("idempotency-key") ?? ${incoming.id ? `fill(${JSON.stringify(incoming.id)}, body)` : '""'};
        if (key) {
          const seen = db
            .select()
            .from(incomingSeen)
            .where(and(eq(incomingSeen.name, NAME), eq(incomingSeen.key, key), gt(incomingSeen.at, new Date(Date.now() - DAY))))
            .get();
          if (seen) return answer(200, { received: true, repeat: true });
        }
        const done = () => {
          if (key) db.insert(incomingSeen).values({ name: NAME, key }).run();
        };
${
  n
    ? `        ${readsRow ? "const row = {} as Record<string, unknown>;\n        " : ""}${
        incoming.mail
          ? `const mail = body as Mail;
${reply?.block ?? ""}${
  attachmentsField
    ? `        const files = await saved(mail, ${JSON.stringify(kebab(model?.name ?? ""))});
        if (files instanceof Response) return files;
`
    : ""
}        `
          : ""
      }const parsed = ${n.schema}.safeParse({
${lines.map((l) => `          ${l}`).join("\n")}
        });
        if (!parsed.success)
          return answer(422, { error: parsed.error.issues.map((i) => \`\${i.path.join(".")}: \${i.message}\`).join("; ") });
        try {
          const made = ${
            reply
              ? `await fromMail({ messageId: mailId || undefined, quiet: automatic }, () => ${n.data}.create(caller, parsed.data));
          keep(made.id);`
              : `await ${n.data}.create(caller, parsed.data);`
          }
          done();
          return answer(201, { id: made.id });
        } catch (error) {
          if (error instanceof AccessDenied) return answer(403, { error: "This call's role may not add one." });
          return answer(422, { error: error instanceof Error ? error.message : String(error) });
        }`
    : `        try {
          await handle(body, caller);
          done();
          return answer(200, { received: true });
        } catch (error) {
          if (error instanceof AccessDenied) return answer(403, { error: "This call's role may not do that." });
          return answer(422, { error: error instanceof Error ? error.message : String(error) });
        }`
}
      },
    },
  },
});
`;
}

/**
 * The route's parts for a mail entry's replies (mail-threads.md §3): the thread found by the
 * mail's headers among the ids kept, else by the [app #id] tag in its subject; the reply record
 * referring to it, what `then` changes on it, and the mail's id kept in the thread. An automatic
 * mail joins but tells nobody and changes nothing.
 */
function replyParts(incoming: IncomingIR, owner: ModelIR, ir: SpecIR, t: Texts) {
  const reply = incoming.reply as NonNullable<IncomingIR["reply"]>;
  const model = modelNamed(ir, reply.create);
  const on = names(owner, t);
  const rn = names(model, t);
  const ref = model.fields.find((f) => f.name === reply.ref) as FieldIR;
  const files = reply.mail.attachments
    ? model.fields.find((f) => f.name === reply.mail.attachments)
    : undefined;
  const lines = [
    `${dataKey(ref)}: thread,`,
    ...reply.set.map((v) => valueCode(model, ir, v)),
    ...mailLinesOf(reply.mail, model),
  ];
  const update = reply.update.map((v) => valueCode(owner, ir, v));
  const outgoing = ir.outgoing.length > 0;
  const code = [...lines, ...update].join("\n");
  const block = `        // A mail of a record's thread: by the ids it answers, else by the [app #id] tag.
        const mailId = text(mail.messageId);
        const keep = keeper(mailId);
        const automatic = !["", "no"].includes(text(mail.autoSubmitted).toLowerCase());
        const answers = [text(mail.inReplyTo), ...(Array.isArray(mail.references) ? mail.references.map(text) : [])].filter(Boolean);
        let thread = answers.length
          ? db.select({ id: mailThreads.recordId }).from(mailThreads).where(and(eq(mailThreads.model, ${JSON.stringify(owner.name)}), inArray(mailThreads.messageId, answers))).orderBy(desc(mailThreads.at)).get()?.id
          : undefined;
        if (thread === undefined) {
          const tagged = /\\[[^[\\]]*#(\\d+)\\]/.exec(text(mail.subject))?.[1];
          if (tagged) thread = Number(tagged);
        }
        // A record that is gone (or never was) has no thread: the mail is a new one.
        if (thread !== undefined && !(await ${on.data}.get(caller, thread))) thread = undefined;
        if (thread !== undefined) {
${
  files
    ? `          const files = await saved(mail, ${JSON.stringify(kebab(model.name))});
          if (files instanceof Response) return files;
`
    : ""
}${lines.some((l) => /\brow\b/.test(l)) ? "          const row = {} as Record<string, unknown>;\n" : ""}          const joining = ${rn.schema}.safeParse({
${lines.map((l) => `            ${l}`).join("\n")}
          });
          if (!joining.success)
            return answer(422, { error: joining.error.issues.map((i) => \`\${i.path.join(".")}: \${i.message}\`).join("; ") });
          const to = thread;
          try {
            const made = await fromMail({ messageId: mailId || undefined, quiet: automatic }, async () => {
              const added = await ${rn.data}.create(caller, joining.data);${
                update.length
                  ? `
              // What a reply changes on its record (then), unless it is an automatic one.
              const row = automatic ? null : await ${on.data}.get(caller, to);
              if (row)
                await ${on.data}.update(caller, to, ${on.schema}.parse({
                  ...row,
${update.map((l) => `                  ${l}`).join("\n")}
                }));`
                  : ""
              }
              return added;
            });
            keep(to);
            done();
            return answer(201, { id: made.id, thread: to });
          } catch (error) {
            if (error instanceof AccessDenied) return answer(403, { error: "This call's role may not add one." });
            return answer(422, { error: error instanceof Error ? error.message : String(error) });
          }
        }
`;
  const imports = `
import { ${rn.data} } from "#/generated/${kebab(model.name)}.server";
import { ${rn.schema} } from "#/generated/${kebab(model.name)}.schema";${outgoing ? '\nimport { fromMail } from "#/generated/outgoing.server";' : ""}`;
  const helpers = `
/** The mail's own id, kept in its record's thread so an answer to it finds the record. */
function keeper(mailId: string) {
  return (record: number) => {
    if (!mailId) return;
    const kept = db.select({ id: mailThreads.id }).from(mailThreads).where(and(eq(mailThreads.model, ${JSON.stringify(owner.name)}), eq(mailThreads.messageId, mailId))).get();
    if (!kept) db.insert(mailThreads).values({ model: ${JSON.stringify(owner.name)}, recordId: record, messageId: mailId, received: true }).run();
  };
}${outgoing ? "" : "\n/** No mail goes out from this app: a change from a mail is just the change. */\nconst fromMail = <T,>(_mail: unknown, run: () => Promise<T>): Promise<T> => run();"}`;
  return { imports, helpers, block, files, code };
}

/** src/custom/incoming/<name>.ts, written once: the project's code for a custom call. */
export function incomingStub(incoming: IncomingIR): string {
  return `// Incoming call "${incoming.name}" (smithable.yml incoming, custom: true). Smithable checked the caller's
// secret and that the body is JSON; this decides what happens. Use the generated data functions
// (#/generated/<model>.server) with \`caller\`, so the access rules hold. Smithable never
// overwrites this file.
import type { Viewer } from "#/kit/access";

export async function handle(body: unknown, caller: Viewer): Promise<void> {
  void body;
  void caller;
}
`;
}
