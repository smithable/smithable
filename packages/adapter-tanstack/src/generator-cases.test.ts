import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// Shapes richer drafts write (C's experiment 1, Opus via Claude Code), each of which generated
// code that did not type-check.
const spec = `smithable: 0.1
app: { name: Shop }
models:
  Invoice:
    fields:
      number: string!
      due: date!
      lines: Line[]
      payments: Payment[]
      total: { type: money, formula: SUM(lines.amount) }
      paid: { type: money, formula: SUM(payments.amount) }
      balance: { type: money, formula: total - paid }
  Line:
    fields: { invoice: Invoice!, amount: money! }
  Payment:
    fields: { invoice: Invoice!, amount: money! }
  Tool:
    fields: { name: string!, available: bool = true }
actions:
  lendOut: { on: Tool, when: { available: true }, set: { available: false } }
  takeBack: { on: Tool, when: { available: false }, set: { available: true } }
pages:
  invoices: { crud: Invoice }
  due: { calendar: Invoice }
  tools: { crud: Tool, actions: [lendOut, takeBack] }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const auth = validateAuth(
  {
    path: "smithable.auth.yml",
    text: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n",
  },
  ir,
).auth as AuthIR;
const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
const file = (path: string) => files.find((f) => f.path === path)?.content ?? "";

test("a formula built only from other formulas reads the row it is given", () => {
  expect(file("src/generated/invoice.formulas.ts")).toMatch(/balance: \(r: Row\)/);
});

test("a condition on a yes/no field is a boolean either way", () => {
  expect(file("src/generated/actions/lend-out.ts")).toContain("return row.available === true;");
  expect(file("src/generated/actions/take-back.ts")).toContain("return !row.available;");
});

test("a seed whose dated samples are all dates imports no instant conversion", () => {
  const seed = file("src/db/seed.ts");
  if (seed.includes("#/kit/zoned")) expect(seed).not.toContain("instantOf");
});
