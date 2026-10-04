import { expect, test } from "vitest";
import { type AssistantOffer, assistantOffer } from "./assistant.js";
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
    access: { write: [sales], delete: [admin] }
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
      text: `smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: shared\nroles: { admin: {}, sales: {}, viewer: {} }\ndefaultRole: viewer\n${rest}`,
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
      "Customer (customers): name*, email, segment* (smb | enterprise), creditLimit money, notes, accountManager -> User. Title: name.",
      "Order (orders): number*, customer* -> Customer, status* (draft | placed | shipped), total* money, placedOn date, rush yes/no. Title: number.",
      "Actions: ship (Order, when status is placed).",
      "* required. You act as someone with the role sales.",
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
  // A viewer may read everything (shared) and add, but an order is changed by sales only.
  const viewer = assistantOffer(ir, plain, { role: "viewer" });
  expect(kindsOf(viewer, "change")).toEqual(["Customer"]);
  expect(names(viewer.tools)).not.toContain("delete");
  // Deleting is offered only with the line in the spec, and then only for what the role may delete.
  const deleting = authOf("api: { models: all, assistants: { delete: true } }\n");
  const del = (role: string) => kindsOf(assistantOffer(ir, deleting, { role }), "delete");
  expect(del("admin")).toEqual(["Customer", "Order"]);
  expect(del("sales")).toEqual(["Customer"]);
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
  const auth = authOf("api: { models: [Customer], assistants: { delete: true } }\n");
  const inside = assistantOffer(ir, auth, { role: "admin" }, { scope: "app" });
  expect(inside.kinds.map((k) => k.model)).toEqual(["Customer", "Order"]);
  expect(names(inside.tools)).not.toContain("delete");
  expect(inside.actions).toEqual(["ship"]);
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
  expect(customer?.description).toContain("Customer: A company we sell to.");
  expect(customer?.description).toContain("- Orders are held above the credit limit.");
  expect(customer?.description).toContain("A record belongs to its accountManager.");
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
    const offer = assistantOffer(starterIr, auth, { role: "admin" }, { scope: "app" });
    // About 3.6 characters a token. The tools do not grow with the app; the summary is a line
    // a model. A change that makes either heavier should be a decision, not an accident.
    expect(JSON.stringify(offer.tools).length, `${starter}: tools`).toBeLessThan(4000);
    expect(offer.summary.length, `${starter}: summary`).toBeLessThan(
      300 + 260 * starterIr.models.length,
    );
  }
});
