import { expect, test } from "vitest";
import type { AuthIR, SpecIR } from "../index.js";
import { applyOperation, uniqueScope, validateAuth, validateSpec } from "../index.js";

const spec = (models: string) => `smithable: 0.1
app: { name: Shop }
models:
${models}
pages:
  invoices: { crud: Invoice }
`;
const invoices = `  Customer:
    fields:
      name: string!
  Invoice:
    fields:
      customer: Customer!
      number: int!
      reference: { type: string, unique: owner }
      code: { type: string, unique: app }
      slug: string unique
    unique: [[customer, number]]
`;
const authOf = (text: string) => validateAuth({ path: "smithable.auth.yml", text }).auth as AuthIR;
const privateApp = authOf(
  "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: private\n",
);
const sharedApp = authOf(
  "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n",
);
const codes = (text: string) =>
  validateSpec({ path: "smithable.yml", text }).diagnostics.map((d) => `${d.severity}:${d.code}`);

test("a field's unique says where: true as the access reads it, owner or app outright", () => {
  const checked = validateSpec({ path: "smithable.yml", text: spec(invoices) });
  expect(checked.diagnostics.filter((d) => d.severity === "error")).toEqual([]);
  const invoice = (checked.ir as SpecIR).models.find((m) => m.name === "Invoice");
  const field = (name: string) => invoice?.fields.find((f) => f.name === name);
  expect(field("reference")?.unique).toBe("owner");
  expect(field("code")?.unique).toBe("app");
  expect(field("slug")?.unique).toBe(true);
  expect(field("number")?.unique).toBe(false);
  const model = invoice as SpecIR["models"][number];
  expect(uniqueScope(true, model, privateApp)).toBe("owner");
  expect(uniqueScope(true, model, sharedApp)).toBe("app");
  expect(uniqueScope("owner", model, sharedApp)).toBe("owner");
  expect(uniqueScope("app", model, privateApp)).toBe("app");
  expect(uniqueScope(false, model, privateApp)).toBeUndefined();
  expect(invoice?.unique).toEqual([{ fields: ["customer", "number"], scope: true }]);
});

test("unique together takes two or more stored fields, with a scope in the long form", () => {
  const long = spec(
    "  Invoice:\n    fields:\n      customer: string!\n      number: int!\n    unique: [{ fields: [customer, number], scope: app }]\n",
  );
  const checked = validateSpec({ path: "smithable.yml", text: long });
  expect(checked.ir?.models[0]?.unique).toEqual([{ fields: ["customer", "number"], scope: "app" }]);
  expect(
    codes(spec("  Invoice:\n    fields:\n      number: int!\n    unique: [[number]]\n")),
  ).toContain("error:invalid-value");
  expect(
    codes(spec("  Invoice:\n    fields:\n      number: int!\n    unique: [[number, nope]]\n")),
  ).toContain("error:unknown-field");
  expect(
    codes(
      spec(
        "  Invoice:\n    fields:\n      number: int! unique\n      year: int!\n    unique: [[number, year]]\n",
      ),
    ),
  ).toContain("error:invalid-value");
  expect(
    codes(
      spec(
        "  Invoice:\n    fields:\n      number: int!\n      total: { type: money, formula: number * 2 }\n    unique: [[number, total]]\n",
      ),
    ),
  ).toContain("error:invalid-value");
  expect(
    codes(spec("  Invoice:\n    fields:\n      number: { type: int!, unique: sometimes }\n")),
  ).toContain("error:expected-boolean");
});

test("unique per owner needs sign-in", () => {
  const ir = validateSpec({ path: "smithable.yml", text: spec(invoices) }).ir as SpecIR;
  const none = validateAuth(
    {
      path: "smithable.auth.yml",
      text: "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [invoices], read: [Invoice, Customer] }\n",
    },
    ir,
  );
  expect(none.diagnostics.map((d) => d.code)).toContain("unique-owner-no-sign-in");
  // Without sign-in there is no owner to be unique per: the scope reads as the app's.
  const model = ir.models.find((m) => m.name === "Invoice") as SpecIR["models"][number];
  const visitors = authOf(
    "smithableAuth: 0.1\nsignIn: none\npublic: { pages: [invoices], read: [Invoice] }\n",
  );
  expect(uniqueScope("owner", model, visitors)).toBe("app");
});

const files = {
  spec: spec(
    "  Customer:\n    fields:\n      name: string!\n  Invoice:\n    fields:\n      customer: Customer!\n      number: int!\n      slug: string unique\n",
  ),
  auth: "smithableAuth: 0.1\nsignIn: { providers: [google] }\ndefaultAccess: shared\n",
};

