import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

const ir = validateSpec({
  path: "smithable.yml",
  text: `smithable: 0.1
app: { name: Status }
models:
  Incident:
    fields: { title: string!, status: investigating | resolved, detectedAt: datetime!, minutes: int }
  Request:
    fields: { title: string!, email: email!, body: text, attachments: files }
pages:
  incidents: { crud: Incident }
incoming:
  monitorDown:
    create: Incident
    set: { title: "{check.name} is down", minutes: "{check.minutes}", detectedAt: NOW() }
    id: "{event.id}"
  paymentReceived:
    custom: true
    signed: sha256
  support:
    mail: true
    create: Request
    fields: { from: email, subject: title, body: body, attachments: attachments }
  chatCommand:
    create: Incident
    set: { title: "{text}", detectedAt: NOW() }
    body: form
    signed: { sha256: "v0:{timestamp}:{body}", prefix: "v0=", timestamp: X-Request-Timestamp }
    header: X-Signature
    challenge: challenge
`,
}).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: all }\n",
  },
  ir,
).auth as AuthIR;
const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
const file = (path: string) => files.find((f) => f.path === path);

test("a call that adds a record: its route checks the secret, fills the values from the JSON and remembers its id", () => {
  const route = file("src/routes/incoming/monitorDown.ts")?.content ?? "";
  expect(route).toContain('createFileRoute("/incoming/monitorDown")');
  expect(route).toContain("process.env.INCOMING_MONITORDOWN_SECRET");
  expect(route).toContain("const expected = `Bearer ${secret}`;");
  expect(route).toContain('title: fill("{check.name} is down", body),');
  expect(route).toContain('minutes: whole(fill("{check.minutes}", body)),');
  expect(route).toContain("detectedAt: new Date(F.NOW()),");
  expect(route).toContain('fill("{event.id}", body)');
  expect(route).toContain("incidentSchema.safeParse(");
  expect(file("src/db/schema.ts")?.content).toContain('"incoming_seen"');
});

test("twice is once: the id is taken on a unique index before the call acts, and given back when it does not", () => {
  const route = file("src/routes/incoming/monitorDown.ts")?.content ?? "";
  // One statement, not a read and then a write: a second delivery at the same moment finds the
  // row and changes nothing (a row older than a day is taken over).
  expect(route).toContain(
    "const taken = db.insert(incomingSeen).values({ name: NAME, key, at }).onConflictDoUpdate({ target: [incomingSeen.name, incomingSeen.key], set: { at }, setWhere: lt(incomingSeen.at, new Date(at.getTime() - DAY)) }).run();",
  );
  expect(route).toContain(
    "if (taken.changes === 0) return answer(200, { received: true, repeat: true });",
  );
  expect(route).not.toContain(".select().from(incomingSeen)");
  // Ids older than a month go on each claim: the table stays bounded.
  expect(route).toContain(
    "db.delete(incomingSeen).where(and(eq(incomingSeen.name, NAME), lt(incomingSeen.at, new Date(at.getTime() - 30 * DAY)))).run();",
  );
  // The record is made inside the claim; a refusal or a failure releases the id for the retry,
  // and only the row this call marked with its own time: a claim taken over by a later call
  // (one older than a day) stays that call's.
  expect(route).toContain("let acted = false;\n        try {");
  expect(route).toContain("acted = true;\n            return answer(201, { id: made.id });");
  expect(route).toContain(
    "} finally {\n          if (key && !acted) db.delete(incomingSeen).where(and(eq(incomingSeen.name, NAME), eq(incomingSeen.key, key), eq(incomingSeen.at, at))).run();",
  );
  // A custom call too.
  const custom = file("src/routes/incoming/paymentReceived.ts")?.content ?? "";
  expect(custom).toContain("acted = true;\n            return answer(200, { received: true });");
  expect(custom).toContain("} finally {");
  const schema = file("src/db/schema.ts")?.content ?? "";
  expect(schema).toContain('uniqueIndex("incoming_seen_key").on(t.name, t.key)');
  expect(schema).toMatch(/import \{[^}]*uniqueIndex[^}]*\} from "drizzle-orm\/sqlite-core"/);
});

