import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
  validateUx,
} from "@smithable/core";
import { describe, expect, test } from "vitest";
import { generateApp } from "./generate.js";

// An owner that is an address, and an owner one reference away (docs/design/support-portal-path.md
// §2); a role whose written actions grant is the whole of what it runs (§3); the reply box's side by
// who the viewer is (§4). The support portal's spec, as the note has it, before it is a starter.
const spec = `smithable: 0.1
app: { name: Portal }
models:
  SupportCase:
    fields:
      subject: string!
      customerEmail: { type: email!, locked: true }
      status: open | closed
      body: text
      attachments: files
      messages: Message[]
    ownedBy: customerEmail
  Message:
    fields:
      content: text!
      sender: agent | customer
      agent: { type: User, by: app, default: ME() }
      attachments: files
      supportCase: SupportCase!
    ownedBy: supportCase
pages:
  cases:
    crud: SupportCase
    actions: [close]
  support:
    route: /
    landing:
      hero: { button: cases }
      contact: { form: SupportCase }
actions:
  close:
    on: SupportCase
    when: { status: open }
    set: { status: closed }
`;
const authText = `smithableAuth: 0.1
signIn: { providers: [email], selfSignUp: true }
defaultAccess: private
roles:
  admin: all
  agent: { pages: all, read: all, create: all, write: all, actions: all }
  customer:
    pages: [cases]
    create: [SupportCase, Message]
    actions: none
defaultRole: customer
public:
  pages: [support]
  create: [SupportCase]
`;
const uxText = `smithableUx: 0.1
pages:
  cases:
    record:
      lists: { messages: thread }
`;

function generate(specText: string, auth: string, ux?: string) {
  const roles = validateAuth({ path: "smithable.auth.yml", text: auth }).auth?.roles.map(
    (r) => r.name,
  );
  const checked = validateSpec({ path: "smithable.yml", text: specText }, roles ? { roles } : {});
  if (!checked.ir)
    throw new Error(checked.diagnostics.map((d) => `${d.code}: ${d.message}`).join("\n"));
  const ir = checked.ir as SpecIR;
  const checkedAuth = validateAuth({ path: "smithable.auth.yml", text: auth }, ir);
  if (!checkedAuth.auth)
    throw new Error(checkedAuth.diagnostics.map((d) => `${d.code}: ${d.message}`).join("\n"));
  const authIr = checkedAuth.auth;
  const uxIr = ux ? validateUx({ path: "smithable.ux.yml", text: ux }, ir).ux : undefined;
  const files = generateApp(ir, {
    smithableVersion: "0.0.0",
    auth: authIr,
    content: emptyContent(),
    ...(uxIr ? { ux: uxIr } : {}),
  });
  return {
    errors: checked.diagnostics.filter((d) => d.severity === "error"),
    file: (path: string) => files.find((f) => f.path === path)?.content ?? "",
  };
}

