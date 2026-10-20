import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// A field required by a condition on a computed field (record-rules.md §3, §5): the condition is
// read on the record as it would be after the change, its formulas worked out, on a create too.
const spec = `smithable: 0.1
app: { name: Shop }
models:
  Order:
    fields:
      amount: money!
      big: { type: bool, formula: amount > 10000 }
      approvedBy: { type: string, required: { big: true } }
pages:
  orders: { crud: Order }
`;
const auth = validateAuth({
  path: "smithable.auth.yml",
  text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n",
}).auth as AuthIR;
const checked = validateSpec({ path: "smithable.yml", text: spec });
const ir = checked.ir as SpecIR;
const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
const data = files.find((f) => f.path === "src/generated/order.server.ts")?.content ?? "";

test("a required condition on a computed field is read on the new record with its formulas worked out", () => {
  expect(checked.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  expect(data).toContain("const next: Record<string, unknown> = withOrderFormulas({ ...values });");
  expect(data).toContain(
    'if (fits({ big: true }, next) && (next.approvedBy ?? "") === "") throw new BadInput(w.requiredNow("Approved by"));',
  );
});

test("on a change, the condition is read on the stored record with its formulas, then the change laid over it", () => {
  expect(data).toContain(
    "const loaded: Record<string, unknown> = (await orderData.get(viewer, id)) ?? {};",
  );
  expect(data).toContain("const was: Record<string, unknown> = { ...before, ...loaded };");
  expect(data).toContain("const next: Record<string, unknown> = { ...was, ...given };");
});
