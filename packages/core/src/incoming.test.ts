import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { validateAuth } from "./auth.js";
import { incomingText } from "./sections/incoming.js";
import { validateSpec } from "./spec.js";

const raw = import.meta.glob("../../../examples/status/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
// The example has an incoming entry of its own (the chat command); the tests add theirs to the spec without it.
const spec = (raw["../../../examples/status/smithable.yml"] as string).split(
  "\nincoming:",
)[0] as string;
const auth = raw["../../../examples/status/smithable.auth.yml"] as string;
const withIncoming = (block: string) => `${spec}\nincoming:\n${block}`;
const read = (block: string) => validateSpec({ path: "smithable.yml", text: withIncoming(block) });
const codes = (block: string) => read(block).diagnostics.map((d) => d.code);

test("an incoming call: a record per call with literals, formulas and {path} texts, or custom code", () => {
  const { ir, diagnostics } = read(`  monitorDown:
    create: Incident
    set: { title: "{check.name} is not responding", status: investigating, detectedAt: NOW() }
    id: "{event.id}"
    as: staff
  paymentReceived:
    custom: true
    signed: sha256
`);
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(ir?.incoming).toEqual([
    {
      name: "monitorDown",
      create: "Incident",
      set: [
        { field: "title", template: "{check.name} is not responding" },
        { field: "status", value: "investigating" },
        expect.objectContaining({ field: "detectedAt", text: "NOW()" }),
      ],
      custom: false,
      id: "{event.id}",
      as: "staff",
    },
    {
      name: "paymentReceived",
      set: [],
      custom: true,
      signed: { text: "{body}", prefix: "sha256=" },
      as: "admin",
    },
  ]);
  const named = (m: string) => m.toLowerCase();
  expect(incomingText(ir?.incoming[0] as never, named)).toBe(
    "When monitor down is called: adds an incident, as staff.",
  );
  expect(incomingText(ir?.incoming[1] as never, named)).toBe(
    "When payment received is called: its code decides what happens, as admin; the call is signed.",
  );
});

test("a call needs a model or code, fields that exist and can be set, and paths in its templates", () => {
  expect(codes("  x:\n    as: staff\n")).toContain("invalid-incoming");
  expect(codes("  x: { create: Incident, custom: true }\n")).toContain("invalid-incoming");
  expect(codes("  x: { create: Incidnt }\n")).toContain("unknown-model");
  expect(codes("  x: { create: Incident, set: { titel: Down } }\n")).toContain("unknown-field");
  expect(codes("  x: { create: Incident, set: { updates: x } }\n")).toContain("invalid-set");
  expect(codes('  x: { create: Incident, set: { title: "{a b}" } }\n')).toContain(
    "invalid-template",
  );
  expect(codes("  x: { create: Incident, set: { status: broken } }\n").length).toBeGreaterThan(0);
  expect(codes("  Monitor: { custom: true }\n")).toContain("invalid-name");
  expect(codes("  x: { custom: true, signed: md5 }\n")).toContain("invalid-incoming");
});

test("addIncoming and removeIncoming write the entry; the role must exist and may create the record", () => {
  const files = { spec, auth };
  const added = applyOperation(files, "addIncoming", {
    name: "monitorDown",
    create: "Incident",
    set: ["title={check.name} is down", "detectedAt=NOW()"],
    as: "staff",
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toMatch(
    /incoming:\n {2}monitorDown:\n {4}create: Incident\n {4}set:\n {6}title: "?\{check\.name\} is down"?\n {6}detectedAt: NOW\(\)\n {4}as: staff/,
  );
  const custom = applyOperation({ ...files, ...added.files }, "addIncoming", {
    name: "paymentReceived",
    custom: true,
    signed: true,
  });
  expect(custom.ok && custom.files.spec).toMatch(
    /paymentReceived:\n {4}custom: true\n {4}signed: sha256/,
  );
  expect(applyOperation(files, "addIncoming", { name: "x" })).toMatchObject({ ok: false });
  const removed = applyOperation({ ...files, ...added.files }, "removeIncoming", {
    name: "monitorDown",
  });
  expect(removed.ok && removed.files.spec).not.toContain("incoming");
  // The role, against the auth file.
  const ir = read("  x: { create: Incident, as: nobody }\n").ir;
  if (!ir) throw new Error("the spec is invalid");
  expect(
    validateAuth({ path: "smithable.auth.yml", text: auth }, ir).diagnostics.map((d) => d.code),
  ).toContain("unknown-role");
});

test("a mail becomes a record: its parts go to fields of the right kind, none also in set", () => {
  const mail = `  support:
    mail: true
    create: Incident
    set: { status: investigating, detectedAt: NOW() }
    fields: { subject: title, body: summary }
`;
  const { ir, diagnostics } = read(mail);
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(ir?.incoming[0]?.mail).toEqual({ subject: "title", body: "summary" });
  expect(incomingText(ir?.incoming[0] as never, (m) => m.toLowerCase())).toBe(
    "When support is called: a mail becomes an incident, as admin.",
  );
  expect(codes("  x: { mail: true, custom: true }\n")).toContain("invalid-incoming");
  expect(codes("  x: { mail: true, create: Incident, fields: { sender: title } }\n")).toContain(
    "invalid-incoming",
  );
  expect(
    codes("  x: { mail: true, create: Incident, fields: { attachments: title } }\n"),
  ).toContain("invalid-incoming");
  expect(
    codes("  x: { mail: true, create: Incident, set: { title: x }, fields: { subject: title } }\n"),
  ).toContain("invalid-incoming");
  expect(codes("  x: { create: Incident, fields: { subject: title } }\n")).toContain(
    "invalid-incoming",
  );
});

test("addIncoming writes a mail entry with its fields", () => {
  const added = applyOperation({ spec, auth }, "addIncoming", {
    name: "support",
    mail: true,
    create: "Incident",
    set: ["status=investigating", "detectedAt=NOW()"],
    fields: ["subject=title", "body=summary"],
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toMatch(
    /support:\n {4}mail: true\n {4}create: Incident\n {4}set:\n(.*\n){2} {4}fields:\n {6}subject: title\n {6}body: summary/,
  );
  expect(applyOperation({ spec, auth }, "addIncoming", { name: "x", mail: true })).toMatchObject({
    ok: false,
  });
});

test("a reply to a mail's record becomes a record of a model that refers to it once (mail-threads.md §2)", () => {
  const mail = `  support:
    mail: true
    create: Incident
    set: { status: investigating, detectedAt: NOW() }
    fields: { subject: title, body: summary }
    reply:
      create: IncidentUpdate
      fields: { body: message }
      set: { at: NOW() }
      then: { status: identified }
`;
  const { ir, diagnostics } = read(mail);
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(ir?.incoming[0]?.reply).toEqual({
    create: "IncidentUpdate",
    ref: "incident",
    mail: { body: "message" },
    set: [expect.objectContaining({ field: "at", text: "NOW()" })],
    update: [{ field: "status", value: "identified" }],
  });
  expect(incomingText(ir?.incoming[0] as never, (m) => m.toLowerCase())).toBe(
    "When support is called: a mail becomes an incident; a reply to one of them is added to it as an incidentupdate and sets its status, as admin.",
  );
  const entry = (reply: string) =>
    `  x:\n    mail: true\n    create: Incident\n    fields: { subject: title }\n    reply: ${reply}\n`;
  // A model that does not refer to the entry's, or one that does not exist.
  expect(codes(entry("{ create: Maintenance, fields: { body: description } }"))).toContain(
    "invalid-incoming",
  );
  expect(codes(entry("{ create: Updates, fields: { body: message } }"))).toContain("unknown-model");
  // Its parts go to fields of the right kind; "then" names the entry's own model's fields.
  expect(codes(entry("{ create: IncidentUpdate, fields: { body: at } }"))).toContain(
    "invalid-incoming",
  );
  expect(
    codes(entry("{ create: IncidentUpdate, fields: { body: message }, then: { status: gone } }")),
  ).not.toEqual([]);
  // Only a mail has replies.
  expect(
    codes(
      "  x: { create: Incident, reply: { create: IncidentUpdate, fields: { body: message } } }\n",
    ),
  ).toContain("invalid-incoming");
});

test("addIncoming and setIncomingReply write the reply; a rename follows into it, a removal it needs is refused", () => {
  const added = applyOperation({ spec, auth }, "addIncoming", {
    name: "support",
    mail: true,
    create: "Incident",
    set: ["status=investigating", "detectedAt=NOW()"],
    fields: ["subject=title", "body=summary"],
    reply: "IncidentUpdate",
    replyFields: ["body=message"],
    replySet: ["at=NOW()"],
    replyThen: ["status=identified"],
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toMatch(
    / {4}reply:\n {6}create: IncidentUpdate\n {6}fields:\n {8}body: message\n {6}set:\n {8}at: NOW\(\)\n {6}then:\n {8}status: identified/,
  );
  const files = { spec: added.files.spec, auth };
  const renamed = applyOperation(files, "renameField", {
    model: "IncidentUpdate",
    from: "message",
    to: "text",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.spec).toMatch(
    /reply:\n {6}create: IncidentUpdate\n {6}fields:\n {8}body: text/,
  );
  const thenRenamed = applyOperation(files, "renameField", {
    model: "Incident",
    from: "status",
    to: "state",
  });
  if (!thenRenamed.ok) throw new Error(thenRenamed.message);
  expect(thenRenamed.files.spec).toMatch(/ {6}then:\n {8}state: identified/);
  expect(
    applyOperation(files, "removeField", { model: "Incident", field: "summary" }),
  ).toMatchObject({
    ok: false,
    message: expect.stringContaining('"support" uses Incident.summary'),
  });
  const none = applyOperation(files, "setIncomingReply", { name: "support", none: true });
  if (!none.ok) throw new Error(none.message);
  expect(none.files.spec).not.toContain("reply:");
  const back = applyOperation({ spec: none.files.spec, auth }, "setIncomingReply", {
    name: "support",
    create: "IncidentUpdate",
    fields: ["body=message"],
    set: ["at=NOW()"],
  });
  if (!back.ok) throw new Error(back.message);
  expect(back.files.spec).toMatch(/ {4}reply:\n {6}create: IncidentUpdate/);
});

test("a choice value an entry sets follows its rename; one it loses is refused; then needs write", () => {
  const priority = applyOperation({ spec, auth }, "addField", {
    model: "IncidentUpdate",
    field: "channel",
    type: "mail | phone",
  });
  if (!priority.ok) throw new Error(priority.message);
  const added = applyOperation({ spec: priority.files.spec, auth }, "addIncoming", {
    name: "support",
    mail: true,
    create: "Incident",
    set: ["status=investigating", "detectedAt=NOW()"],
    fields: ["subject=title", "body=summary"],
    reply: "IncidentUpdate",
    replyFields: ["body=message"],
    replySet: ["at=NOW()", "channel=mail"],
    replyThen: ["status=identified"],
  });
  if (!added.ok) throw new Error(added.message);
  const files = { spec: added.files.spec, auth };
  const renamed = applyOperation(files, "changeField", {
    model: "Incident",
    field: "status",
    type: "investigating | found | monitoring | resolved",
    renames: ["identified=found"],
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.spec).toMatch(/ {6}then:\n {8}status: found/);
  const lost = applyOperation(files, "changeField", {
    model: "IncidentUpdate",
    field: "channel",
    type: "phone | chat",
  });
  expect(lost).toMatchObject({
    ok: false,
    message: expect.stringContaining(
      '"support" wants a value IncidentUpdate.channel no longer has',
    ),
  });
  // A role that may add the reply but not change the incident gets the reopening warned.
  const { ir } = validateSpec({ path: "smithable.yml", text: added.files.spec });
  const staffOnly = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles:\n  admin: all\n  intake: { create: all, read: all }\n",
    },
    { ...ir, incoming: ir?.incoming.map((i) => ({ ...i, as: "intake" })) } as never,
  );
  expect(staffOnly.diagnostics.map((d) => d.code)).toContain("incoming-cannot-update");
});

test("a service's own signing: what is signed, the prefix, the header its time comes in; a form body; a setup check", () => {
  const { ir, diagnostics } = read(`  chatCommand:
    create: Incident
    set: { title: "{text}", detectedAt: NOW() }
    body: form
    signed: { sha256: "v0:{timestamp}:{body}", prefix: "v0=", timestamp: X-Request-Timestamp }
    header: X-Signature
    challenge: challenge
    as: staff
`);
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(ir?.incoming[0]).toMatchObject({
    name: "chatCommand",
    signed: { text: "v0:{timestamp}:{body}", prefix: "v0=", timestamp: "X-Request-Timestamp" },
    header: "X-Signature",
    body: "form",
    challenge: "challenge",
  });
  expect(incomingText(ir?.incoming[0] as never, (m) => m.toLowerCase())).toBe(
    "When chat command is called: adds an incident, as staff; the call is signed with its time.",
  );
  // The map's defaults are the plain form.
  expect(read("  x: { custom: true, signed: { prefix: v0= } }\n").ir?.incoming[0]?.signed).toEqual({
    text: "{body}",
    prefix: "v0=",
  });
  // The signed text takes the body, and the time only with the header it comes in (and the other way round).
  const bad = (signed: string) => codes(`  x: { custom: true, signed: ${signed} }\n`);
  expect(bad('{ sha256: "v0:{timestamp}" , timestamp: X-T }')).toContain("invalid-incoming");
  expect(bad('{ sha256: "{body}", timestamp: X-T }')).toContain("invalid-incoming");
  expect(bad('{ sha256: "v0:{timestamp}:{body}" }')).toContain("invalid-incoming");
  expect(bad('{ sha256: "{nonce}:{body}" }')).toContain("invalid-incoming");
  expect(bad('{ sha256: "{body}", prefix: "v0 =" }')).toContain("invalid-incoming");
  expect(bad("[sha256]")).toContain("invalid-incoming");
  expect(codes("  x: { custom: true, body: xml }\n")).toContain("invalid-incoming");
  expect(codes('  x: { custom: true, challenge: "a b" }\n')).toContain("invalid-incoming");
  // A mail comes as JSON and has no setup check.
  expect(
    codes(
      "  m: { mail: true, create: Incident, fields: { subject: title }, body: form, challenge: challenge }\n",
    ).filter((c) => c === "invalid-incoming"),
  ).toHaveLength(2);
});

test("addIncoming writes a service's own form: --signed-text, --signed-prefix, --timestamp, --header, --form, --challenge", () => {
  const result = applyOperation({ spec, auth }, "addIncoming", {
    name: "chatCommand",
    create: "Incident",
    set: ["title={text}", "detectedAt=NOW()"],
    signedText: "v0:{timestamp}:{body}",
    signedPrefix: "v0=",
    timestamp: "X-Request-Timestamp",
    header: "X-Signature",
    form: true,
    challenge: "challenge",
    as: "staff",
  });
  if (!result.ok) throw new Error(result.message);
  expect(result.files.spec).toMatch(
    /chatCommand:\n {4}create: Incident\n {4}set:\n {6}title: "\{text\}"\n {6}detectedAt: NOW\(\)\n {4}signed:\n {6}sha256: "?v0:\{timestamp\}:\{body\}"?\n {6}prefix: v0=\n {6}timestamp: X-Request-Timestamp\n {4}header: X-Signature\n {4}body: form\n {4}challenge: challenge\n {4}as: staff/,
  );
  expect(
    validateSpec({ path: "smithable.yml", text: result.files.spec }).ir?.incoming.at(-1)?.signed,
  ).toEqual({ text: "v0:{timestamp}:{body}", prefix: "v0=", timestamp: "X-Request-Timestamp" });
  // A mail takes neither.
  const refused = applyOperation({ spec, auth }, "addIncoming", {
    name: "m",
    mail: true,
    create: "Incident",
    fields: ["subject=title"],
    form: true,
  });
  expect(refused.ok).toBe(false);
  // The time's header and {timestamp} go together, also from the command line.
  const half = applyOperation({ spec, auth }, "addIncoming", {
    name: "y",
    custom: true,
    signedText: "v0:{timestamp}:{body}",
  });
  expect(half.ok).toBe(false);
});

test("addIncoming writes a set value as its field holds it: a yes/no, a number; a {path} stays text", () => {
  const tasks = `smithable: 0.1
app: { name: Tasks }
models:
  Task: { fields: { title: string!, done: bool, points: int } }
pages:
  tasks: { crud: Task }
`;
  const added = applyOperation({ spec: tasks }, "addIncoming", {
    name: "newTask",
    create: "Task",
    set: ["title={task.title}", "done=false", "points=3"],
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toMatch(/title: "\{task\.title\}"\n {6}done: false\n {6}points: 3\n/);
});
