import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import type { SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";
import { cardCover, validateUx } from "./ux.js";

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

// Cards' pictures (T1149): the cover a ux file names or the model's first, and pictures that open.
const pictured = `smithable: 0.1
app: { name: Builder }
models:
  Project:
    fields:
      name: string!
      plan: file
      before: picture
      photos: pictures
      budget: money
  Customer:
    fields: { name: string! }
pages:
  projects: { crud: Project }
  customers: { crud: Customer }
`;
const picturedIr = validateSpec({ path: "smithable.yml", text: pictured }).ir as SpecIR;
const cardsUx = (table: string) =>
  validateUx(
    {
      path: "smithable.ux.yml",
      text: `smithableUx: 0.1\npages:\n  projects:\n    table: ${table}\n`,
    },
    picturedIr,
  );

test("a card's cover is the field named, else the model's first picture field by the spec's order", () => {
  const project = picturedIr.models.find((m) => m.name === "Project");
  const byRule = cardsUx("{ view: cards, open: picture }");
  expect(byRule.diagnostics).toEqual([]);
  expect(byRule.ux?.pages.projects).toEqual({ view: "cards", open: "picture" });
  expect(project && cardCover(project, byRule.ux?.pages.projects)).toMatchObject({
    field: { name: "before" },
    byRule: true,
  });
  const named = cardsUx("{ view: cards, cover: photos }");
  expect(named.diagnostics).toEqual([]);
  expect(named.ux?.pages.projects).toEqual({ view: "cards", cover: "photos" });
  expect(project && cardCover(project, named.ux?.pages.projects)).toMatchObject({
    field: { name: "photos" },
    byRule: false,
  });
});

test("open: picture needs a picture field, a cover is a picture field, and both are for cards", () => {
  const messages = (table: string) =>
    cardsUx(table).diagnostics.map((d) => `${d.code}: ${d.message}`);
  expect(
    check("    table: { view: cards, open: picture }").diagnostics.map((d) => d.message),
  ).toEqual(["Customer has no picture field for its cards to open."]);
  expect(messages("{ view: cards, open: zoom }")).toEqual([
    'invalid-value: "open" of page "projects" is picture.',
  ]);
  expect(messages("{ view: cards, cover: plan }")).toEqual([
    'invalid-value: A card\'s cover is a picture field; "plan" is not one.',
  ]);
  expect(messages("{ view: cards, cover: fotos }")[0]).toMatch(
    /^unknown-field: Project has no field named "fotos"/,
  );
  expect(messages("{ cover: photos, open: picture }")).toEqual([
    'invalid-key: "cover" is for cards; page "projects" shows a table.',
    'invalid-key: "open" is for cards; page "projects" shows a table.',
  ]);
});

test("setView sets cards with a cover and open, and a table takes them away", () => {
  const files = { spec: pictured, ux: "smithableUx: 0.1\n" };
  const cards = applyOperation(files, "setView", {
    page: "projects",
    view: "cards",
    cover: "photos",
    open: "picture",
  });
  expect(cards.ok && cards.files.ux).toMatch(/view: cards\n\s+cover: photos\n\s+open: picture/);
  if (!cards.ok) return;
  // setView writes the whole choice: an open left out goes.
  const coverOnly = applyOperation(cards.files, "setView", {
    page: "projects",
    view: "cards",
    cover: "before",
  });
  expect(coverOnly.ok && coverOnly.files.ux).not.toContain("open");
  const table = applyOperation(cards.files, "setView", { page: "projects", view: "table" });
  expect(table.ok && table.files.ux).not.toMatch(/view|cover|open/);
  expect(
    applyOperation(files, "setView", { page: "projects", view: "table", cover: "photos" }).ok,
  ).toBe(false);
  // A model without pictures has nothing to open: refused by the ux file's check.
  expect(
    applyOperation(files, "setView", { page: "customers", view: "cards", open: "picture" }).ok,
  ).toBe(false);
  // The cover follows a rename and goes with a removed field; open goes with the last picture.
  const renamed = applyOperation(cards.files, "renameField", {
    model: "Project",
    from: "photos",
    to: "pictures",
  });
  expect(renamed.ok && renamed.files.ux).toContain("cover: pictures");
  const removed = applyOperation(cards.files, "removeField", { model: "Project", field: "photos" });
  expect(removed.ok && removed.files.ux).toContain("open: picture");
  expect(removed.ok && removed.files.ux).not.toContain("cover");
  if (!removed.ok) return;
  const last = applyOperation(removed.files, "removeField", { model: "Project", field: "before" });
  expect(last.ok && last.files.ux).toContain("view: cards");
  expect(last.ok && last.files.ux).not.toMatch(/cover|open/);
});
