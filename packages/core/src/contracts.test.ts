import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import type { CustomActionIR } from "./ir.js";
import { validateSpec } from "./spec.js";

// A custom action's contract (docs/design/intents.md §6): touches and triggers.
const spec = (actions: string) => `smithable: 0.1
app: { name: Billing }
models:
  Customer:
    fields: { name: string!, segment: retail | wholesale, invoices: "Invoice[]" }
  Invoice:
    fields:
      number: int!
      customer: Customer!
      status: sent | paid
      total: money
      due: { type: money, formula: "total" }
  Payment:
    fields: { invoice: Invoice!, amount: money! }
actions:
${actions}
outgoing:
  paymentBooked: { when: Payment created, to: mail, recipient: admin }
pages:
  invoices:
    crud: Invoice
`;
const read = (actions: string) => validateSpec({ path: "smithable.yml", text: spec(actions) });
const errors = (actions: string) =>
  read(actions)
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => d.message);
const reconcile = `  reconcile:
    custom: true
    input: { statement: file! }
    output: { matched: int! }
    touches: { reads: [Invoice, Payment, User], writes: [Payment, Invoice.status, Invoice.total] }
    triggers: [paymentBooked]
`;

test("touches names what the code reads and writes, per model or field; triggers the outgoing entries", () => {
  const { ir, diagnostics } = read(reconcile);
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const action = ir?.actions[0] as CustomActionIR;
  expect(action.touches).toEqual({
    reads: ["Invoice", "Payment", "User"],
    writes: [{ model: "Payment" }, { model: "Invoice", fields: ["status", "total"] }],
  });
  expect(action.triggers).toEqual(["paymentBooked"]);
  const bare = read("  plain: { custom: true }\n").ir?.actions[0] as CustomActionIR;
  expect(bare.touches).toBeUndefined();
  expect(bare.triggers).toBeUndefined();
});

test("a contract is checked: custom only, models and stored fields, entries that exist, nothing twice", () => {
  expect(
    errors("  x: { on: Invoice, set: { status: paid }, touches: { reads: [Invoice] } }\n"),
  ).toEqual([expect.stringContaining('"touches" of action "x" is a custom action\'s contract')]);
  expect(errors("  x: { merge: Customer, triggers: [paymentBooked] }\n")).toEqual([
    expect.stringContaining("nothing else, no triggers"),
  ]);
  expect(errors("  x: { custom: true, touches: { reads: [Invoice.status] } }\n")).toEqual([
    expect.stringContaining('"reads" names models; a field is written, not read.'),
  ]);
  expect(errors("  x: { custom: true, touches: { reads: [Invoce] } }\n")).toEqual([
    expect.stringContaining('there is no model named "Invoce"'),
  ]);
  expect(errors("  x: { custom: true, touches: { writes: [Invoice.due] } }\n")).toEqual([
    expect.stringContaining("Invoice.due is computed, so nothing writes it."),
  ]);
  expect(errors("  x: { custom: true, touches: { writes: [Customer.invoices] } }\n")).toEqual([
    expect.stringContaining("Customer.invoices is a list, written through its records' reference."),
  ]);
  expect(errors("  x: { custom: true, touches: { writes: [Invoice.statu] } }\n")).toEqual([
    expect.stringContaining('Invoice has no field named "statu"'),
  ]);
  expect(errors("  x: { custom: true, touches: { writes: [Invoice.status.x] } }\n")).toEqual([
    expect.stringContaining('"Invoice.status.x" is a model or Model.field.'),
  ]);
  expect(errors("  x: { custom: true, touches: { writes: [Invoice.status, Invoice] } }\n")).toEqual(
    [expect.stringContaining("Invoice is named twice.")],
  );
  expect(errors("  x: { custom: true, touches: { reads: [Invoice, Invoice] } }\n")).toEqual([
    expect.stringContaining("Invoice is named twice."),
  ]);
  expect(errors("  x: { custom: true, triggers: [paymentBooked, paymentBooked] }\n")).toEqual([
    expect.stringContaining('"triggers" of action "x" names paymentBooked twice.'),
  ]);
  expect(errors("  x: { custom: true, triggers: [invoiceSent] }\n")).toEqual([
    expect.stringContaining('There is no outgoing named "invoiceSent".'),
  ]);
});

test("addAction and setAction write the contract; renames follow it and removals are refused", () => {
  const files = { spec: spec("  touch: { on: Invoice, set: { status: paid } }") };
  const added = applyOperation(files, "addAction", {
    action: "reconcile",
    input: { statement: "file!" },
    reads: ["Invoice", "Payment"],
    writes: ["Payment", "Invoice.status"],
    triggers: ["paymentBooked"],
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toMatch(
    /reconcile:\n {4}custom: true\n {4}input:\n {6}statement: file!\n {4}touches:\n {6}reads: \[Invoice, Payment\]\n {6}writes: \[Payment, Invoice\.status\]\n {4}triggers: \[paymentBooked\]\n/,
  );
  const refused = (op: string, args: Record<string, unknown>) =>
    expect(applyOperation(files, op, args)).toMatchObject({ ok: false });
  refused("addAction", { action: "y", on: "Invoice", set: { status: "paid" }, reads: ["Invoice"] });
  refused("addAction", { action: "y", reads: ["Nobody"] });
  refused("addAction", { action: "y", writes: ["Invoice.statu"] });
  refused("addAction", { action: "y", triggers: ["invoiceSent"] });
  refused("setAction", { action: "touch", reads: ["Invoice"] });
  const withIt = { ...files, ...added.files };
  // Each list replaces its own; "none" removes it.
  const narrowed = applyOperation(withIt, "setAction", { action: "reconcile", writes: ["none"] });
  if (!narrowed.ok) throw new Error(narrowed.message);
  expect(narrowed.files.spec).toMatch(/touches:\n {6}reads: \[Invoice, Payment\]\n {4}triggers/);
  expect(narrowed.files.spec).not.toContain("writes");
  const cleared = applyOperation(narrowed.files, "setAction", {
    action: "reconcile",
    reads: ["none"],
    triggers: ["none"],
  });
  expect(cleared.ok && cleared.files.spec).not.toMatch(/touches|triggers/);
  expect(cleared.ok && cleared.description).toBe("Change the contract of the action reconcile");
  const renamedField = applyOperation(withIt, "renameField", {
    model: "Invoice",
    from: "status",
    to: "state",
  });
  expect(renamedField.ok && renamedField.files.spec).toContain("writes: [Payment, Invoice.state]");
  const renamedModel = applyOperation(withIt, "renameModel", { from: "Invoice", to: "Bill" });
  expect(renamedModel.ok && renamedModel.files.spec).toContain("reads: [Bill, Payment]");
  expect(renamedModel.ok && renamedModel.files.spec).toContain("writes: [Payment, Bill.status]");
  expect(
    applyOperation(withIt, "removeField", { model: "Invoice", field: "status" }),
  ).toMatchObject({
    ok: false,
    message: expect.stringContaining('The action "reconcile" writes Invoice.status (its touches)'),
  });
  expect(applyOperation(withIt, "removeOutgoing", { outgoing: "paymentBooked" })).toMatchObject({
    ok: false,
    message: expect.stringContaining('The action "reconcile" may fire paymentBooked'),
  });
});
