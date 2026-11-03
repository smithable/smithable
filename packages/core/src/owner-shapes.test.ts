import { describe, expect, test } from "vitest";
import { actionAccess } from "./access.js";
import { assistantOffer } from "./assistant.js";
import { type AuthIR, validateAuth } from "./auth.js";
import { explainAccess } from "./explain-access.js";
import type { SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";

// An owner that is an address, and an owner one reference away (docs/design/support-portal-path.md
// §2), and a role whose written actions grant is the whole of what it runs (§3).
const portal = `smithable: 0.1
app: { name: Portal }
models:
  SupportCase:
    fields:
      subject: string!
      customerEmail: { type: email!, locked: true }
      status: open | closed
      messages: Message[]
    ownedBy: customerEmail
  Message:
    fields:
      content: text!
      sender: agent | customer
      supportCase: SupportCase!
      attachments: Attachment[]
    ownedBy: supportCase
  Attachment:
    fields:
      name: string!
      message: Message!
  Article:
    fields:
      title: string!
      body: text
pages:
  cases: { crud: SupportCase }
  knowledge: { crud: Article }
actions:
  close:
    on: SupportCase
    when: { status: open }
    set: { status: closed }
  reopen:
    on: SupportCase
    when: { status: closed }
    set: { status: open }
`;
const authText = `smithableAuth: 0.1
signIn: { providers: [email], selfSignUp: true }
defaultAccess: private
roles:
  admin: all
  agent: { pages: all, read: all, create: all, write: all, actions: all }
  customer:
    pages: [cases, knowledge]
    create: [SupportCase, Message]
    actions: none
  reader:
    pages: [cases]
  picker:
    pages: [cases]
    actions: [reopen]
defaultRole: customer
`;

function load(spec: string, auth = authText) {
  const roles = validateAuth({ path: "smithable.auth.yml", text: auth }).auth?.roles.map(
    (r) => r.name,
  );
  const checked = validateSpec({ path: "smithable.yml", text: spec }, roles ? { roles } : {});
  const ir = checked.ir as SpecIR;
  const authIr = validateAuth({ path: "smithable.auth.yml", text: auth }, ir).auth as AuthIR;
  return { checked, ir, auth: authIr };
}

const errors = (spec: string) =>
  validateSpec({ path: "smithable.yml", text: spec })
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => `${d.code}: ${d.message}`);

