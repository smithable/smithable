import { expect, test } from "vitest";
import {
  type AuthIR,
  type SpecIR,
  validateAuth,
  validateSpec,
  writeUniqueScopes,
} from "./index.js";

const text = `smithable: 0.1
app: { name: Shop }
models:
  Invoice:
    fields:
      customer: string!            # who it is for
      number: { type: int!, sequence: true }
      code: email unique
      slug: { type: string, unique: app }
      note: string
      kind: string
    unique: [[customer, note], { fields: [customer, kind], scope: owner }]
pages:
  invoices: { crud: Invoice }
`;
const authOf = (t: string) => validateAuth({ path: "smithable.auth.yml", text: t }).auth as AuthIR;
const ir = validateSpec({ path: "smithable.yml", text }).ir as SpecIR;

test("upgrade writes the implicit scopes out as the access reads them, keeping comments and the explicit ones", () => {
  const privateApp = authOf(
    "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: private\n",
  );
  const out = writeUniqueScopes(text, ir, privateApp);
  expect(out.written).toEqual([
    "Invoice.number: unique owner",
    "Invoice.code: unique owner",
    "Invoice: customer and note unique owner",
  ]);
  expect(out.text).toContain("      customer: string!            # who it is for\n");
  expect(out.text).toContain("        sequence: true\n        unique: owner\n");
  expect(out.text).toContain("        type: email\n        unique: owner\n");
  expect(out.text).toContain("      slug: { type: string, unique: app }\n");
  expect(out.text).toContain("{ fields: [customer, note], scope: owner }");
  expect(out.text).toContain("{ fields: [customer, kind], scope: owner }");
  // Written once: the result has nothing implicit left.
  const again = writeUniqueScopes(
    out.text,
    validateSpec({ path: "smithable.yml", text: out.text }).ir as SpecIR,
    privateApp,
  );
  expect(again.written).toEqual([]);
  expect(again.text).toBe(out.text);
});

test("under shared access the short form becomes app", () => {
  const shared = authOf(
    "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n",
  );
  const out = writeUniqueScopes(text, ir, shared);
  expect(out.written).toContain("Invoice.code: unique app");
  expect(out.text).toContain("{ fields: [customer, note], scope: app }");
});
