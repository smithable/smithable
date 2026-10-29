import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import type { StandardActionIR } from "./ir.js";
import { validateSpec } from "./spec.js";

// A merge action (docs/design/intents.md §3): two records of a model become one.
const spec = (actions: string) => `smithable: 0.1
app: { name: Northwind CRM }
models:
  Customer:
    fields: { name: string!, email: email unique, segment: retail | wholesale, orders: "Order[]" }
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

test("merge: <Model> is a standard action that sets nothing, with keep and fill (chosen and empty unless said)", () => {
  const { ir, diagnostics } = read(`  mergeCustomers:
    merge: Customer
    intent: Two records of the same customer become one.
  mergeNewest: { merge: Customer, keep: newest, fill: none }
`);
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const [first, second] = (ir?.actions ?? []) as StandardActionIR[];
  expect(first).toMatchObject({
    name: "mergeCustomers",
    custom: false,
    on: "Customer",
    set: [],
    merge: { keep: "chosen", fill: "empty" },
    intent: "Two records of the same customer become one.",
  });
  expect(second?.merge).toEqual({ keep: "newest", fill: "none" });
});

test("a merge names its model and nothing else; users cannot be merged; keep and fill are checked", () => {
  expect(errors("  x: { merge: Custmer }\n")).toEqual([
    expect.stringContaining('There is no model named "Custmer"'),
  ]);
  expect(errors("  x: { merge: User }\n")).toEqual([
    expect.stringContaining("Users cannot be merged"),
  ]);
  expect(errors("  x: { merge: Customer, set: { segment: retail } }\n")).toEqual([
    expect.stringContaining('"merge" takes keep and fill and nothing else, no set'),
  ]);
  expect(errors("  x: { merge: Customer, custom: true }\n")).toEqual([
    expect.stringContaining("nothing else, no custom"),
  ]);
  expect(errors("  x: { merge: Customer, keep: first }\n")).toEqual([
    expect.stringContaining('"keep" of action "x" is chosen, oldest or newest.'),
  ]);
  expect(errors("  x: { merge: Customer, fill: all }\n")).toEqual([
    expect.stringContaining('"fill" of action "x" is empty or none.'),
  ]);
  expect(errors("  x: { on: Customer, set: { segment: retail }, keep: newest }\n")).toEqual([
    expect.stringContaining('"keep" of action "x" goes with "merge: <Model>".'),
  ]);
});

test("addAction --merge writes the entry and offers it on the model's page; a model's rename follows", () => {
  const files = { spec: spec("  touch: { on: Order, set: { total: 0 } }") };
  const added = applyOperation(files, "addAction", {
    action: "mergeCustomers",
    merge: "Customer",
    fill: "none",
    intent: "Two records of the same customer become one.",
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toMatch(
    /mergeCustomers:\n {4}merge: Customer\n {4}fill: none\n {4}intent: Two records of the same customer become one\.\n/,
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
  expect(applyOperation(files, "addAction", { action: "m", keep: "newest" })).toMatchObject({
    ok: false,
  });
  expect(
    applyOperation(files, "addAction", { action: "m", merge: "Customer", on: "Customer" }),
  ).toMatchObject({
    ok: false,
  });
  expect(applyOperation(files, "addAction", { action: "m", merge: "User" })).toMatchObject({
    ok: false,
  });
  expect(applyOperation(files, "addAction", { action: "m", merge: "Nobody" })).toMatchObject({
    ok: false,
  });
  const renamed = applyOperation({ ...files, ...added.files }, "renameModel", {
    from: "Customer",
    to: "Client",
  });
  expect(renamed.ok && renamed.files.spec).toContain("merge: Client");
});
