// Outgoing channels (docs/design/notifications.md §4–§6, §9 step 1): `to` as a channel, a list of
// channels or a target; what each channel reaches; the operations and the summary words.
import { Ajv } from "ajv";
import { expect, test } from "vitest";
import { parse } from "yaml";
import { applyOperation } from "../apply.js";
import { validateAuth } from "../auth.js";
import { validateContent } from "../content.js";
import { buildJsonSchema } from "../schema.js";
import { validateSpec } from "../spec.js";
import { outgoingText } from "./outgoing.js";

const SPEC = `smithable: 0.1
app:
  name: Kiosk
models:
  Customer:
    fields:
      name: string!
      email: email
      phone: phone
      sales: Sale[]
  Sale:
    fields:
      number: int
      name: string!
      email: email
      phone: phone
      taker: User
      customer: Customer
      guest: Guest
      status: placed | ready
  Guest:
    namedBy: person
    fields:
      person: User!
      note: string
actions:
  ready:
    on: Sale
    when: { status: placed }
    set: { status: ready }
  importSales:
    custom: true
    input: { file: string! }
    output: { added: int }
timers:
  morning:
    every: day
    at: "06:30"
`;
const AUTH =
  "smithableAuth: 0.1\nsignIn:\n  providers: [google]\ndefaultAccess: shared\nroles:\n  admin: { description: Runs it. }\n  staff: { description: Works. }\ndefaultRole: staff\n";

const read = (outgoing: string) =>
  validateSpec(
    { path: "smithable.yml", text: `${SPEC}outgoing:\n${outgoing}` },
    { roles: ["admin", "staff"] },
  );
const problems = (outgoing: string) =>
  read(outgoing)
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => `${d.code}: ${d.message}${d.hint ? ` ${d.hint}` : ""}`);

