import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import type { StandardActionIR } from "./ir.js";
import { validateSpec } from "./spec.js";

// A split action (docs/design/intents.md §4): one record of a model becomes two.
const spec = (actions: string) => `smithable: 0.1
app: { name: Northwind }
models:
  Customer:
    fields: { name: string!, orders: "Order[]" }
  Order:
    fields:
      number: { type: int!, sequence: true }
      customer: Customer!
      deliverTo: string
      note: text
      code: string unique
      total: { type: money, formula: "SUM(lines.amount)" }
      lines: "Line[]"
  Line:
    fields: { order: Order!, item: string!, amount: money! }
  Ticket:
    fields: { key: string! unique, title: string!, tasks: "Task[]" }
  Task:
    fields: { ticket: Ticket!, what: string! }
actions:
${actions}
pages:
  orders:
    crud: Order
`;
const read = (actions: string) => validateSpec({ path: "smithable.yml", text: spec(actions) });
const errors = (actions: string) =>
  read(actions)
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => d.message);

test("split: <Model> is a standard action that sets nothing, with the list that moves and the fields the new record takes", () => {
  const { ir, diagnostics } = read(`  splitOrder:
    split: Order
    move: lines
    intent: The picked lines go to a new order.
  splitKeepingCustomer:
    split: Order
    move: lines
    copy: [customer]
`);
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const [first, second] = (ir?.actions ?? []) as StandardActionIR[];
  // Unsaid, every stored field but the sequence, the unique, the computed and the lists.
  expect(first).toMatchObject({
    name: "splitOrder",
    custom: false,
    on: "Order",
    set: [],
    split: { move: "lines", copy: ["customer", "deliverTo", "note"] },
    intent: "The picked lines go to a new order.",
  });
  expect(second?.split).toEqual({ move: "lines", copy: ["customer"] });
});

test("a split names its model, its list and its fields and nothing else; what the new record needs is checked", () => {
  expect(errors("  x: { split: Odrer, move: lines }\n")).toEqual([
    expect.stringContaining('There is no model named "Odrer"'),
  ]);
  expect(errors("  x: { split: User, move: orders }\n")).toEqual([
    expect.stringContaining("Users cannot be split"),
  ]);
  expect(errors("  x: { split: Order, move: lines, set: { note: a } }\n")).toEqual([
    expect.stringContaining('"split" takes move and copy and nothing else, no set'),
  ]);
  expect(errors("  x: { split: Order, move: lines, keep: newest }\n")).toEqual([
    expect.stringContaining("nothing else, no keep"),
  ]);
  expect(errors("  x: { merge: Order, move: lines }\n")).toEqual([
    expect.stringContaining('"merge" takes keep and fields and nothing else, no move'),
  ]);
  expect(errors("  x: { split: Order }\n")).toEqual([
    expect.stringContaining(
      'needs "move": the list of Order whose picked records go to the new record',
    ),
  ]);
  expect(errors("  x: { split: Order, move: customer }\n")).toEqual([
    expect.stringContaining('Order has no list named "customer"'),
  ]);
  expect(errors("  x: { on: Order, copy: {}, move: lines }\n")).toEqual([
    expect.stringContaining('"move" of action "x" goes with "split: <Model>".'),
  ]);
  // The fields copied: they must exist and be stored values the new record can take.
  expect(errors("  x: { split: Order, move: lines, copy: [customer, delivrTo] }\n")).toEqual([
    expect.stringContaining('Order has no field named "delivrTo"'),
  ]);
  expect(errors("  x: { split: Order, move: lines, copy: [customer, lines] }\n")).toEqual([
    expect.stringContaining("lines is not copied, it is a list."),
  ]);
  expect(errors("  x: { split: Order, move: lines, copy: [customer, code] }\n")).toEqual([
    expect.stringContaining("code is not copied, it is unique, so the new record gets its own."),
  ]);
  expect(errors("  x: { split: Order, move: lines, copy: [customer, total] }\n")).toEqual([
    expect.stringContaining("total is not copied, it is computed."),
  ]);
  expect(errors("  x: { split: Order, move: lines, copy: [customer, number] }\n")).toEqual([
    expect.stringContaining("number is not copied, the app gives it."),
  ]);
  // A required field the new record would not get.
  expect(errors("  x: { split: Order, move: lines, copy: [deliverTo] }\n")).toEqual([
    expect.stringContaining(
      'a new Order needs customer, which the split does not give it; name it in "copy".',
    ),
  ]);
  expect(errors("  x: { split: Ticket, move: tasks }\n")).toEqual([
    expect.stringContaining(
      "a new Ticket needs key, and it is unique, so the new record gets its own, so the split cannot give it.",
    ),
  ]);
});

