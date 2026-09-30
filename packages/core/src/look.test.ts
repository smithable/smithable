import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import type { SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";
import { validateUx } from "./ux.js";

const spec = `smithable: 0.1
app: { name: CRM }
models:
  Customer:
    fields:
      name: string!
      email: email!
      phone: phone
      segment: smb | enterprise | government
      creditLimit: { type: money, min: 0, max: 100000 }
      notes: text
      active: bool
      score: { type: int, min: 1, max: 10 }
      vat: { type: money, formula: creditLimit * 0.24 }
      manager: User
pages:
  customers: { crud: Customer }
`;
const ir = validateSpec({ path: "smithable.yml", text: spec }).ir as SpecIR;
const check = (pages: string) =>
  validateUx(
    { path: "smithable.ux.yml", text: `smithableUx: 0.1\npages:\n  customers:\n${pages}` },
    ir,
  );

test("controls, sections, columns, view and sort are read and checked", () => {
  const { ux, diagnostics } = check(`    table: { sort: -creditLimit, view: cards }
    form:
      columns: 2
      sections:
        - { name: contact, fields: [name, email, phone] }
        - { name: terms, fields: [creditLimit, segment] }
      control: { score: slider, segment: radio, notes: textarea, active: switch, manager: select, creditLimit: slider }
`);
  expect(diagnostics).toEqual([]);
  expect(ux?.pages.customers).toEqual({
    sort: "-creditLimit",
    view: "cards",
    formColumns: 2,
    sections: [
      { name: "contact", fields: ["name", "email", "phone"] },
      { name: "terms", fields: ["creditLimit", "segment"] },
    ],
    control: {
      score: "slider",
      segment: "radio",
      notes: "textarea",
      active: "switch",
      manager: "select",
      creditLimit: "slider",
    },
  });
});

test("a control that does not fit its field, an unknown one, and conflicts are refused", () => {
  const messages = (pages: string) =>
    check(pages).diagnostics.map((d) => `${d.code}: ${d.message}`);
  expect(messages("    form: { control: { name: slider } }")).toEqual([
    "invalid-control: name cannot be a slider: a slider needs a number field with both min and max.",
  ]);
  expect(messages("    form: { control: { phone: switch } }")[0]).toMatch(
    /^invalid-control: phone cannot be a switch/,
  );
  expect(messages("    form: { control: { vat: textarea } }")[0]).toMatch(
    /computed field is shown, not entered/,
  );
  expect(messages("    form: { control: { name: dial } }")[0]).toMatch(/^unknown-control/);
  expect(messages("    form: { control: { fax: input } }")[0]).toMatch(/^unknown-field/);
  expect(messages("    form: { columns: 3 }")[0]).toMatch(/^invalid-value/);
  expect(messages("    table: { sort: fax }")[0]).toMatch(/^unknown-field/);
  expect(messages("    table: { view: list }")[0]).toMatch(/^invalid-value/);
  expect(
    messages(
      "    form:\n      fieldOrder: [name]\n      sections: [{ name: a, fields: [email] }]",
    )[0],
  ).toMatch(/^conflict/);
  expect(
    messages(
      "    form:\n      sections: [{ name: a, fields: [email] }, { name: b, fields: [email] }]",
    )[0],
  ).toMatch(/in two sections/);
});

test("the operations write the keys, and a rename or removal follows into them", () => {
  const files = { spec, ux: "smithableUx: 0.1\n" };
  const control = applyOperation(files, "setControl", {
    page: "customers",
    field: "score",
    control: "slider",
  });
  expect(control.ok && control.files.ux).toMatch(/control:\n\s+score: slider/);
  const sections = applyOperation(files, "setFormSections", {
    page: "customers",
    sections: ["contact:name,email", "terms:creditLimit"],
  });
  expect(sections.ok && sections.files.ux).toContain("sections:");
  expect(sections.ok && sections.files.ux).toContain("contact");
  const columns = applyOperation(files, "setFormColumns", { page: "customers", columns: 2 });
  expect(columns.ok && columns.files.ux).toContain("columns: 2");
  const view = applyOperation(files, "setView", { page: "customers", view: "cards" });
  expect(view.ok && view.files.ux).toContain("view: cards");
  const sort = applyOperation(files, "setSort", { page: "customers", field: "-creditLimit" });
  expect(sort.ok && sort.files.ux).toContain("sort: -creditLimit");
  const withAll = {
    spec,
    ux: `smithableUx: 0.1
pages:
  customers:
    table: { sort: -creditLimit }
    form:
      sections:
        - { name: terms, fields: [creditLimit, segment] }
      control: { creditLimit: slider }
`,
  };
  const renamed = applyOperation(withAll, "renameField", {
    model: "Customer",
    from: "creditLimit",
    to: "limit",
  });
  expect(renamed.ok && renamed.files.ux).toContain("sort: -limit");
  expect(renamed.ok && renamed.files.ux).toContain("limit: slider");
  expect(renamed.ok && renamed.files.ux).toContain("fields: [limit, segment]");
  // Removing creditLimit is refused (the vat formula uses it); segment goes from its section.
  expect(
    applyOperation(withAll, "removeField", { model: "Customer", field: "creditLimit" }).ok,
  ).toBe(false);
  const removed = applyOperation(withAll, "removeField", { model: "Customer", field: "segment" });
  expect(removed.ok && removed.files.ux).toContain("fields: [creditLimit]");
});
