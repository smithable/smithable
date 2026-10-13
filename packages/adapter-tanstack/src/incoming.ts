// Incoming calls (docs/design/integrations.md §3): a route per entry at /incoming/<name> that
// checks the caller's secret or signature, answers a repeat as received, and adds the record
// (through the model's schema and data function, as the entry's role) or hands the call to the
// project's code in src/custom/incoming/.
import {
  type FieldIR,
  type IncomingIR,
  type IncomingValueIR,
  kebab,
  type SpecIR,
} from "@smithable/core";
import { formulaCompiler } from "./formulas.js";
import { HEADER, modelNamed, names, type Texts } from "./shared.js";

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
  const mailLines = incoming.mail
    ? [
        ...(mailFields.from ? [`${mailFields.from}: address(mail.from),`] : []),
        ...(mailFields.subject ? [`${mailFields.subject}: text(mail.subject),`] : []),
        ...(mailFields.body ? [`${mailFields.body}: bodyOf(mail),`] : []),
        ...(attachmentsField
          ? [
              `${attachmentsField.name}: ${attachmentsField.type.kind === "scalar" && attachmentsField.type.name === "files" ? "files" : "(files[0] ?? null)"},`,
            ]
          : []),
      ]
    : [];
  const lines = [...incoming.set.map((v) => value(v)), ...mailLines];
  const usesFill = incoming.id !== undefined || incoming.set.some((v) => "template" in v);
  // A formula on the record reads fields of an empty one: only when one does.
  const readsRow = lines.some((l) => /\brow\b/.test(l));
  const usesF = lines.some((l) => l.includes("F."));
  return `${HEADER}// Incoming call "${incoming.name}" (smithable.yml incoming): another service calls this address
// with its secret${incoming.signed ? " (a sha256 signature of the body)" : ""}; the secret is the setting ${incomingSecret(incoming)}.
import { ${incoming.signed ? "createHmac, " : ""}timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { and, eq, gt } from "drizzle-orm";
import { db } from "#/db";
import { incomingSeen } from "#/db/schema";
import { AccessDenied, type Viewer } from "#/kit/access";
${
  n && model
    ? `import { ${n.data} } from "#/generated/${kebab(model.name)}.server";
import { ${n.schema} } from "#/generated/${kebab(model.name)}.schema";`
    : `import { handle } from "#/custom/incoming/${kebab(incoming.name)}";`
}${usesF ? '\nimport { F } from "#/kit/formula";' : ""}${attachmentsField ? '\nimport { BadFile, FILE_MAX_BYTES, saveFile, scanned } from "#/kit/uploads";' : ""}

const NAME = ${JSON.stringify(incoming.name)};
const DAY = 86_400_000;
/** The call acts as this role; nothing it adds is anyone's own (a "key:" id owns nothing, as a key's). */
const caller: Viewer = { id: "key:incoming-${incoming.name}", name: NAME, email: "", role: ${JSON.stringify(incoming.as)} };

const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
${
  usesFill
    ? `/** A value of the call's JSON by its path ("check.name", "items.0.id"), as text; missing is "". */
const at = (body: unknown, path: string): string => {
  let v: unknown = body;
  for (const part of path.split(".")) v = v !== null && typeof v === "object" ? (v as Record<string, unknown>)[part] : undefined;
  return v === undefined || v === null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
};
const fill = (template: string, body: unknown) =>
  template.replace(/\\{([^{}]+)\\}/g, (_, path: string) => at(body, path.trim()));`
    : ""
}${
  incoming.mail
    ? `
/** The mail a host passes on: from, to, subject, text, html, attachments ({ name, type, data }). */
type Mail = { from?: unknown; to?: unknown; subject?: unknown; text?: unknown; html?: unknown; attachments?: unknown };
const text = (v: unknown) => (typeof v === "string" ? v : "");${
        mailFields.from
          ? `
/** "Ada <ada@example.com>" → ada@example.com. */
const address = (v: unknown) => (/<([^<>]+)>/.exec(text(v))?.[1] ?? text(v)).trim();`
          : ""
      }${
        mailFields.body
          ? `
/** The mail's text, or its HTML without the tags when it has no text. */
const bodyOf = (mail: Mail) =>
  text(mail.text) || text(mail.html).replace(/<[^>]*>/g, " ").replace(/\\s+/g, " ").trim();`
          : ""
      }`
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
${
  attachmentsField
    ? `        // Each attachment checked and kept as an upload is; one too large refuses the mail.
        const files = [];
        for (const one of Array.isArray(mail.attachments) ? mail.attachments : []) {
          const { name, data } = one as { name?: unknown; data?: unknown };
          const bytes = Buffer.from(text(data), "base64");
          if (bytes.byteLength === 0) continue;
          if (bytes.byteLength > FILE_MAX_BYTES)
            return answer(413, { error: \`\${text(name) || "An attachment"} is over \${FILE_MAX_BYTES / 1_000_000} MB.\` });
          try {
            await scanned(bytes);
            files.push(saveFile(${JSON.stringify(kebab(model?.name ?? ""))}, bytes, text(name) || "attachment"));
          } catch (error) {
            if (error instanceof BadFile) return answer(422, { error: error.message });
            throw error;
          }
        }
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
          const made = await ${n.data}.create(caller, parsed.data);
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
