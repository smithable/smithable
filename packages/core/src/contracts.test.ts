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
    [expect.stringContaining("Invoice is written whole, so its fields add nothing")],
  );
  expect(errors("  x: { custom: true, touches: { writes: [Invoice, Invoice.status] } }\n")).toEqual(
    [expect.stringContaining("Invoice is written whole, so Invoice.status adds nothing")],
  );
  expect(errors("  x: { custom: true, touches: { writes: [Invoice, Invoice] } }\n")).toEqual([
    expect.stringContaining("Invoice is named twice."),
  ]);
  // Empty lists are a contract that reaches nothing; no touches is no fence.
  const empty = read("  x: { custom: true, touches: {} }\n").ir?.actions[0] as CustomActionIR;
  expect(empty.touches).toEqual({ reads: [], writes: [] });
  expect(errors("  x: { custom: true, touches: { reads: [Invoice, Invoice] } }\n")).toEqual([
    expect.stringContaining("Invoice is named twice."),
  ]);
  expect(errors("  x: { custom: true, triggers: [paymentBooked, paymentBooked] }\n")).toEqual([
    expect.stringContaining('"triggers" of action "x" names paymentBooked twice.'),
  ]);
  expect(errors("  x: { custom: true, triggers: [invoiceSent] }\n")).toEqual([
    expect.stringContaining('There is no outgoing named "invoiceSent".'),
  ]);
  // A trigger is an entry the action's work sets off: without touches any record entry, with
  // touches one on a model it writes.
  expect(errors("  x: { custom: true, triggers: [paymentBooked] }\n")).toEqual([]);
  expect(
    errors(
      "  x: { custom: true, touches: { writes: [Invoice.status] }, triggers: [paymentBooked] }\n",
    ),
  ).toEqual([
    expect.stringContaining(
      "paymentBooked fires on Payment created, and x does not write Payment (its touches).",
    ),
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
  refused("addAction", { action: "y", writes: ["Invoice", "Invoice.status"] });
  refused("addAction", { action: "y", reads: ["Invoice", "Invoice"] });
  refused("addAction", { action: "y", writes: ["Invoice.due"] });
  refused("setAction", { action: "touch", reads: ["Invoice"] });
  const withIt = { ...files, ...added.files };
  // Each list replaces its own; "none" empties it (the code then reaches nothing of that kind).
  // Emptying writes while a trigger still fires on Payment is refused by the trigger check.
  const narrowed = applyOperation(withIt, "setAction", { action: "reconcile", reads: ["none"] });
  if (!narrowed.ok) throw new Error(narrowed.message);
  expect(narrowed.files.spec).toMatch(
    /touches:\n {6}reads: \[\]\n {6}writes: \[Payment, Invoice\.status\]\n {4}triggers/,
  );
  expect(
    applyOperation(withIt, "setAction", { action: "reconcile", writes: ["none"] }),
  ).toMatchObject({ ok: false });
  const cleared = applyOperation(narrowed.files, "setAction", {
    action: "reconcile",
    writes: ["none"],
    triggers: ["none"],
  });
  // Triggers emptied is no triggers key; touches emptied stays, a fence that reaches nothing,
  // and --touches none takes the fence away.
  expect(cleared.ok && cleared.files.spec).toMatch(/reads: \[\]\n {6}writes: \[\]\n/);
  expect(cleared.ok && cleared.files.spec).not.toContain("triggers");
  expect(cleared.ok && cleared.description).toBe("Change the contract of the action reconcile");
  const unfenced = applyOperation(narrowed.files, "setAction", {
    action: "reconcile",
    touches: "none",
  });
  expect(unfenced.ok && unfenced.files.spec).not.toContain("touches");
  expect(unfenced.ok && unfenced.files.spec).toContain("triggers: [paymentBooked]");
  expect(
    applyOperation(withIt, "setAction", { action: "reconcile", touches: "all" }),
  ).toMatchObject({ ok: false });
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

test("a trigger on another action's entry, a standard action's or a timer's is refused; the action's own is fine", () => {
  const text = `smithable: 0.1
app: { name: Billing }
models:
  Invoice:
    fields: { number: int!, status: sent | paid, issuedOn: date }
actions:
  reconcile: { custom: true, triggers: [reconciled, closed, remind] }
  other: { custom: true, triggers: [reconciled] }
  close: { on: Invoice, set: { status: paid } }
  own: { custom: true, triggers: [owned] }
timers:
  reminder: { on: Invoice, every: day, at: "08:00", run: close }
outgoing:
  reconciled: { when: reconcile, to: mail, recipient: admin }
  owned: { when: own, to: mail, recipient: admin }
  closed: { when: close, to: mail, recipient: admin }
  remind: { when: reminder, to: mail, recipient: admin }
pages:
  invoices: { crud: Invoice }
`;
  const messages = validateSpec({ path: "smithable.yml", text })
    .diagnostics.filter((d) => d.severity === "error")
    .map((d) => d.message);
  expect(messages).toEqual([
    expect.stringContaining(
      "closed fires when the action close runs, which code does not set off.",
    ),
    expect.stringContaining(
      "remind fires when the timer reminder comes, which code does not set off.",
    ),
    expect.stringContaining("reconciled fires when reconcile runs, not other."),
  ]);
});