test("a mail's id is its Message-ID, or without one a digest of the mail: delivered twice, it makes one record", () => {
  const route = file("src/routes/incoming/support.ts")?.content ?? "";
  expect(route).toContain(
    'const key = request.headers.get("idempotency-key") ?? mailKey(body as Mail);',
  );
  expect(route).toContain(
    'text(mail.messageId) || `sha256:${createHash("sha256").update(JSON.stringify([mail.from, mail.date, mail.subject, mail.text, mail.html].map(text))).digest("hex")}`',
  );
  // The mail's id and date are read whether or not the entry takes replies.
  expect(route).toContain("date?: unknown;");
  expect(route).toContain("messageId?: unknown");
  // Files saved for a call refused or failed after all are removed and their room given back.
  expect(route).toContain("unsaved(files, requestData.uses);");
  expect(route).toContain("release(files.reduce((n, f) => n + f.size, 0));");
  // The call's own id wins where the entry names one.
  expect(file("src/routes/incoming/monitorDown.ts")?.content).toContain(
    'const key = request.headers.get("idempotency-key") ?? fill("{event.id}", body);',
  );
});

test("a custom, signed call: an HMAC of the body, and a stub of the project's own, written once", () => {
  const route = file("src/routes/incoming/paymentReceived.ts")?.content ?? "";
  expect(route).toContain('createHmac("sha256", secret).update(raw)');
  expect(route).toContain('request.headers.get("x-signature-256")');
  expect(route).toContain('import { handle } from "#/custom/incoming/payment-received";');
  const stub = file("src/custom/incoming/payment-received.ts");
  expect(stub?.zone).toBe("custom");
  expect(stub?.content).toContain("export async function handle(body: unknown, caller: Viewer)");
});

test("a chat tool's command: a form body, a signature of the time and the body, the time checked, the setup check echoed", () => {
  const route = file("src/routes/incoming/chatCommand.ts")?.content ?? "";
  expect(route).toContain('request.headers.get("x-signature")');
  expect(route).toContain('const stamp = request.headers.get("x-request-timestamp") ?? "";');
  expect(route).toContain("Math.abs(Date.now() - sent) > 300_000");
  expect(route).toContain(
    'const expected = `v0=${createHmac("sha256", secret).update(`v0:${stamp}:${raw}`).digest("hex")}`;',
  );
  expect(route).toContain("for (const [k, v] of new URLSearchParams(raw)) {");
  expect(route).toContain("const form: Record<string, unknown> = Object.create(null);");
  expect(route).toContain("form[k] = JSON.parse(v);");
  // The setup check comes as JSON even to a form address: the content type decides.
  expect(route).toContain(
    'if (/^application\\/json\\b/i.test(request.headers.get("content-type") ?? "")) {',
  );
  // Without an id of its own, a signed call's signature is its id: a replay within the window is a repeat.
  expect(route).toContain('const key = request.headers.get("idempotency-key") ?? `sig:${given}`;');
  expect(route).toContain('const check = at(body, "challenge");');
  expect(route).toContain('"content-type": "text/plain"');
  expect(route).toContain('title: fill("{text}", body),');
  // The plain form is as before: the body alone, "sha256=" before the hex, no time.
  const plain = file("src/routes/incoming/paymentReceived.ts")?.content ?? "";
  expect(plain).not.toContain("const stamp");
  expect(plain).toContain(
    'const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;',
  );
});

