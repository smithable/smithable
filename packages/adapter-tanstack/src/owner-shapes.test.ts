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

describe("the support portal: an owner by address and one step away", () => {
  const app = generate(spec, authText, uxText);
  const cases = app.file("src/generated/support-case.server.ts");
  const messages = app.file("src/generated/message.server.ts");

  test("the spec is in order", () => {
    expect(app.errors).toEqual([]);
  });

  test("a case belongs to whoever signed in as its address, proven; the comparison is lower-case and trimmed", () => {
    expect(cases).toContain("const address = viewer.proven ? addressOf(viewer) : null;");
    expect(cases).toContain(
      "return address ? eq(sql`lower(trim(${schema.supportCases.customerEmail}))`, address) : sql`false`;",
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

  test("on create the address is the viewer's own unless they may choose; a visitor's form takes the address written", () => {
    expect(cases).toContain(
      "const owner = !viewer || chooses(viewer) ? (given ?? addressOf(viewer)) : addressOf(viewer);",
    );
    expect(cases).toContain(
      "values({ ...values, customerEmail: ownerFor(viewer, values.customerEmail) })",
    );
    // On a change a chooser gives it or it stays; anyone else keeps the record's own.
    expect(cases).toContain(
      "const updated = { ...values, customerEmail: chooses(viewer) && values.customerEmail !== undefined ? values.customerEmail : row.customerEmail };",
    );
    // Visitors' cases are counted in the audit log, since no owner column tells them apart.
    expect(cases).toContain(
      'from(schema.auditLog).where(and(eq(schema.auditLog.who, "visitor"), eq(schema.auditLog.action, "created"), eq(schema.auditLog.model, "SupportCase")))',
    );
  });

  test("a message belongs to its case's owner, one step: read through the case, and the case must be readable", () => {
    expect(messages).toContain(
      "return inArray(schema.messages.supportCaseId, db.select({ id: schema.supportCases.id }).from(schema.supportCases).where(supportCaseData.own(viewer)));",
    );
    expect(messages).toContain(
      "whose(viewer: Viewer | null, row: { supportCaseId: number | null }): string | null {",
    );
    expect(messages).toContain(
      "return parent ? addressOwner(parent.customerEmail, viewer) : null;",
    );
    // The case named must be one the viewer may read (checkReferences), on create and on change.
    expect(messages).toContain(
      "if (values.supportCaseId != null && !supportCaseData.canRead(viewer, values.supportCaseId))",
    );
    expect(messages).toContain("checkReferences(viewer, updated);");
    // And the reference is locked once the message exists.
    expect(messages).toContain(
      '"supportCaseId" in given && JSON.stringify(given.supportCaseId ?? null) !== JSON.stringify(before.supportCaseId ?? null)) throw new BadInput(w.cannotChangeNow("Support case"));',
    );
    // No owner column beside the values: the message's case is in them.
    expect(messages).toContain(
      "const made = tx.insert(schema.messages).values({ ...values, agentId: personOf(viewer) })",
    );
    expect(messages).not.toContain("ownerFor(");
  });

  test("the record page and the action check the owner by kind; one step away only the server knows", () => {
    const caseModule = app.file("src/generated/support-case.ts");
    expect(caseModule).toContain(
      "canWrite: allows(supportCaseAccess.write, viewer, addressOwner(row.customerEmail, viewer)),",
    );
    expect(app.file("src/generated/message.ts")).toContain(
      "canWrite: allows(messageAccess.write, viewer, messageData.whose(viewer, row)),",
    );
    expect(app.file("src/generated/actions/close.server.ts")).toContain(
      "check(closeAccess, viewer, addressOwner(row.customerEmail, viewer));",
    );
    expect(app.file("src/routes/cases/$id.tsx")).toContain(
      "allows(closeAccess, viewer, addressOwner(row.customerEmail, viewer)) && closeFits(row, viewer)",
    );
  });

  test("a written actions grant: customers run no action, their own cases included", () => {
    expect(app.file("src/generated/actions/close.ts")).toContain(`export const closeAccess: Rule = {
  public: false,
  roles: ["admin", "agent"],
  owner: true,
  among: ["admin", "agent"],
};`);
  });

  test("the reply box writes our side for a viewer who reads everyone's messages, the other side for anyone else; the server checks it", () => {
    expect(app.file("src/routes/cases/$id.tsx")).toContain(
      'await createMessage({ data: { content: text, supportCaseId: row.id, sender: readScope(messageAccess.read, viewer) === "all" ? "agent" : "customer" } as never });',
    );
    expect(messages).toContain(
      'if (readScope(messageAccess.read, viewer) !== "all") values = { ...values, sender: "customer" };',
    );
    expect(messages).toContain(
      'if (readScope(messageAccess.read, viewer) !== "all" && "sender" in updated) updated.sender = "customer";',
    );
    // Unread marks go by who wrote a message (its agent), not by whose it is.
    expect(cases).toContain("at: target.createdAt, by: target.agentId }");
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

  test("an owner one step away from a User owner compares the user's id, with no viewer needed", () => {
    const crm = generate(
      `smithable: 0.1
app: { name: CRM }
models:
  Customer:
    fields:
      name: string!
      accountManager: User
      orders: Order[]
    ownedBy: accountManager
  Order:
    fields: { number: string!, customer: Customer! }
    ownedBy: customer
pages:
  customers: { crud: Customer }
  orders: { crud: Order }
`,
      "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: private\nroles:\n  admin: all\n  sales: { pages: all, create: all }\ndefaultRole: sales\n",
    );
    expect(crm.errors).toEqual([]);
    const orders = crm.file("src/generated/order.server.ts");
    expect(orders).toContain(
      "return inArray(schema.orders.customerId, db.select({ id: schema.customers.id }).from(schema.customers).where(eq(schema.customers.accountManagerId, viewer.id)));",
    );
    expect(orders).toContain(
      "whose(_viewer: Viewer | null, row: { customerId: number | null }): string | null {",
    );
    expect(orders).toContain("return parent ? parent.accountManagerId : null;");
    expect(orders).not.toContain("addressOwner");
  });
});