test("addAction --split writes the entry and offers it on the model's page; renames follow and a removal is refused", () => {
  const files = { spec: spec("  touch: { on: Order, set: { note: a } }") };
  const added = applyOperation(files, "addAction", {
    action: "splitOrder",
    split: "Order",
    move: "lines",
    fields: ["customer", "deliverTo"],
    intent: "The picked lines go to a new order.",
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toMatch(
    /splitOrder:\n {4}split: Order\n {4}move: lines\n {4}copy: \[customer, deliverTo\]\n {4}intent: The picked lines go to a new order\.\n/,
  );
  expect(added.files.spec).toMatch(/orders:\n {4}crud: Order\n {4}actions: \[splitOrder\]/);
  const plain = applyOperation(files, "addAction", { action: "s", split: "Order", move: "lines" });
  expect(plain.ok && plain.files.spec).toMatch(/\n {2}s:\n {4}split: Order\n {4}move: lines\n/);
  const refused = (args: Record<string, unknown>) =>
    expect(applyOperation(files, "addAction", { action: "s", ...args })).toMatchObject({
      ok: false,
    });
  refused({ move: "lines" });
  refused({ split: "Order" });
  refused({ split: "Order", move: "lines", on: "Order" });
  refused({ split: "Order", move: "lines", merge: "Order" });
  refused({ split: "User", move: "orders" });
  refused({ split: "Nobody", move: "lines" });
  refused({ split: "Order", move: "customer" });
  refused({ split: "Order", move: "lines", fields: ["delivrTo"] });
  // The model's, the list's and a copied field's rename follow; a field the split uses stays.
  const withIt = { ...files, ...added.files };
  const renamedModel = applyOperation(withIt, "renameModel", { from: "Order", to: "Purchase" });
  expect(renamedModel.ok && renamedModel.files.spec).toContain("split: Purchase");
  const renamedList = applyOperation(withIt, "renameField", {
    model: "Order",
    from: "lines",
    to: "items",
  });
  expect(renamedList.ok && renamedList.files.spec).toContain("move: items");
  const renamedCopied = applyOperation(withIt, "renameField", {
    model: "Order",
    from: "deliverTo",
    to: "shipTo",
  });
  expect(renamedCopied.ok && renamedCopied.files.spec).toContain("copy: [customer, shipTo]");
  // Unsaid fields are not written on a rename.
  const plainRenamed = applyOperation(
    { ...files, ...(plain.ok ? plain.files : {}) },
    "renameField",
    { model: "Order", from: "deliverTo", to: "shipTo" },
  );
  expect(plainRenamed.ok && plainRenamed.files.spec).not.toContain("copy:");
  expect(applyOperation(withIt, "removeField", { model: "Order", field: "lines" })).toMatchObject({
    ok: false,
    message: expect.stringContaining('The action "splitOrder" uses Order.lines'),
  });
  expect(
    applyOperation(withIt, "removeField", { model: "Order", field: "deliverTo" }),
  ).toMatchObject({
    ok: false,
    message: expect.stringContaining('The action "splitOrder" uses Order.deliverTo'),
  });
});
