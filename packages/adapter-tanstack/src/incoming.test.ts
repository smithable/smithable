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

test("a custom, signed call: an HMAC of the body, and a stub of the project's own, written once", () => {
  const route = file("src/routes/incoming/paymentReceived.ts")?.content ?? "";
  expect(route).toContain('createHmac("sha256", secret).update(raw)');
  expect(route).toContain('request.headers.get("x-signature-256")');
  expect(route).toContain('import { handle } from "#/custom/incoming/payment-received";');
  const stub = file("src/custom/incoming/payment-received.ts");
  expect(stub?.zone).toBe("custom");
  expect(stub?.content).toContain("export async function handle(body: unknown, caller: Viewer)");
});

test("a mail becomes a record: sender, subject and text to their fields, attachments saved as uploads", () => {
  const route = file("src/routes/incoming/support.ts")?.content ?? "";
  expect(route).toContain("email: address(mail.from),");
  expect(route).toContain("title: text(mail.subject),");
  expect(route).toContain("body: bodyOf(mail),");
  expect(route).toContain("attachments: files,");
  expect(route).toContain('const files = await saved(mail, "request", requestData.uses);');
  expect(route).toContain('files.push(saveFile(model, bytes, text(name) || "attachment"));');
  expect(route).toContain("if (bytes.byteLength > FILE_MAX_BYTES || !roomFor(bytes.byteLength))");
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
