import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import { ANSWER_RULE, type AssistantOffer, asksWith, assistantOffer } from "./assistant.js";
import { type AuthIR, validateAuth } from "./auth.js";
import type { SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";

const spec = `smithable: 0.1
app: { name: Acme CRM, description: Customers and their orders. }
models:
  Customer:
    description: A company we sell to.
    fields:
      name: string!
      email: email unique
      segment: smb | enterprise
      creditLimit: money
      notes: text
      accountManager: User
      orders: Order[]
    ownedBy: accountManager
    rules:
      - Orders are held above the credit limit.
  Order:
    fields:
      number: string! unique
      customer: Customer!
      status: draft | placed | shipped
      total: money!
      placedOn: date
      rush: bool
actions:
  ship:
    on: Order
    when: { status: placed }
    set: { status: shipped }
pages:
  customers: { crud: Customer }
  orders: { crud: Order, actions: [ship] }
  team: { users: manage }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const authOf = (rest: string) => {
  const read = validateAuth(
    {
      path: "smithable.auth.yml",
      text: `smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: all, sales: { pages: all, create: all, write: [Order] }, viewer: { pages: all } }\ndefaultRole: viewer\n${rest}`,
    },
    ir,
  );
  if (!read.auth) throw new Error(read.diagnostics.map((d) => d.message).join("\n"));
  return read.auth as AuthIR;
};
const names = (tools: { name: string }[]) => tools.map((t) => t.name);
/** The kinds a tool may be used on, or nothing when the caller does not get the tool. */
const kindsOf = (offer: AssistantOffer, tool: string) => {
  const properties = offer.tools.find((t) => t.name === tool)?.inputSchema.properties as
    | { kind?: { enum: string[] } }
    | undefined;
  return properties?.kind?.enum;
};

test("a few tools whatever the app, and a line per kind of record the caller may reach", () => {
  const auth = authOf("api: { models: all, actions: all, assistants: true }\n");
  const sales = assistantOffer(ir, auth, { role: "sales" });
  expect(names(sales.tools)).toEqual([
    "find",
    "measure",
    "read",
    "add",
    "change",
    "run",
    "describe",
  ]);
  expect(sales.summary).toBe(
    [
      "Acme CRM: Customers and their orders.",
      "Customer (customers): name*, email, segment* (smb | enterprise), creditLimit (money), notes, accountManager -> User. Title: name.",
      "Order (orders): number*, customer* -> Customer, status* (draft | placed | shipped), total* (money), placedOn (date), rush (yes/no). Title: number.",
      "Actions: ship (Order, when status is placed).",
      "* required. You act as someone with the role sales.",
      ANSWER_RULE,
    ].join("\n"),
  );
  // Reading is marked as reading, and what changes records as changing: assistants that ask
  // their user before a risky call go by these.
  const marks = Object.fromEntries(sales.tools.map((t) => [t.name, t.annotations]));
  expect(marks.find).toEqual({ readOnlyHint: true, destructiveHint: false });
  expect(marks.add).toEqual({ readOnlyHint: false, destructiveHint: false });
  expect(marks.change).toEqual({ readOnlyHint: false, destructiveHint: true });
  expect(marks.run).toEqual({ readOnlyHint: false, destructiveHint: true });
});

test("the tools follow the role: no changing where it may not, deleting only where the spec and the role both say so", () => {
  const plain = authOf("api: { models: all, actions: all, assistants: true }\n");
  // A viewer may read everything (shared), add, and change their own records; sales anyone's orders.
  const viewer = assistantOffer(ir, plain, { role: "viewer" });
  expect(kindsOf(viewer, "change")).toEqual(["Customer", "Order"]);
  expect(names(viewer.tools)).not.toContain("delete");
  // Deleting is offered only with the line in the spec, and then only for what the role may delete.
  const deleting = authOf("api: { models: all, assistants: { delete: true } }\n");
  const del = (role: string) => kindsOf(assistantOffer(ir, deleting, { role }), "delete");
  expect(del("admin")).toEqual(["Customer", "Order"]);
  expect(del("sales")).toEqual(["Customer", "Order"]);
  // Only what the api block offers is reachable from outside.
  const one = assistantOffer(ir, authOf("api: { models: [Customer] }\n"), { role: "sales" });
  expect(one.kinds.map((k) => k.model)).toEqual(["Customer"]);
  expect(one.summary).not.toContain("Order (orders)");
  expect(names(one.tools)).not.toContain("run");
});

test("without a key the caller is the visitor: what is public, to read and to add, and nothing more", () => {
  const closed = assistantOffer(ir, authOf("api: { models: all, actions: all }\n"), "visitor");
  expect(closed.tools).toEqual([]);
  expect(closed.summary).toBe("Acme CRM: nothing is offered to a visitor, without a key.");
  const open = assistantOffer(
    ir,
    authOf("public: { read: [Order] }\napi: { models: all, actions: all }\n"),
    "visitor",
  );
  expect(names(open.tools)).toEqual(["find", "measure", "read", "describe"]);
  expect(open.kinds.map((k) => k.model)).toEqual(["Order"]);
  expect(open.actions).toEqual([]);
});

test("inside the app the assistant reaches what the person may, and never deletes", () => {
  const auth = authOf(
    "api: { models: [Customer], assistants: { delete: true } }\nassistant: { for: [admin], may: change }\n",
  );
  const inside = assistantOffer(ir, auth, { role: "admin" }, { scope: "app" });
  expect(inside.kinds.map((k) => k.model)).toEqual(["Customer", "Order"]);
  expect(names(inside.tools)).not.toContain("delete");
  expect(inside.actions).toEqual(["ship"]);
});

test("the assistant block: who gets Ask, whether it may change things, and what a visitor gets", () => {
  // Without the block nobody gets it.
  const none = authOf("");
  expect(asksWith(none, { role: "admin" })).toBe("nothing");
  // Some roles, reading only: inside the app it finds and counts and nothing more.
  const reading = authOf("assistant: { for: [admin, sales] }\n");
  expect(reading.assistant).toEqual({ for: ["admin", "sales"], may: "read" });
  expect(asksWith(reading, { role: "sales" })).toBe("model");
  expect(asksWith(reading, { role: "viewer" })).toBe("nothing");
  expect(asksWith(reading, "visitor")).toBe("nothing");
  expect(names(assistantOffer(ir, reading, { role: "sales" }, { scope: "app" }).tools)).toEqual([
    "find",
    "measure",
    "read",
    "describe",
  ]);
  // "change" adds adding, changing and the actions; never deleting.
  const changing = authOf("assistant: { for: signed-in, may: change }\n");
  expect(asksWith(changing, { role: "viewer" })).toBe("model");
  expect(names(assistantOffer(ir, changing, { role: "sales" }, { scope: "app" }).tools)).toEqual([
    "find",
    "measure",
    "read",
    "add",
    "change",
    "run",
    "describe",
  ]);
  // Visitors are answered by the wording rules only, never a model.
  const open = authOf("public: { read: [Order] }\nassistant: { for: anyone }\n");
  expect(asksWith(open, "visitor")).toBe("rules");
  expect(asksWith(open, { role: "viewer" })).toBe("model");
  // And inside the app a visitor's tools only read, whatever the block says may change and
  // whatever visitors may add (without a key, outside, adding stays theirs: the API's own rule).
  const wide = authOf(
    "public: { read: [Order], create: [Order] }\nassistant: { for: anyone, may: change }\n",
  );
  expect(names(assistantOffer(ir, wide, "visitor", { scope: "app" }).tools)).toEqual([
    "find",
    "measure",
    "read",
    "describe",
  ]);
  expect(names(assistantOffer(ir, wide, { role: "sales" }, { scope: "app" }).tools)).toContain(
    "add",
  );

  const codes = (rest: string) =>
    validateAuth(
      {
        path: "smithable.auth.yml",
        text: `smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: all, sales: { pages: all } }\ndefaultRole: sales\n${rest}`,
      },
      ir,
    )
      .diagnostics.filter((d) => d.code !== "open-shared-access")
      .map((d) => `${d.severity} ${d.code}`);
  expect(codes("assistant: { for: [support] }\n")).toEqual(["error unknown-role"]);
  expect(codes("assistant: { may: change }\n")).toEqual(["error missing-key"]);
  expect(codes("assistant: { for: everyone }\n")).toEqual(["error invalid-value"]);
  expect(codes("assistant: { for: [admin], may: delete }\n")).toEqual(["error invalid-value"]);
  // For anyone with nothing public: there is nothing to answer a visitor with.
  expect(codes("assistant: { for: anyone }\n")).toEqual(["warning assistant-nothing-public"]);
});

test("setAssistant switches Ask on for roles, for everyone or for anyone, and off again", () => {
  const files = {
    spec,
    auth: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: {}, sales: {} }\ndefaultRole: sales\n",
  };
  const on = applyOperation(files, "setAssistant", { for: ["admin", "sales"] });
  if (!on.ok) throw new Error(on.message);
  expect(on.description).toBe("Admin and Sales can ask the app questions; it changes nothing");
  expect(on.files.auth).toContain("assistant:\n  for: [admin, sales]\n");
  const more = applyOperation(on.files, "setAssistant", { for: ["signed-in"], may: "change" });
  if (!more.ok) throw new Error(more.message);
  expect(more.description).toBe(
    "Everyone who signs in can ask the app questions; it may also add and change records and run actions, each confirmed by the person",
  );
  expect(more.files.auth).toContain("assistant:\n  for: signed-in\n  may: change\n");
  const off = applyOperation(more.files, "setAssistant", {});
  if (!off.ok) throw new Error(off.message);
  expect(off.description).toBe('Nobody gets "Ask"');
  expect(off.files.auth).not.toContain("assistant");
  expect(applyOperation(files, "setAssistant", { for: ["support"] })).toMatchObject({ ok: false });
  expect(applyOperation(files, "setAssistant", { for: ["anyone", "admin"] })).toMatchObject({
    ok: false,
  });
});

test("what each field can be matched by, what can be added up, and what a kind's description says", () => {
  const offer = assistantOffer(ir, authOf("api: { models: all, actions: all }\n"), {
    role: "sales",
  });
  const order = offer.kinds.find((k) => k.model === "Order");
  expect(order?.filters).toEqual([
    { field: "number", by: "text" },
    { field: "customer", by: "reference", model: "Customer" },
    { field: "status", by: "value", values: ["draft", "placed", "shipped"] },
    { field: "total", by: "number" },
    { field: "placedOn", by: "date" },
    { field: "rush", by: "yesNo" },
  ]);
  expect(order?.numbers).toEqual(["total"]);
  expect(order?.by).toEqual(["customer", "status", "placedOn", "rush"]);
  const customer = offer.kinds.find((k) => k.model === "Customer");
  // A long text is found by search, a list of related records by the other side.
  expect(customer?.filters.map((f) => f.field)).toEqual([
    "name",
    "email",
    "segment",
    "creditLimit",
    "accountManager",
  ]);
  // The stored fields with the words people see, for reading a question by its words.
  expect(customer?.fields).toEqual([
    { name: "name", label: "Name" },
    { name: "email", label: "Email" },
    { name: "segment", label: "Segment" },
    { name: "creditLimit", label: "Credit limit" },
    { name: "notes", label: "Notes" },
    { name: "accountManager", label: "Account manager" },
  ]);
  expect(customer?.description).toContain("Customer: A company we sell to.");
  expect(customer?.description).toContain("- Orders are held above the credit limit.");
  expect(customer?.description).toContain("A record belongs to its accountManager.");
  // A description is the same for every caller: what one may do is in its tools, not here.
  expect(customer?.description).not.toContain("You may");
  expect(order?.description).toContain("- ship: Ship Only when status is placed.");
});

test("few tokens: every starter's tools and summary stay within a budget", () => {
  const raw = import.meta.glob("../../../examples/*/smithable*.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const starters = [...new Set(Object.keys(raw).map((p) => p.split("/").at(-2) as string))];
  expect(starters.length).toBeGreaterThanOrEqual(6);
  for (const starter of starters) {
    const at = (file: string) => raw[`../../../examples/${starter}/${file}`] as string;
    const starterIr = validateSpec({ path: "smithable.yml", text: at("smithable.yml") })
      .ir as SpecIR;
    const auth = validateAuth(
      { path: "smithable.auth.yml", text: at("smithable.auth.yml") },
      starterIr,
    ).auth as AuthIR;
    // With everything "Ask" can have: the tools that change things too.
    const offer = assistantOffer(
      starterIr,
      { ...auth, assistant: { for: "signed-in", may: "change" } },
      { role: "admin" },
      { scope: "app" },
    );
    // About 3.6 characters a token. The tools do not grow with the app; the summary is a line
    // a model. A change that makes either heavier should be a decision, not an accident (the
    // base grew by 20 on 2026-10-23 for an action's condition on the person, "Only when
    // assignee is not you", which the support starter now says).
    expect(JSON.stringify(offer.tools).length, `${starter}: tools`).toBeLessThan(4000);
    expect(offer.summary.length, `${starter}: summary`).toBeLessThan(
      320 + 260 * starterIr.models.length,
    );
  }
});

test("a custom action on rows is a run on ids for programs and assistants (A 171)", () => {
  const rows = validateSpec({
    path: "smithable.yml",
    text: "smithable: 0.1\napp: { name: Shop }\nmodels:\n  Customer:\n    fields: { name: string!, segment: smb | enterprise }\nactions:\n  tag:\n    custom: true\n    input: { customers: 'Customer[]', segment: 'smb | enterprise' }\npages:\n  customers: { crud: Customer, actions: [tag] }\n",
  }).ir as SpecIR;
  const auth = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: all }\napi: { models: all, actions: all, assistants: true }\n",
    },
    rows,
  ).auth as AuthIR;
  const offer = assistantOffer(rows, auth, { role: "admin" });
  const run = offer.tools.find((t) => t.name === "run");
  const schema = run?.inputSchema as {
    required: string[];
    properties: { action: { enum: string[] }; ids?: unknown };
  };
  expect(schema.required).toEqual(["action"]);
  expect(schema.properties.action.enum).toContain("tag");
  expect(schema.properties.ids).toBeDefined();
  expect(run?.description).toContain("tag run on the rows given as `ids`");
  expect(offer.summary).toContain("tag (Customer rows, by ids; input: segment)");
});

test("a short description of a choice field is in its line; a long one stays in describe", () => {
  const meant = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Status }
models:
  Component:
    fields:
      name: string!
      status: { type: "operational | degraded | down", description: "down means unreachable; a degraded component is not down." }
      kind: { type: "api | site", description: "${"x".repeat(121)}" }
pages:
  components: { crud: Component }
`,
  }).ir as SpecIR;
  const read = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: all }\napi: { models: all, assistants: true }\n",
    },
    meant,
  );
  const offer = assistantOffer(meant, read.auth as AuthIR, { role: "admin" });
  expect(offer.summary).toContain(
    "status* (operational | degraded | down; down means unreachable; a degraded component is not down)",
  );
  expect(offer.summary).toContain("kind* (api | site)");
  expect(offer.summary).not.toContain("xxxx");
});
