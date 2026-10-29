import { expect, test } from "vitest";
import { applyOperation, type ProjectFiles } from "./apply.js";
import { type AuthIR, validateAuth } from "./auth.js";
import type { CustomActionIR, SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";

// A custom action's examples (docs/design/intents.md §6): the tests the app runs its code by.
const spec = (actions: string) => `smithable: 0.1
app: { name: Billing }
models:
  Customer:
    fields: { name: string!, segment: retail | wholesale, invoices: "Invoice[]" }
  Invoice:
    fields:
      number: string! unique
      customer: Customer!
      total: money!
      status: sent | paid
      due: { type: date, formula: "TODAY()" }
actions:
${actions}
pages:
  invoices: { crud: Invoice }
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
    examples:
      - as: accountant
        now: 2026-01-15
        given: { Invoice: [{ id: 1, number: INV-1, total: 120, status: sent }] }
        input: { statement: samples/one-line.csv }
        after: { Invoice: [{ id: 1, status: paid, due: 2026-01-15 }] }
        nothingElse: true
        output: { matched: 1 }
      - given: {}
        output: refused
`;

test("an example gives records, input and what must hold after; the rest is optional", () => {
  const { ir, diagnostics } = read(reconcile);
  expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const action = ir?.actions[0] as CustomActionIR;
  expect(action.examples).toEqual([
    {
      as: "accountant",
      now: "2026-01-15",
      given: { Invoice: [{ id: 1, number: "INV-1", total: 120, status: "sent" }] },
      input: { statement: "samples/one-line.csv" },
      after: { Invoice: [{ id: 1, status: "paid", due: "2026-01-15" }] },
      nothingElse: true,
      output: { matched: 1 },
    },
    { given: {}, output: "refused" },
  ]);
});

test("what an example names must exist and fit: models, fields, single values, a role of the access file", () => {
  const custom = (examples: string) => `  x:\n    custom: true\n    examples:\n${examples}`;
  expect(errors(custom("      - input: {}\n"))).toEqual([
    expect.stringContaining('Example 1 of action "x" needs "given"'),
  ]);
  expect(errors(custom("      - given: { Invoce: [] }\n"))).toEqual([
    expect.stringContaining('there is no model named "Invoce"'),
  ]);
  expect(errors(custom("      - given: { Invoice: { id: 1 } }\n"))).toEqual([
    expect.stringContaining("Invoice is a list of records"),
  ]);
  expect(errors(custom("      - given: { Invoice: [{ id: 1, totl: 5 }] }\n"))).toEqual([
    expect.stringContaining('there is no field named "totl"'),
  ]);
  expect(errors(custom("      - given: { Invoice: [{ due: 2026-01-01 }] }\n"))).toEqual([
    expect.stringContaining('due is computed, so it is not given; it can be checked in "after"'),
  ]);
  expect(errors(custom("      - given: { Customer: [{ invoices: [1] }] }\n"))).toEqual([
    expect.stringContaining(
      "invoices is a list; its records are given and checked as records of Invoice",
    ),
  ]);
  expect(errors(custom("      - given: { Invoice: [{ total: [1, 2] }] }\n"))).toEqual([
    expect.stringContaining("a value is a single value"),
  ]);
  expect(errors(custom("      - given: {}\n        now: soon\n"))).toEqual([
    expect.stringContaining('"now" of example 1 of action "x" is a date'),
  ]);
  expect(errors(custom("      - given: {}\n        now: '1'\n"))).toEqual([
    expect.stringContaining('"now" of example 1 of action "x" is a date'),
  ]);
  expect(errors(custom("      - given: {}\n        output: refuse\n"))).toEqual([
    expect.stringContaining('as a map, or the one word "refused"'),
  ]);
  // The list input of an action on rows is the ids picked.
  const rows = read(
    '  bulk:\n    custom: true\n    input: { invoices: "Invoice[]" }\n    examples:\n      - given: { Invoice: [{ id: 1 }, { id: 2 }] }\n        input: { invoices: [1, 2] }\n',
  );
  expect(rows.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(((rows.ir as SpecIR).actions[0] as CustomActionIR).examples?.[0]?.input).toEqual({
    invoices: [1, 2],
  });
  expect(
    errors(
      '  bulk:\n    custom: true\n    input: { invoices: "Invoice[]" }\n    examples: [{ given: {}, input: { invoices: 1 } }]\n',
    ),
  ).toEqual([expect.stringContaining("invoices is the records picked, a list of their ids")]);
  expect(errors(custom("      - given: {}\n        output: { matched: 1 }\n"))).toEqual([
    expect.stringContaining('action "x" returns nothing'),
  ]);
  expect(errors(custom("      - given: {}\n        input: { statment: x }\n"))).toEqual([
    expect.stringContaining('there is no input named "statment"'),
  ]);
  expect(errors(custom("      - given: {}\n        after: {}\n        extra: 1\n"))).toEqual([
    expect.stringContaining("extra"),
  ]);
  expect(errors("  y: { on: Invoice, set: { status: paid }, examples: [] }\n")).toEqual([
    expect.stringContaining('"examples" of action "y" is a custom action\'s contract'),
  ]);
  // The role is the access file's to know.
  const ir = read(reconcile).ir as SpecIR;
  const auth = (roles: string) =>
    validateAuth(
      {
        path: "smithable.auth.yml",
        text: `smithableAuth: 0.1\nsignIn: { providers: [email] }\ndefaultAccess: private\nroles: { admin: all, ${roles} }\n`,
      },
      ir,
    ).diagnostics.map((d) => d.message);
  expect(auth("accountant: { pages: all, actions: [reconcile] }")).toEqual([]);
  expect(auth("clerk: { pages: all }")).toEqual([
    expect.stringContaining(
      'Example 1 of the action reconcile runs as "accountant", which is not a role here.',
    ),
  ]);
});

const files = (actions: string) => ({ spec: spec(actions) });
const yaml = (result: { files: ProjectFiles }) => result.files.spec;

test("addExample and removeExample edit a custom action's examples; a standard action has none", () => {
  const added = applyOperation(
    files("  x: { custom: true, input: { keep: Customer! } }\n"),
    "addExample",
    {
      action: "x",
      given: { Customer: [{ id: 1, name: "Arctic" }] },
      input: { keep: 1 },
      after: { Customer: [{ id: 1, name: "Arctic" }] },
    },
  );
  expect(added.ok).toBe(true);
  if (!added.ok) return;
  expect(yaml(added)).toContain("examples:");
  const second = applyOperation({ spec: yaml(added) }, "addExample", {
    action: "x",
    given: {},
    output: "refused",
  });
  expect(second.ok).toBe(true);
  if (!second.ok) return;
  const ir = validateSpec({ path: "smithable.yml", text: yaml(second) }).ir as SpecIR;
  expect((ir.actions[0] as CustomActionIR).examples).toHaveLength(2);
  const gone = applyOperation({ spec: yaml(second) }, "removeExample", {
    action: "x",
    example: 1,
  });
  expect(gone.ok).toBe(true);
  if (!gone.ok) return;
  expect(yaml(gone)).not.toContain("Arctic");
  expect(yaml(gone)).toContain("refused");
  const none = applyOperation({ spec: yaml(gone) }, "removeExample", {
    action: "x",
    example: 3,
  });
  expect(none.ok).toBe(false);
  if (!none.ok) expect(none.message).toContain("x has one example");
  const standard = applyOperation(
    files("  y: { on: Invoice, set: { status: paid } }\n"),
    "addExample",
    {
      action: "y",
      given: {},
    },
  );
  expect(standard.ok).toBe(false);
  if (!standard.ok) expect(standard.message).toContain("y is a standard action");
  // An example that names what does not exist is refused as any invalid spec.
  const wrong = applyOperation(files("  x: { custom: true }\n"), "addExample", {
    action: "x",
    given: { Nothing: [] },
  });
  expect(wrong.ok).toBe(false);
});

test("an example's records follow a field's rename, and a named field cannot be removed", () => {
  const start = files(reconcile);
  const renamed = applyOperation(start, "renameField", {
    model: "Invoice",
    from: "status",
    to: "state",
  });
  expect(renamed.ok).toBe(true);
  if (!renamed.ok) return;
  expect(yaml(renamed)).toContain("state: sent");
  expect(yaml(renamed)).toContain("state: paid");
  const model = applyOperation(start, "renameModel", { from: "Invoice", to: "Bill" });
  expect(model.ok).toBe(true);
  if (model.ok) expect(yaml(model)).toContain("given: { Bill: [{ id: 1, number: INV-1");
  const removed = applyOperation(start, "removeField", { model: "Invoice", field: "status" });
  expect(removed.ok).toBe(false);
  if (!removed.ok)
    expect(removed.message).toContain('Example 1 of the action "reconcile" names Invoice.status');
});
