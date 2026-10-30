import { type SpecIR, validateSpec } from "@smithable/core";
import { expect, test } from "vitest";
import { exampleRows } from "./examples-table";

test("a custom action's examples in words: records given and after, input, output or refused, who and when", () => {
  const spec = validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1
app: { name: Books }
models:
  Invoice:
    fields:
      number: string!
      status: draft | sent | paid
actions:
  payInvoice:
    custom: true
    input: { invoice: Invoice!, note: string }
    output: { paid: int! }
    touches: { reads: [Invoice], writes: [Invoice.status] }
    examples:
      - given: { Invoice: [{ id: 1, number: "INV-1", status: sent }] }
        input: { invoice: 1 }
        after: { Invoice: [{ id: 1, status: paid }] }
        nothingElse: true
        output: { paid: 1 }
      - as: admin
        now: 2026-01-15
        given: { Invoice: [{ id: 2, status: draft }] }
        input: { invoice: 2, note: early }
        output: refused
`,
  });
  expect(spec.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const action = (spec.ir as SpecIR).actions.find((a) => a.name === "payInvoice");
  const rows = exampleRows(action?.custom ? (action.examples ?? []) : []);
  expect(rows).toEqual([
    {
      given: ["Invoice 1: number INV-1, status sent"],
      input: ["invoice: 1"],
      after: ["Invoice 1: status paid"],
      output: ["paid: 1"],
      how: ["nothing else changes"],
    },
    {
      given: ["Invoice 2: status draft"],
      input: ["invoice: 2", "note: early"],
      after: [],
      output: ["refused"],
      how: ["as admin", "on 2026-01-15"],
    },
  ]);
});
