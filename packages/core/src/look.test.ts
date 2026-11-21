import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";
import type { SpecIR } from "./ir.js";
import { validateSpec } from "./spec.js";
import { galleryCover, validateUx } from "./ux.js";

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

// A gallery (T1117): big covers, from a picture field the ux file names or the model's first.
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
const galleryIr = validateSpec({ path: "smithable.yml", text: pictured }).ir as SpecIR;
const galleryUx = (table: string) =>
  validateUx(
    {
      path: "smithable.ux.yml",
      text: `smithableUx: 0.1\npages:\n  projects:\n    table: ${table}\n`,
    },
    galleryIr,
  );

test("a gallery's cover is the field named, else the model's first picture field by the spec's order", () => {
  const project = galleryIr.models.find((m) => m.name === "Project");
  const byRule = galleryUx("{ view: gallery }");
  expect(byRule.diagnostics).toEqual([]);
  expect(byRule.ux?.pages.projects).toEqual({ view: "gallery" });
  expect(project && galleryCover(project, byRule.ux?.pages.projects)).toMatchObject({
    field: { name: "before" },
    byRule: true,
  });
  const named = galleryUx("{ view: gallery, cover: photos }");
  expect(named.diagnostics).toEqual([]);
  expect(named.ux?.pages.projects).toEqual({ view: "gallery", cover: "photos" });
  expect(project && galleryCover(project, named.ux?.pages.projects)).toMatchObject({
    field: { name: "photos" },
    byRule: false,
  });
});

test("a gallery needs a picture field, and a cover is a picture field of a gallery", () => {
  const messages = (table: string) =>
    galleryUx(table).diagnostics.map((d) => `${d.code}: ${d.message}`);
  expect(check("    table: { view: gallery }").diagnostics.map((d) => d.message)).toEqual([
    'Customer has no picture field for a gallery\'s covers; "cards" works for any model.',
  ]);
  expect(messages("{ view: gallery, cover: plan }")).toEqual([
    'invalid-value: A gallery\'s cover is a picture field; "plan" is not one.',
  ]);
  expect(messages("{ view: gallery, cover: fotos }")[0]).toMatch(
    /^unknown-field: Project has no field named "fotos"/,
  );
  expect(messages("{ view: cards, cover: photos }")).toEqual([
    'invalid-key: "cover" is a gallery\'s; page "projects" shows no gallery (view: gallery).',
  ]);
});

test("setView makes a gallery with its cover, and leaving it takes the cover too", () => {
  const files = { spec: pictured, ux: "smithableUx: 0.1\n" };
  const gallery = applyOperation(files, "setView", {
    page: "projects",
    view: "gallery",
    cover: "photos",
  });
  expect(gallery.ok && gallery.files.ux).toMatch(/view: gallery\n\s+cover: photos/);
  if (!gallery.ok) return;
  const table = applyOperation(gallery.files, "setView", { page: "projects", view: "table" });
  expect(table.ok && table.files.ux).not.toMatch(/view|cover/);
  const cardsWithCover = applyOperation(files, "setView", {
    page: "projects",
    view: "cards",
    cover: "photos",
  });
  expect(cardsWithCover.ok).toBe(false);
  // A model without pictures has no gallery: refused by the ux file's check.
  expect(applyOperation(files, "setView", { page: "customers", view: "gallery" }).ok).toBe(false);
  // The cover follows a rename; removed, the rule picks the next; with no picture left, a table.
  const renamed = applyOperation(gallery.files, "renameField", {
    model: "Project",
    from: "photos",
    to: "pictures",
  });
  expect(renamed.ok && renamed.files.ux).toContain("cover: pictures");
  const removed = applyOperation(gallery.files, "removeField", {
    model: "Project",
    field: "photos",
  });
  expect(removed.ok && removed.files.ux).toContain("view: gallery");
  expect(removed.ok && removed.files.ux).not.toContain("cover");
  if (!removed.ok) return;
  const last = applyOperation(removed.files, "removeField", { model: "Project", field: "before" });
  expect(last.ok && last.files.ux).not.toMatch(/view|cover/);
});