test("a mail becomes a record: sender, subject and text to their fields, attachments saved as uploads", () => {
  const route = file("src/routes/incoming/support.ts")?.content ?? "";
  expect(route).toContain("email: address(mail.from),");
  expect(route).toContain("title: text(mail.subject),");
  expect(route).toContain("body: bodyOf(mail),");
  expect(route).toContain("attachments: files,");
  expect(route).toContain(
    'const files = await saved(mail, "request", "attachments", requestData.uses);',
  );
  expect(route).toContain('const stored = saveFile(model, bytes, text(name) || "attachment");');
  // The receipt the record's create demands of any upload (receipts.server.ts), given to the
  // call itself: the trusted path keeps the checks and the quota, and needs no browser.
  expect(route).toContain(
    "files.push({ ...stored, receipt: receiptFor(caller.id, model, field, stored.file) });",
  );
  expect(route).toContain('import { receiptFor } from "#/kit/receipts.server";');
  expect(route).toContain("if (bytes.byteLength > FILE_MAX_BYTES || !roomFor(bytes.byteLength))");
  // A refused attachment gives back the room held for the ones before it.
  expect(route).toContain("held += bytes.byteLength;");
  expect(route).toContain("release(held);");
  expect(route).toContain("if (error instanceof BadFile) return refused(422, error.message);");
  expect(route).toContain("if (parts.length > 10)");
  expect(route).toContain(
    'replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi, " ").replace(/<style\\b[^>]*>[\\s\\S]*?<\\/style>/gi, " ")',
  );
  expect(route).toContain("await scanned(bytes);");
  expect(route).toContain("!/SQLITE_|Drizzle|Failed query/i.test(error.message)");
  // No templates and no id: no path helpers to leave unused.
  expect(route).not.toContain("const fill");
  expect(file("src/routes/incoming/monitorDown.ts")?.content).toContain("Object.hasOwn(v, part)");
});

test("a reply joins its thread: found by the ids it answers, else the tag; a thread mail carries its tag and headers", () => {
  const threaded = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Harbour Support }
models:
  Request:
    fields: { title: string!, email: email!, body: text, status: new | open | closed, messages: "Message[]" }
  Message:
    fields: { request: Request!, from: email, body: text!, direction: in | out }
pages:
  requests: { crud: Request }
incoming:
  support:
    mail: true
    create: Request
    fields: { from: email, subject: title, body: body }
    reply:
      create: Message
      fields: { from: from, body: body }
      set: { direction: in }
      then: { status: open }
outgoing:
  requestReceived: { when: Request created, to: mail, recipient: email }
  replySent: { when: Message created, where: { direction: out }, to: mail, recipient: request.email }
`,
  }).ir as SpecIR;
  const app = generateApp(threaded, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  const at = (path: string) => app.find((f) => f.path === path)?.content ?? "";
  const route = at("src/routes/incoming/support.ts");
  expect(route).toContain("inArray(mailThreads.messageId, answers)");
  expect(route).toContain("const tagged = /\\[[^[\\]]*#(\\d+)\\]/.exec(text(mail.subject))?.[1];");
  expect(route).toContain("requestId: thread,");
  expect(route).toContain('direction: "in",');
  expect(route).toContain("fromMail({ messageId: mailId || undefined, quiet: automatic }");
  expect(route).toContain('status: "open",');
  expect(at("src/db/schema.ts")).toContain('"mail_threads"');
  const outgoing = at("src/generated/outgoing.server.ts");
  expect(outgoing).toContain("tag: `[${app.name} #${record}]`,");
  expect(outgoing).toContain(
    'thread: thread(tx, "Request", r.id as number, process.env.INCOMING_SUPPORT_ADDRESS),',
  );
  expect(outgoing).toContain(
    'thread: thread(tx, "Request", r.requestId as number, process.env.INCOMING_SUPPORT_ADDRESS),',
  );
  // A reply's mail is its body alone, a letter, with the request's title as its subject.
  expect(outgoing).toContain('letter: String(r.body ?? ""),');
  expect(outgoing).toContain("if (arriving.getStore()?.quiet) return;");
});
