import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import type { StandardActionIR } from "./ir.js";
import { validateSpec } from "./spec.js";

// A merge action (docs/design/intents.md §3): two records of a model become one.
const spec = (actions: string) => `smithable: 0.1
app: { name: Northwind CRM }
models:
  Customer:
    fields: { name: string!, email: email unique, segment: retail | wholesale, revenue: money, notes: text, orders: "Order[]" }
  Order:
    fields: { number: int!, customer: Customer!, total: money }
actions:
${actions}
pages:
  customers:
    crud: Customer
  orders:
    crud: Order
`;
const read = (actions: string) => validateSpec({ path: "smithable.yml", text: spec(actions) });
const errors = (actions: string) =>
  read(actions)
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => d.message);

test("the owner and a reference to the model itself take no rule: the owner stays, the reference moves", () => {
  const owned = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Owned }
models:
  Customer:
    fields: { name: string!, manager: User, parent: Customer }
    ownedBy: manager
actions:
  mergeCustomers: { merge: Customer, fields: { manager: keep, parent: other } }
pages:
  customers: { crud: Customer }
`,
  });
  expect(owned.diagnostics.filter((d) => d.severity === "error").map((d) => d.message)).toEqual([
    expect.stringContaining("manager takes no rule, the owner stays the kept record's."),
    expect.stringContaining(
      "parent takes no rule, a reference to a Customer moves like the records that point at it.",
    ),
  ]);
});

test("merge: <Model> is a standard action that sets nothing, with keep and a rule per field", () => {
  const { ir, diagnostics } = read(`  mergeCustomers:
    merge: Customer
    intent: Two records of the same customer become one.
  mergeNewest:
    merge: Customer
    keep: newest
    fields: { email: ask, segment: keep, revenue: add, notes: append, name: other }
`);
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const [first, second] = (ir?.actions ?? []) as StandardActionIR[];
  expect(first).toMatchObject({
    name: "mergeCustomers",
    custom: false,
    on: "Customer",
    set: [],
    merge: { keep: "chosen", fields: {} },
    intent: "Two records of the same customer become one.",
  });
  expect(second?.merge).toEqual({
    keep: "newest",
    fields: { email: "ask", segment: "keep", revenue: "add", notes: "append", name: "other" },
  });
});

test("a merge names its model and nothing else; users cannot be merged; keep and the fields' rules are checked", () => {
  expect(errors("  x: { merge: Custmer }\n")).toEqual([
    expect.stringContaining('There is no model named "Custmer"'),
  ]);
  expect(errors("  x: { merge: User }\n")).toEqual([
    expect.stringContaining("Users cannot be merged"),
  ]);
  expect(errors("  x: { merge: Customer, set: { segment: retail } }\n")).toEqual([
    expect.stringContaining('"merge" takes keep and fields and nothing else, no set'),
  ]);
  expect(errors("  x: { merge: Customer, custom: true }\n")).toEqual([
    expect.stringContaining("nothing else, no custom"),
  ]);
  expect(errors("  x: { merge: Customer, keep: first }\n")).toEqual([
    expect.stringContaining('"keep" of action "x" is chosen, oldest or newest.'),
  ]);
  expect(errors("  x: { on: Customer, set: { segment: retail }, keep: newest }\n")).toEqual([
    expect.stringContaining('"keep" of action "x" goes with "merge: <Model>".'),
  ]);
  // A field's rule: the field must exist and take one; add is for numbers, append for texts.
  expect(errors("  x: { merge: Customer, fields: { emial: ask } }\n")).toEqual([
    expect.stringContaining('Customer has no field named "emial"'),
  ]);
  expect(errors("  x: { merge: Customer, fields: { email: pick } }\n")).toEqual([
    expect.stringContaining("email is keep, other, ask, add or append."),
  ]);
  expect(errors("  x: { merge: Customer, fields: { name: add } }\n")).toEqual([
    expect.stringContaining('"add" is for a number or an amount, and name is not one.'),
  ]);
  expect(errors("  x: { merge: Customer, fields: { revenue: append } }\n")).toEqual([
    expect.stringContaining('"append" is for a text, and revenue is not one.'),
  ]);
  expect(errors("  x: { merge: Customer, fields: { orders: keep } }\n")).toEqual([
    expect.stringContaining("orders takes no rule, its records move with the merge."),
  ]);
});

test("addAction --merge writes the entry and offers it on the model's page; a model's rename follows", () => {
  const files = { spec: spec("  touch: { on: Order, set: { total: 0 } }") };
  const added = applyOperation(files, "addAction", {
    action: "mergeCustomers",
    merge: "Customer",
    fields: ["email=ask", "revenue=add"],
    intent: "Two records of the same customer become one.",
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toMatch(
    /mergeCustomers:\n {4}merge: Customer\n {4}fields:\n {6}email: ask\n {6}revenue: add\n {4}intent: Two records of the same customer become one\.\n/,
  );
  expect(added.files.spec).toMatch(
    /customers:\n {4}crud: Customer\n {4}actions: \[mergeCustomers\]/,
  );
  // Defaults are not written; the arguments are checked.
  const plain = applyOperation(files, "addAction", {
    action: "m",
    merge: "Customer",
    keep: "chosen",
  });
  expect(plain.ok && plain.files.spec).toMatch(/\n {2}m:\n {4}merge: Customer\n/);
  const refused = (args: Record<string, unknown>) =>
    expect(applyOperation(files, "addAction", { action: "m", ...args })).toMatchObject({
      ok: false,
    });
  refused({ keep: "newest" });
  refused({ merge: "Customer", on: "Customer" });
  refused({ merge: "User" });
  refused({ merge: "Nobody" });
  refused({ merge: "Customer", fields: ["email=pick"] });
  refused({ merge: "Customer", fields: ["emial=ask"] });
  const renamed = applyOperation({ ...files, ...added.files }, "renameModel", {
    from: "Customer",
    to: "Client",
  });
  expect(renamed.ok && renamed.files.spec).toContain("merge: Client");
});