test("to is a channel, a list of channels or a target; the IR keeps to and adds channels", () => {
  const result = read(`  mailed:
    when: Sale created
    to: mail
    recipient: staff
  pushed:
    when: Sale created
    to: push
    recipient: staff
  both:
    when: Sale created
    to: [push, mail]
    recipient: staff
  all:
    when: Sale created
    to: [sms, push, mail]
    recipient: owner
  texted:
    when: ready
    to: sms
    recipient: phone
  theirs:
    when: ready
    to: [push, sms]
    recipient: taker
  kitchen:
    when: Sale created
    to: kitchen
  imported:
    when: importSales
    to: [mail, push]
    recipient: admin
`);
  expect(result.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const ir = result.ir?.outgoing ?? [];
  expect(ir.map((o) => [o.name, o.to, o.channels])).toEqual([
    ["mailed", "mail", ["mail"]],
    ["pushed", "push", ["push"]],
    ["both", "mail", ["mail", "push"]],
    ["all", "mail", ["mail", "push", "sms"]],
    ["texted", "sms", ["sms"]],
    ["theirs", "push", ["push", "sms"]],
    ["kitchen", "kitchen", undefined],
    ["imported", "mail", ["mail", "push"]],
  ]);
  expect(ir.find((o) => o.name === "texted")?.recipient).toEqual({
    kind: "field",
    path: ["phone"],
    via: "phone",
  });
  expect(ir.map((o) => outgoingText(o))).toEqual([
    "When a sale is added: mails every staff.",
    "When a sale is added: pushes to every staff.",
    "When a sale is added: mails and pushes to every staff.",
    "When a sale is added: mails, pushes to and texts its owner.",
    "When “Ready” runs on a sale: texts phone.",
    "When “Ready” runs on a sale: pushes to and texts taker.",
    "When a sale is added: tells kitchen.",
    "When “Import sales” runs: mails and pushes to every admin.",
  ]);
});

test("push and sms are channels now: a target of that name is refused with the rename", () => {
  for (const c of ["push", "sms"]) {
    const [message = ""] = problems(`  feed:\n    when: Sale created\n    to: ${c}\n`);
    expect(message).toContain(`reserved-name: Outgoing "feed" goes by ${c}, a built-in channel`);
    expect(message).toContain(
      `rename it here and in its settings OUTGOING_${c.toUpperCase()}_URL and OUTGOING_${c.toUpperCase()}_SECRET`,
    );
  }
  // A list of channels without a recipient is said as any mail without one.
  expect(problems("  x:\n    when: Sale created\n    to: [mail, push]\n")).toEqual([
    expect.stringContaining('goes by mail and push, so it needs "recipient"'),
  ]);
});

test("a list holds channels only, each once; a target stands alone", () => {
  expect(
    problems("  x:\n    when: Sale created\n    to: [mail, kitchen]\n    recipient: staff\n"),
  ).toEqual([expect.stringContaining('"kitchen" is none; a target is named alone (to: kitchen)')]);
  expect(
    problems("  x:\n    when: Sale created\n    to: [mail, mail]\n    recipient: staff\n"),
  ).toEqual([expect.stringContaining('"to" lists mail twice')]);
  expect(problems("  x:\n    when: Sale created\n    to: []\n    recipient: staff\n")).toEqual([
    expect.stringContaining('"to" lists no channel'),
  ]);
});

test("every channel must reach the recipient", () => {
  const reach = (to: string, recipient: string) =>
    problems(`  x:\n    when: Sale created\n    to: ${to}\n    recipient: ${recipient}\n`);
  // A person (owner, a role, a field that refers to User) is reached by every channel.
  for (const r of ["owner", "staff", "taker"]) expect(reach("[mail, push, sms]", r)).toEqual([]);
  // An email field by mail alone, a phone field by sms alone, one reference away too.
  expect(reach("mail", "email")).toEqual([]);
  expect(reach("sms", "phone")).toEqual([]);
  expect(reach("sms", "customer.phone")).toEqual([]);
  expect(reach("[mail, sms]", "email")).toEqual([
    expect.stringContaining("sms cannot reach an email field"),
  ]);
  expect(reach("[mail, sms]", "phone")).toEqual([
    expect.stringContaining("mail cannot reach a phone field"),
  ]);
  expect(reach("push", "email")).toEqual([
    expect.stringContaining(
      "push cannot reach an email field; it reaches a person with an account",
    ),
  ]);
  expect(reach("push", "customer.phone")).toEqual([
    expect.stringContaining("push cannot reach a phone field"),
  ]);
  expect(reach("mail", "customer.phone")).toEqual([
    expect.stringContaining("mail cannot reach a phone field"),
  ]);
  // A list field's records, each: the same rule.
  const each = (to: string, recipient: string) =>
    problems(`  x:\n    when: Customer changed\n    to: ${to}\n    recipient: ${recipient}\n`);
  expect(each("sms", "sales.phone")).toEqual([]);
  expect(each("sms", "sales.email")).toEqual([
    expect.stringContaining("sms cannot reach an email field"),
  ]);
  // A field that holds no address at all is said as before.
  expect(reach("sms", "name")).toEqual([
    expect.stringContaining(
      "Sale.name is not an email field, a phone field or a field that refers to User",
    ),
  ]);
});

test("a list mail goes by mail alone", () => {
  const list = (to: string) =>
    problems(
      `  todays:\n    when: morning\n    to: ${to}\n    recipient: admin\n    list: { model: Sale, columns: [number, status] }\n`,
    );
  expect(list("mail")).toEqual([]);
  expect(list("[mail]")).toEqual([]);
  for (const to of ["push", "sms", "[mail, push]"])
    expect(list(to)).toEqual([
      expect.stringContaining("is a list mail, which goes by mail alone: push and sms"),
    ]);
  const files = { spec: SPEC, auth: AUTH };
  const op = applyOperation(files, "addOutgoing", {
    outgoing: "todays",
    when: "morning",
    to: "mail,sms",
    recipient: "admin",
    list: "Sale",
    columns: ["number"],
  });
  expect(op.ok ? "" : op.message).toContain("A list mail goes by mail alone");
});

test("a visitor-typed phone number is not texted, as a typed address is not mailed", () => {
  const ir = read(`  thanks:
    when: Sale created
    to: mail
    recipient: email
  text:
    when: Sale created
    to: sms
    recipient: phone
  staffTold:
    when: Sale created
    to: [mail, push]
    recipient: staff
`).ir;
  if (!ir) throw new Error("spec");
  const warnings = (extra: string) =>
    validateAuth({ path: "smithable.auth.yml", text: `${AUTH}${extra}` }, ir)
      .diagnostics.filter((d) => d.code === "visitor-typed-recipient")
      .map((d) => d.message);
  expect(warnings("public: { create: [Sale] }\n")).toEqual([
    expect.stringContaining("type any address in email"),
    expect.stringContaining(
      'type any number in phone, so the app does not send "text" to it: a stranger could make the app text anyone',
    ),
  ]);
  expect(warnings("")).toEqual([]);
});

test("a push's or a text's subject that names a person warns: it shows on a locked screen", () => {
  const spec = read(`  pushed:
    when: Sale created
    to: [mail, push]
    recipient: staff
  texted:
    when: ready
    to: sms
    recipient: phone
  mailed:
    when: Sale created
    to: mail
    recipient: staff
`).ir;
  if (!spec) throw new Error("spec");
  const codes = (entry: string, subject: string, text = "") =>
    validateContent(
      {
        path: "smithable.content.yml",
        text: `smithableContent: 0.1\noutgoing:\n  ${entry}: { subject: ${JSON.stringify(subject)}${text ? `, text: ${JSON.stringify(text)}` : ""} }\n`,
      },
      spec,
    ).diagnostics.map((d) => `${d.severity} ${d.code}`);
  const locked = "warning subject-on-locked-screen";
  expect(codes("pushed", "New order {number} for {status}")).toEqual([]);
  expect(codes("pushed", "New order from {email}")).toEqual([locked]);
  expect(codes("texted", "Ready: {phone}")).toEqual([locked]);
  expect(codes("pushed", "For {taker}")).toEqual([locked]);
  expect(codes("pushed", "For {customer.phone}")).toEqual([locked]);
  expect(codes("pushed", "From {by}")).toEqual([locked]);
  // A title is its field's: a guest named by the person they are.
  expect(codes("pushed", "For {guest}")).toEqual([locked]);
  expect(codes("pushed", "{title}")).toEqual([]);
  // A record's name field is not known to be a person's by its type; the text is not on the screen.
  expect(codes("pushed", "Sale {customer} {name}", "From {email}")).toEqual([]);
  // A mail alone is not shown on a locked screen.
  expect(codes("mailed", "New order from {email} {by}")).toEqual([]);
});

test("addOutgoing takes channels separated by commas, each checked against the recipient", () => {
  const files = { spec: SPEC, auth: AUTH };
  const added = applyOperation(files, "addOutgoing", {
    outgoing: "placed",
    when: "Sale created",
    to: "push,mail",
    recipient: "staff",
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toContain(
    "outgoing:\n  placed:\n    when: Sale created\n    to: [mail, push]\n    recipient: staff\n",
  );
  expect(added.description).toBe("Add placed: when Sale created, mail and push staff");
  const one = applyOperation(files, "addOutgoing", {
    outgoing: "texted",
    when: "ready",
    to: "sms",
    recipient: "customer.phone",
  });
  if (!one.ok) throw new Error(one.message);
  expect(one.files.spec).toContain("    to: sms\n    recipient: customer.phone\n");
  const refuse = (args: Record<string, string>) => {
    const r = applyOperation(files, "addOutgoing", {
      outgoing: "x",
      when: "Sale created",
      ...args,
    });
    return r.ok ? "" : r.message;
  };
  expect(refuse({ to: "mail,sms", recipient: "email" })).toContain(
    "Sms cannot reach an email field",
  );
  expect(refuse({ to: "mail,kitchen", recipient: "staff" })).toContain("a target is named alone");
  expect(refuse({ to: "push" })).toContain(
    "Push needs a recipient: --recipient owner, a role, or a field with an address",
  );
  expect(refuse({ to: "push" })).toContain("OUTGOING_PUSH_URL");
  expect(refuse({ to: "mail,push" })).toContain("Mail and push need a recipient");
  expect(refuse({ to: "kitchen", recipient: "staff" })).toContain(
    '"recipient" is for mail, push and sms',
  );
});

test("setOutgoingTo changes an entry's channels or target, with the reader's checks", () => {
  const files = {
    spec: `${SPEC}outgoing:\n  placed:\n    when: Sale created\n    to: mail\n    recipient: staff\n  feed:\n    when: Sale created\n    to: kitchen\n  todays:\n    when: morning\n    to: mail\n    recipient: admin\n    list: { model: Sale, columns: [number] }\n`,
    auth: AUTH,
  };
  const set = (
    args: { outgoing: string; to: string; recipient?: string },
    from: Parameters<typeof applyOperation>[0] = files,
  ) => applyOperation(from, "setOutgoingTo", args);
  const both = set({ outgoing: "placed", to: "mail,push" });
  if (!both.ok) throw new Error(both.message);
  expect(both.files.spec).toContain("    to: [mail, push]\n    recipient: staff\n");
  expect(both.description).toBe("Let placed mail and push");
  // Back to one channel; and to a target, whose own address replaces the recipient.
  const back = set({ outgoing: "placed", to: "mail" }, both.files);
  if (!back.ok) throw new Error(back.message);
  expect(back.files.spec).toContain(
    "  placed:\n    when: Sale created\n    to: mail\n    recipient: staff\n",
  );
  const target = set({ outgoing: "placed", to: "kitchen" });
  if (!target.ok) throw new Error(target.message);
  expect(target.files.spec).toContain(
    "  placed:\n    when: Sale created\n    to: kitchen\n  feed:",
  );
  // A target to channels needs a recipient; a recipient given changes it with the channels.
  expect(set({ outgoing: "feed", to: "push" }).ok).toBe(false);
  const pushed = set({ outgoing: "feed", to: "push,sms", recipient: "taker" });
  if (!pushed.ok) throw new Error(pushed.message);
  expect(pushed.files.spec).toContain(
    "  feed:\n    when: Sale created\n    to: [push, sms]\n    recipient: taker\n",
  );
  const texted = set({ outgoing: "placed", to: "sms", recipient: "phone" });
  if (!texted.ok) throw new Error(texted.message);
  expect(texted.files.spec).toContain("    to: sms\n    recipient: phone\n");
  // The checks: reach, a target with a recipient, a list mail, an unknown entry.
  const refused = (args: { outgoing: string; to: string; recipient?: string }) => {
    const r = set(args);
    return r.ok ? "" : r.message;
  };
  expect(refused({ outgoing: "placed", to: "mail,sms", recipient: "email" })).toContain(
    "Sms cannot reach an email field",
  );
  expect(refused({ outgoing: "placed", to: "kitchen", recipient: "staff" })).toContain(
    "A target has its own address",
  );
  expect(refused({ outgoing: "todays", to: "push" })).toContain(
    '"todays" is a list mail, which goes by mail alone',
  );
  expect(set({ outgoing: "todays", to: "mail" }).ok).toBe(true);
  // A recipient missing when a target becomes a channel is not taken for an old target's name.
  expect(refused({ outgoing: "feed", to: "push" })).not.toContain("OUTGOING_PUSH_URL");
  expect(refused({ outgoing: "nothing", to: "mail" })).toContain('nothing named "nothing"');
});

test("the JSON Schema takes a channel, a list of channels or a target, and no other list", () => {
  const validate = new Ajv({ allErrors: true })
    .addVocabulary(["x-hidden", "x-suggest", "x-examples", "x-unset", "x-semantic", "x-docs"])
    .compile(buildJsonSchema());
  const entry = (to: string) =>
    validate(
      parse(
        `${SPEC}outgoing:\n  x:\n    when: Sale created\n    to: ${to}\n    recipient: staff\n`,
      ),
    );
  expect(entry("push")).toBe(true);
  expect(entry("[mail, push, sms]")).toBe(true);
  expect(entry("kitchen")).toBe(true);
  expect(entry("[mail, kitchen]")).toBe(false);
  expect(entry("[mail, mail]")).toBe(false);
  expect(entry("[]")).toBe(false);
});