describe("ownedBy takes a User field, an email field, or a reference one step away", () => {
  test("the IR says which kind the owner is", () => {
    const { checked, ir } = load(portal);
    expect(checked.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const kinds = Object.fromEntries(ir.models.map((m) => [m.name, m.ownerKind]));
    expect(kinds).toEqual({
      SupportCase: "address",
      Message: "through",
      Attachment: undefined,
      Article: undefined,
    });
    const crm = load(`smithable: 0.1
app: { name: CRM }
models:
  Customer:
    fields: { name: string!, accountManager: User }
    ownedBy: accountManager
pages:
  customers: { crud: Customer }
`);
    expect(crm.ir.models[0]?.ownerKind).toBe("user");
  });

  test("a chain of two references is refused in plain words", () => {
    const chained = portal.replace(
      "      message: Message!\n",
      "      message: Message!\n    ownedBy: message\n",
    );
    expect(errors(chained)).toEqual([
      `invalid-owner: "ownedBy" of "Attachment": message refers to Message, whose owner is supportCase, itself a reference: an owner is one step away, never two.`,
    ]);
  });

  test("a reference to a model without an owner is refused", () => {
    const ownerless = portal.replace("    ownedBy: customerEmail\n", "");
    expect(errors(ownerless)).toEqual([
      `invalid-owner: "ownedBy" of "Message": supportCase refers to SupportCase, which has no "ownedBy": a record one step away owns it only when that record has an owner of its own.`,
    ]);
  });

  test("any other field is refused, naming the fields that can own", () => {
    const text = portal.replace("    ownedBy: customerEmail\n", "    ownedBy: subject\n");
    expect(errors(text)).toEqual([
      `invalid-owner: "ownedBy" of "SupportCase": subject is a string: an owner is a User field, an email field, or a reference to a record with an owner.`,
      `invalid-owner: "ownedBy" of "Message": supportCase refers to SupportCase, whose "ownedBy" (subject) is not in order: a record one step away owns it only when that record has an owner of its own.`,
    ]);
    const unknown = portal.replace("    ownedBy: customerEmail\n", "    ownedBy: customerEmial\n");
    const [message] = validateSpec({ path: "smithable.yml", text: unknown }).diagnostics.filter(
      (d) => d.code === "invalid-owner",
    );
    expect(message?.message).toContain("must name one of its fields");
    expect(message?.hint).toContain("customerEmail");
  });
});

describe("a written actions grant is the whole of what the role runs", () => {
  const { ir, auth } = load(portal);
  const close = ir.actions.find((a) => a.name === "close");
  if (!close) throw new Error("no close");

  test("actions: none parses as a written grant of nothing", () => {
    expect(auth.roles.find((r) => r.name === "customer")?.grants).toEqual({
      pages: ["cases", "knowledge"],
      create: ["SupportCase", "Message"],
      actions: [],
    });
    expect(auth.roles.find((r) => r.name === "reader")?.grants).toEqual({ pages: ["cases"] });
  });

  test("a self-reference is a chain too, refused without looping", () => {
    expect(
      errors(`smithable: 0.1
app: { name: Tree }
models:
  Category:
    fields:
      name: string!
      parent: Category
      children: Category[]
    ownedBy: parent
pages:
  categories: { crud: Category }
`),
    ).toEqual([
      `invalid-owner: "ownedBy" of "Category": parent refers to Category, whose owner is parent, itself a reference: an owner is one step away, never two.`,
    ]);
  });

  test("none is a grant for actions only; the other grants keep their parse", () => {
    const other = validateAuth({
      path: "smithable.auth.yml",
      text: authText.replace(
        "    pages: [cases]\n    actions: [reopen]",
        "    pages: none\n    actions: [reopen]",
      ),
    });
    expect(other.diagnostics.map((d) => d.message)).toContain(
      '"pages" of role "picker" is "all" or a list of names, like [a, b].',
    );
  });

  test("the owner rule stands for every role but one with actions none", () => {
    const allowed = actionAccess(close, auth, ir.models);
    expect(allowed).toEqual({
      public: false,
      roles: ["admin", "agent"],
      owner: true,
      among: ["admin", "agent", "reader", "picker"],
    });
    // Without a role that wrote the key, nothing is said beyond the owner rule.
    const plain = load(
      portal,
      authText
        .replace("    actions: none\n", "")
        .replace(/ {2}picker:[\s\S]*?\n(?=defaultRole)/, ""),
    );
    expect(actionAccess(plain.ir.actions[0] as typeof close, plain.auth, plain.ir.models)).toEqual({
      public: false,
      roles: ["admin", "agent"],
      owner: true,
    });
  });

  test("explain says so, in plain words", () => {
    const own = { kind: "action" as const, action: "close" };
    const customer = explainAccess(ir, auth, { as: "customer", record: "own" }, own, "run");
    expect(customer.verdict).toBe("denied");
    expect(customer.reasons.at(-1)).toEqual({
      at: { file: "smithable.auth.yml", path: "roles.customer.actions" },
      text: "customer's actions grant is none: customers run no action, not on their own support cases either.",
    });
    // A list keeps today's meaning: beside the named actions, the owner's own.
    const picker = explainAccess(
      ir,
      auth,
      { as: "picker", record: "own", values: { status: "open" } },
      own,
      "run",
    );
    expect(picker.verdict).toBe("allowed");
    const reader = explainAccess(
      ir,
      auth,
      { as: "reader", record: "own", values: { status: "open" } },
      own,
      "run",
    );
    expect(reader.verdict).toBe("allowed");
  });
});

describe("whose a record is, in words", () => {
  const { ir, auth } = load(portal);

  test("explain: a case belongs to whoever signed in as its address; a message to its case's owner", () => {
    const cases = { kind: "model" as const, model: "SupportCase" };
    const own = explainAccess(ir, auth, { as: "customer", record: "own" }, cases, "read");
    expect(own.verdict).toBe("allowed");
    expect(own.reasons.at(-1)?.text).toBe(
      "This support case is their own: a support case belongs to whoever signed in as its customer email, and they did.",
    );
    const other = explainAccess(ir, auth, { as: "customer", record: "another's" }, cases, "read");
    expect(other.verdict).toBe("denied");
    expect(other.reasons.at(-1)?.text).toBe(
      "This support case is someone else's: a support case belongs to whoever signed in as its customer email, and that is another person.",
    );
    const none = explainAccess(ir, auth, { as: "customer", record: "ownerless" }, cases, "read");
    expect(none.reasons.at(-1)?.text).toBe(
      "This support case has no owner: its customer email is empty.",
    );
    const messages = { kind: "model" as const, model: "Message" };
    const message = explainAccess(ir, auth, { as: "customer", record: "own" }, messages, "write");
    expect(message.reasons.at(-1)?.text).toBe(
      "This message is their own: a message belongs to its support case's owner.",
    );
  });

  test("the assistant's words", () => {
    const offer = assistantOffer(ir, auth, { role: "agent" }, { scope: "app" });
    expect(offer.kinds.find((k) => k.model === "SupportCase")?.description).toContain(
      "A record belongs to whoever signed in as its customerEmail.",
    );
    expect(offer.kinds.find((k) => k.model === "Message")?.description).toContain(
      "A record belongs to its supportCase's owner.",
    );
  });
});