describe("the support portal: an owner by address, and reading through a reference", () => {
  const app = generate(spec, authText, uxText);
  const cases = app.file("src/generated/support-case.server.ts");
  const messages = app.file("src/generated/message.server.ts");

  test("the spec is in order", () => {
    expect(app.errors).toEqual([]);
  });

  test("a case belongs to whoever signed in as its address, proven; stored and compared lower-case and trimmed", () => {
    expect(cases).toContain("const address = viewer.proven ? addressOf(viewer) : null;");
    expect(cases).toContain(
      "return address ? eq(schema.supportCases.customerEmail, address) : sql`false`;",
    );
    expect(cases).toContain(
      'return scope === "own" && viewer ? supportCaseData.own(viewer) : sql`false`;',
    );
    // Whose a case is, as allows compares it: the viewer, or no one they can be.
    expect(cases).toContain("return addressOwner(row.customerEmail, viewer);");
    expect(cases).toContain(
      'if (what === "changed") check(supportCaseAccess.write, viewer, addressOwner(row.customerEmail, viewer));',
    );
    // The viewer's sign-in says whether the address is proven.
    expect(app.file("src/lib/viewer.server.ts")).toContain(
      "return { id, name, email, role, proven: emailVerified === true };",
    );
  });

  test("on create the address is the viewer's own proven one unless they may choose; a visitor's form takes the address written", () => {
    expect(cases).toContain(
      "const asAddress = (given: string | null | undefined) => given?.trim().toLowerCase() || null;",
    );
    expect(cases).toContain(
      'throw new AccessDenied(true, "Prove your address first: sign in with a code sent to it, or with a provider that has confirmed it.");',
    );
    expect(cases).toContain(
      "values({ ...values, customerEmail: ownerFor(viewer, values.customerEmail) })",
    );
    // On a change: left out it stays; given, a chooser's as written, anyone else's own.
    expect(cases).toContain(
      "const updated = { ...values, customerEmail: values.customerEmail === undefined || !chooses(viewer) ? row.customerEmail : ownerFor(viewer, values.customerEmail) };",
    );
    // Visitors' cases are counted in the audit log, the last day, since no owner column tells them apart.
    expect(cases).toContain(
      'eq(schema.auditLog.model, "SupportCase"), gt(schema.auditLog.at, new Date(Date.now() - 24 * 60 * 60 * 1000))',
    );
    // ownerFor is the data function's too: an action's add, a copy, a split and a merge give the owner as create() does.
    expect(cases).toContain("\n  ownerFor,\n");
  });

  test("owning through a reference is reading: a message keeps its creator, and is read through its case", () => {
    expect(messages).toContain(
      "return or(eq(schema.messages.ownerId, viewer.id), inArray(schema.messages.supportCaseId, db.select({ id: schema.supportCases.id }).from(schema.supportCases).where(supportCaseData.readable(viewer)))) as SQL;",
    );
    expect(messages).not.toContain("whose(");
    // The creator's column, as a model without ownedBy has it: change and delete are the creator's.
    expect(messages).toContain(
      "const made = tx.insert(schema.messages).values({ ...values, ownerId: personOf(viewer), agentId: personOf(viewer) })",
    );
    expect(messages).toContain(
      'if (what === "changed") check(messageAccess.write, viewer, row.ownerId);',
    );
    expect(messages).toContain("function shownTo<R extends { ownerId: string | null }>");
    // The case named must be one the viewer may read (checkReferences), on create and on change.
    expect(messages).toContain(
      "if (values.supportCaseId != null && !supportCaseData.canRead(viewer, values.supportCaseId))",
    );
    expect(messages).toContain("checkReferences(viewer, updated);");
    // And the reference is locked once the message exists.
    expect(messages).toContain(
      '"supportCaseId" in given && JSON.stringify(given.supportCaseId ?? null) !== JSON.stringify(before.supportCaseId ?? null)) throw new BadInput(w.cannotChangeNow("Support case"));',
    );
    expect(app.file("src/generated/message.schema.ts")).toContain(
      "omit({ id: true, ownerId: true,",
    );
  });

  test("the record page and the actions check the owner by kind, on the client too", () => {
    expect(app.file("src/generated/support-case.ts")).toContain(
      "canWrite: allows(supportCaseAccess.write, viewer, addressOwner(row.customerEmail, viewer)),",
    );
    expect(app.file("src/generated/message.ts")).toContain(
      "canWrite: allows(messageAccess.write, viewer, row.ownerId),",
    );
    expect(app.file("src/generated/actions/close.server.ts")).toContain(
      "check(closeAccess, viewer, addressOwner(row.customerEmail, viewer));",
    );
    expect(app.file("src/routes/cases/$id.tsx")).toContain(
      "allows(closeAccess, viewer, addressOwner(row.customerEmail, viewer)) && closeFits(row, viewer)",
    );
  });

  test("actions none: customers run no action, their own cases included", () => {
    expect(app.file("src/generated/actions/close.ts")).toContain(`export const closeAccess: Rule = {
  public: false,
  roles: ["admin", "agent"],
  owner: true,
  among: ["admin", "agent"],
};`);
  });

  test("the reply box writes our side for a role granted read or write on everyone's messages, the other side for anyone else; the server checks it", () => {
    expect(app.file("src/generated/message.ts")).toContain(
      'export const messageOurs: string[] = ["admin", "agent"];',
    );
    expect(app.file("src/routes/cases/$id.tsx")).toContain(
      'await createMessage({ data: { content: text, supportCaseId: row.id, sender: viewer && messageOurs.includes(viewer.role) ? "agent" : "customer" } as never });',
    );
    expect(messages).toContain('if (!ours(viewer)) values = { ...values, sender: "customer" };');
    expect(messages).toContain(`    if (!ours(viewer)) {
      if (before.sender === "agent") throw new AccessDenied(viewer !== null);
      updated.sender = "customer";
    }`);
    // Unread marks go by who wrote a message (its creator), as for any message model.
    expect(cases).toContain("or(isNull(target.ownerId), ne(target.ownerId, viewer.id)), gt(target.createdAt");
  });

  test("the side rule holds without the ux file too: a mail's reply makes the model a message model", () => {
    const plain = generate(spec, authText);
    expect(plain.file("src/generated/message.ts")).not.toContain("messageOurs");
    const mailed = generate(
      `${spec}incoming:
  support:
    mail: true
    create: SupportCase
    fields: { from: customerEmail, subject: subject, body: body }
    reply:
      create: Message
      fields: { body: content }
      set: { sender: customer }
`,
      authText,
    );
    expect(mailed.errors).toEqual([]);
    expect(mailed.file("src/generated/message.ts")).toContain("messageOurs");
  });

  test("a record's files follow its data function, so a message's attachments are read as the message is", () => {
    expect(app.file("src/generated/uploads.ts")).toContain(
      '"attachments": { kind: "file", data: messageData, access: messageAccess, key: "attachments" },',
    );
    expect(app.file("src/routes/files/$model.$id.$field.ts")).toContain(
      "const row = (await entry.data.get(await currentViewer(), id))",
    );
    expect(messages).toContain(
      "where: and(eq(schema.messages.id, id), messageData.readable(viewer)),",
    );
  });

  test("a creator changes and deletes their own message: the creator's column is selected and checked", () => {
    expect(messages).toContain(
      ".select({ ownerId: schema.messages.ownerId, attachments: schema.messages.attachments })",
    );
    expect(messages).toContain("check(messageAccess.delete, viewer, row.ownerId);");
    // Only reading reaches through the case: own(viewer) is the read scope's and nothing else's.
    expect(messages.match(/messageData\.own\(viewer\)/g)?.length).toBe(1);
  });

  test("a chooser clearing an optional address owner gets none; left out, their own", () => {
    expect(cases).toContain(
      "const owner = !viewer ? asAddress(given) : chooses(viewer) ? (given === undefined ? addressOf(viewer) : asAddress(given)) : addressOf(viewer);",
    );
    expect(cases).toContain(
      "viewer ? (personOf(viewer) ? `Name the customer email (customerEmail).`",
    );
  });

  test("a record made beside another takes that record's address, never the viewer's; a chooser's value wins", () => {
    // A chooser's explicit value wins; anyone else never gets a value they supplied: the source's
    // address, else their own through ownerFor (the proof and the key's refusal with it).
    expect(cases).toContain("if (viewer && chooses(viewer) && given !== undefined) {");
    expect(cases).toContain("return asAddress(from) ?? ownerFor(viewer, undefined);");
    expect(cases).toContain("\n  chooses,\n  ownerLike,\n");
    const escalated = generate(
      `${spec}  escalate:
    on: SupportCase
    add:
      Escalation: { reason: Escalated by the team. }
`.replace(
        "pages:",
        `  Escalation:
    fields:
      reason: text!
      customerEmail: email!
      supportCase: SupportCase!
    ownedBy: customerEmail
pages:`,
      ),
      authText,
    );
    expect(escalated.errors).toEqual([]);
    const action = escalated.file("src/generated/actions/escalate.server.ts");
    expect(action).toContain("source: row.customerEmail,");
    expect(action).toContain("added0: escalationSettable.partial({ customerEmail: true }).parse({");
    expect(action).toContain(
      "customerEmail: escalationData.ownerLike(viewer, one.added0.customerEmail, one.source)",
    );
    // Added beside a record that is not address-owned: ownerFor's rule (their own, or the chooser's value).
    const fromMessage = generate(
      `${spec}  escalate:
    on: Message
    add:
      Escalation: { reason: Escalated by the team. }
`.replace(
        "pages:",
        `  Escalation:
    fields:
      reason: text!
      customerEmail: email!
      message: Message!
    ownedBy: customerEmail
pages:`,
      ),
      authText,
    );
    expect(fromMessage.errors).toEqual([]);
    const other = fromMessage.file("src/generated/actions/escalate.server.ts");
    expect(other).not.toContain("source:");
    expect(other).toContain(
      "customerEmail: escalationData.ownerFor(viewer, one.added0.customerEmail)",
    );
    // On the action's own record, a non-chooser's plan keeps the owner as it was: an action without
    // adds goes through update() (above); one with adds writes in its own transaction.
    expect(app.file("src/generated/actions/close.server.ts")).not.toContain("ownerFor(");
    const retargets = generate(
      `${spec}  escalate:
    on: SupportCase
    set: { customerEmail: }
    add:
      Escalation: { reason: Escalated by the team. }
`.replace(
        "pages:",
        `  Escalation:
    fields:
      reason: text!
      customerEmail: email!
      supportCase: SupportCase!
    ownedBy: customerEmail
pages:`,
      ),
      authText,
    );
    expect(retargets.errors).toEqual([]);
    expect(retargets.file("src/generated/actions/escalate.server.ts")).toContain(
      "{ ...one.values, ...(one.values.customerEmail === undefined ? {} : { customerEmail: supportCaseData.chooses(viewer) ? supportCaseData.ownerFor(viewer, one.values.customerEmail) : before.customerEmail }) }",
    );
  });

  test("the visitors' cap is tested in the app, counted as audit() writes the lines", () => {
    const test = app.file("src/generated/access.test.ts");
    expect(test).toContain("visitors' support cases stop at the cap, counted in the audit log");
    expect(test).toContain('inArray(schema.auditLog.who, ["visitor", "the app"])');
    expect(test).toContain('import { and, count, eq, gt, inArray } from "drizzle-orm";');
    expect(test).toContain("gt(schema.auditLog.at, new Date(Date.now() - 24 * 60 * 60 * 1000))");
    expect(cases).toContain("(Number(process.env.VISITOR_ROWS) || 10000)");
    // The module imports what the cap's query uses.
    expect(cases).toMatch(/import \{[^}]*\bgt\b[^}]*\binArray\b[^}]*\} from "drizzle-orm";/);
  });

  test("a record added beside a form gets its owner as create() gives it, and its number per that owner", () => {
    const shop = generate(
      `smithable: 0.1
app: { name: Shop }
models:
  Customer:
    fields:
      name: string!
      email: email!
      orders: Order[]
    ownedBy: email
  Order:
    fields:
      number: { type: int!, sequence: true }
      customer: Customer!
      status: open | shipped
    ownedBy: customer
pages:
  customers: { crud: Customer, actions: [placeOrder] }
  orders: { crud: Order }
actions:
  placeOrder:
    on: Customer
    add:
      Order: { status: open }
`,
      "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: private\nroles:\n  admin: all\n  sales: { pages: all, create: all }\ndefaultRole: sales\n",
    );
    expect(shop.errors).toEqual([]);
    const action = shop.file("src/generated/actions/place-order.server.ts");
    // The order's creator owns it (through is reading), numbered per that creator.
    expect(action).toContain(", ownerId: personOf(viewer)");
    const orders = shop.file("src/generated/order.server.ts");
    expect(orders).toContain(
      "return or(eq(schema.orders.ownerId, viewer.id), inArray(schema.orders.customerId, db.select({ id: schema.customers.id }).from(schema.customers).where(customerData.readable(viewer)))) as SQL;",
    );
  });
});
