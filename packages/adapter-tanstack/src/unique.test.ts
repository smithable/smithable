import {
  type AuthIR,
  emptyContent,
  type SpecIR,
  validateAuth,
  validateSpec,
} from "@smithable/core";
import { expect, test } from "vitest";
import { generateApp } from "./generate.js";

// Where a unique value is unique (docs/design/uniqueness.md): the schema's constraint per field
// and per pair, following the written scope, or the access for the short form.
const spec = (extra = "") => `smithable: 0.1
app: { name: Shop }
models:
  Customer:
    fields:
      name: string!
  Invoice:
    fields:
      customer: Customer!
      number: int!
      reference: { type: string, unique: owner }
      code: { type: string, unique: app }
      slug: string unique
      note: string
    unique: [[customer, number], { fields: [customer, note], scope: app }]${extra}
pages:
  invoices: { crud: Invoice }
`;
const authOf = (text: string) => validateAuth({ path: "smithable.auth.yml", text }).auth as AuthIR;
const privateApp = authOf(
  "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: private\n",
);
const sharedApp = authOf(
  "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n",
);
const schemaOf = (text: string, auth: AuthIR) => {
  const ir = validateSpec({ path: "smithable.yml", text }).ir as SpecIR;
  const files = generateApp(ir, { smithableVersion: "0.0.0", auth, content: emptyContent() });
  return files.find((f) => f.path === "src/db/schema.ts")?.content ?? "";
};

test("under private access the short form is per owner; owner and app are what they say", () => {
  const schema = schemaOf(spec(), privateApp);
  expect(schema).toContain("unique().on(t.ownerId, t.slug)");
  expect(schema).toContain("unique().on(t.ownerId, t.reference)");
  expect(schema).toMatch(/code: text\(\)\.unique\(\)/);
  expect(schema).not.toContain("unique().on(t.ownerId, t.code)");
  // The pairs: the short form per owner too, the explicit app-wide one without the owner.
  expect(schema).toContain("unique().on(t.ownerId, t.customerId, t.number)");
  expect(schema).toContain("unique().on(t.customerId, t.note)");
});

test("under shared access the short form is app-wide, and owner still means per owner", () => {
  const schema = schemaOf(spec(), sharedApp);
  expect(schema).toMatch(/slug: text\(\)\.unique\(\)/);
  expect(schema).toContain("unique().on(t.ownerId, t.reference)");
  expect(schema).toContain("unique().on(t.customerId, t.number)");
  expect(schema).not.toContain("t.ownerId, t.customerId");
});

test("with a trash every unique value is an index over the live records, the owner first where per owner", () => {
  const schema = schemaOf(spec("\n    trash: true"), privateApp);
  expect(schema).toContain(
    'uniqueIndex("invoices_slug_unique").on(t.ownerId, t.slug).where(sql`${t.deletedAt} is null`)',
  );
  expect(schema).toContain(
    'uniqueIndex("invoices_code_unique").on(t.code).where(sql`${t.deletedAt} is null`)',
  );
  expect(schema).toContain(
    'uniqueIndex("invoices_customer_id_number_unique").on(t.ownerId, t.customerId, t.number).where(sql`${t.deletedAt} is null`)',
  );
});