test("setFieldRules --unique writes where a field is unique, and back to the shorthand for a plain true", () => {
  const owner = applyOperation(files, "setFieldRules", {
    model: "Invoice",
    field: "slug",
    unique: "owner",
  });
  if (!owner.ok) throw new Error(owner.message);
  expect(owner.files.spec).toContain("      slug:\n        type: string\n        unique: owner\n");
  const plain = applyOperation(owner.files, "setFieldRules", {
    model: "Invoice",
    field: "slug",
    unique: "true",
  });
  if (!plain.ok) throw new Error(plain.message);
  expect(plain.files.spec).toContain("      slug: string unique\n");
  const off = applyOperation(plain.files, "setFieldRules", {
    model: "Invoice",
    field: "slug",
    unique: "false",
  });
  if (!off.ok) throw new Error(off.message);
  expect(off.files.spec).toContain("      slug: string\n");
  const app = applyOperation(files, "setFieldRules", {
    model: "Invoice",
    field: "number",
    unique: "app",
  });
  if (!app.ok) throw new Error(app.message);
  expect(app.files.spec).toContain("      number:\n        type: int!\n        unique: app\n");
});

test("setUnique adds, changes and removes a rule for fields unique together", () => {
  const added = applyOperation(files, "setUnique", {
    model: "Invoice",
    fields: ["customer", "number"],
  });
  if (!added.ok) throw new Error(added.message);
  expect(added.files.spec).toContain("    unique: [[customer, number]]\n");
  const scoped = applyOperation(added.files, "setUnique", {
    model: "Invoice",
    fields: ["number", "customer"],
    scope: "app",
  });
  if (!scoped.ok) throw new Error(scoped.message);
  expect(scoped.files.spec).toContain("    unique: [{ fields: [number, customer], scope: app }]\n");
  expect(
    validateSpec({ path: "smithable.yml", text: scoped.files.spec }).ir?.models[1]?.unique,
  ).toEqual([{ fields: ["number", "customer"], scope: "app" }]);
  const removed = applyOperation(scoped.files, "setUnique", {
    model: "Invoice",
    fields: ["customer", "number"],
    remove: true,
  });
  if (!removed.ok) throw new Error(removed.message);
  expect(removed.files.spec).not.toContain("unique:");
  const alone = applyOperation(files, "setUnique", {
    model: "Invoice",
    fields: ["slug", "number"],
  });
  expect(alone.ok ? "" : alone.message).toContain("unique by itself");
  const one = applyOperation(files, "setUnique", {
    model: "Invoice",
    fields: ["number", "number"],
  });
  expect(one.ok ? "" : one.message).toContain("two or more");
});

test("a rule twice, a number counting up in a rule, or a unique list of records is refused", () => {
  expect(
    codes(
      spec(
        "  Invoice:\n    fields:\n      customer: string!\n      number: int!\n    unique: [[customer, number], [number, customer]]\n",
      ),
    ),
  ).toContain("error:invalid-value");
  expect(
    codes(
      spec(
        "  Invoice:\n    fields:\n      customer: string!\n      number: { type: int!, sequence: true }\n    unique: [[customer, number]]\n",
      ),
    ),
  ).toContain("error:invalid-value");
  expect(
    codes(
      spec(
        '  Invoice:\n    fields:\n      name: string!\n      lines: { type: "Line[]", unique: true }\n  Line:\n    fields:\n      invoice: Invoice!\n',
      ),
    ),
  ).toContain("error:invalid-field");
});

test("setFieldRules refuses to make a field in a rule unique by itself, and a sequence not unique", () => {
  const ruled = applyOperation(files, "setUnique", {
    model: "Invoice",
    fields: ["customer", "number"],
  });
  if (!ruled.ok) throw new Error(ruled.message);
  const alone = applyOperation(ruled.files, "setFieldRules", {
    model: "Invoice",
    field: "number",
    unique: "app",
  });
  expect(alone.ok ? "" : alone.message).toContain("unique together with customer");
  const counting = {
    ...files,
    spec: spec(
      "  Invoice:\n    fields:\n      number: { type: int!, sequence: true }\n      name: string!\n",
    ),
  };
  const off = applyOperation(counting, "setFieldRules", {
    model: "Invoice",
    field: "number",
    unique: "false",
  });
  expect(off.ok ? "" : off.message).toContain("unique by its nature");
  // A plain unique beside another key stays a key, not the shorthand.
  const lockedToo = applyOperation(files, "setFieldRules", {
    model: "Invoice",
    field: "slug",
    once: true,
    unique: "true",
  });
  if (!lockedToo.ok) throw new Error(lockedToo.message);
  expect(lockedToo.files.spec).toContain(
    "      slug:\n        type: string\n        unique: true\n        locked: true\n",
  );
});

test("renaming or removing a field follows into the rules; a rule left with one field goes", () => {
  const ruled = applyOperation(files, "setUnique", {
    model: "Invoice",
    fields: ["customer", "number"],
  });
  if (!ruled.ok) throw new Error(ruled.message);
  const renamed = applyOperation(ruled.files, "renameField", {
    model: "Invoice",
    from: "number",
    to: "serial",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.spec).toContain("    unique: [[customer, serial]]\n");
  const removed = applyOperation(renamed.files, "removeField", {
    model: "Invoice",
    field: "serial",
  });
  if (!removed.ok) throw new Error(removed.message);
  expect(removed.files.spec).not.toContain("unique:");
});
