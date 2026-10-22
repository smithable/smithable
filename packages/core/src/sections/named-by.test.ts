import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { writeNamedBy } from "../named-by.js";
import { titleField } from "../samples.js";
import { validateSpec } from "../spec.js";

const spec = (models: string) =>
  validateSpec({
    path: "smithable.yml",
    text: `smithable: 0.1\napp: { name: Shop }\nmodels:\n${models}pages:\n  customers: { crud: Customer }\n`,
  });

const customer = (extra = "") => `  Customer:
    fields:
      company: string!
      name: string
      notes: text
${extra}`;

test("the title is the first short text by rule, whatever the fields are called; namedBy settles it", () => {
  const byRule = spec(customer());
  expect(byRule.diagnostics).toEqual([]);
  expect(titleField(byRule.ir?.models[0] as NonNullable<typeof byRule.ir>["models"][0])).toBe(
    "company",
  );
  const named = spec(customer("    namedBy: name\n"));
  expect(named.diagnostics).toEqual([]);
  expect(named.ir?.models[0]?.namedBy).toBe("name");
  expect(titleField(named.ir?.models[0] as NonNullable<typeof named.ir>["models"][0])).toBe("name");
  const message = spec("  Customer:\n    fields:\n      body: text!\n      when: date\n");
  expect(titleField(message.ir?.models[0] as NonNullable<typeof message.ir>["models"][0])).toBe(
    "body",
  );
  const numbered = spec("  Customer:\n    fields:\n      amount: money!\n");
  expect(titleField(numbered.ir?.models[0] as NonNullable<typeof numbered.ir>["models"][0])).toBe(
    "id",
  );
});

test("namedBy must name a stored text field of the model", () => {
  expect(spec(customer("    namedBy: owner\n")).diagnostics.map((d) => d.code)).toEqual([
    "unknown-field",
  ]);
  expect(spec(customer("    namedBy: nothing\n")).diagnostics.map((d) => d.code)).toEqual([
    "unknown-field",
  ]);
  // An amount is a part a name can show (record-names.md); a picture is not.
  const amount = spec(customer("      amount: money\n    namedBy: amount\n"));
  expect(amount.diagnostics.map((d) => d.code)).toEqual([]);
  const photos = spec(customer("      photos: pictures\n    namedBy: photos\n"));
  expect(photos.diagnostics.map((d) => d.code)).toEqual(["invalid-value"]);
  expect(photos.diagnostics[0]?.message).toContain("cannot be part of a name");
  // A computed text may be a part of the name, but is not the one stored field titleField reads.
  const computed = spec(
    customer("      label: { type: string, formula: company }\n    namedBy: label\n"),
  );
  expect(computed.diagnostics.map((d) => d.code)).toEqual([]);
  expect(computed.ir?.models[0]?.namedBy).toBeUndefined();
  expect(computed.ir?.models[0]?.nameParts).toEqual([{ field: "label" }]);
  expect(spec(customer("    namedBy: notes\n")).diagnostics).toEqual([]);
});

const files = {
  spec: `smithable: 0.1
app: { name: Shop }
models:
  Customer:
    fields:
      company: string!
      name: string
pages:
  customers: { crud: Customer }
`,
};

test("setNamedBy writes the key and --none removes it; a renamed field follows into it, a removed one leaves it", () => {
  const set = applyOperation(files, "setNamedBy", { model: "Customer", field: "name" });
  if (!set.ok) throw new Error(set.message);
  expect(set.files.spec).toContain("    namedBy: name\n");
  expect(set.description).toBe("A Customer is named by its name");
  const renamed = applyOperation(set.files, "renameField", {
    model: "Customer",
    from: "name",
    to: "contact",
  });
  if (!renamed.ok) throw new Error(renamed.message);
  expect(renamed.files.spec).toContain("namedBy: contact");
  const removed = applyOperation(renamed.files, "removeField", {
    model: "Customer",
    field: "contact",
  });
  if (!removed.ok) throw new Error(removed.message);
  expect(removed.files.spec).not.toContain("namedBy");
  const none = applyOperation(set.files, "setNamedBy", { model: "Customer", none: true });
  if (!none.ok) throw new Error(none.message);
  expect(none.files.spec).not.toContain("namedBy");
  const wrong = applyOperation(files, "setNamedBy", { model: "Customer", field: "owner" });
  expect(wrong.ok ? "" : wrong.message).toContain('Customer has no field "owner"');
  const again = applyOperation(files, "setNamedBy", { model: "Customer", none: true });
  expect(again.ok ? "" : again.message).toContain("no namedBy setting");
});

test("the upgrade writes namedBy where the old name rule picked another field than today's rule", () => {
  const { ir } = spec(`${customer()}  Order:
    fields:
      number: string! unique
      title: string
  Note:
    fields:
      body: text!
`);
  const written = writeNamedBy(
    `smithable: 0.1\napp: { name: Shop }\nmodels:\n${customer()}  Order:\n    fields:\n      number: string! unique\n      title: string\n  Note:\n    fields:\n      body: text!\npages:\n  customers: { crud: Customer }\n`,
    ir as NonNullable<typeof ir>,
  );
  // Customer: the old rule read "name", today's reads "company". Order: "title" over "number".
  // Note: both rules say body, so nothing is written.
  expect(written.written).toEqual(["Customer: namedBy name", "Order: namedBy title"]);
  expect(written.text).toContain("    namedBy: name\n");
  expect(written.text).toContain("    namedBy: title\n");
  expect(written.text).not.toContain("Note:\n    fields:\n      body: text!\n    namedBy");
  const explicit = spec(customer("    namedBy: company\n")).ir;
  expect(writeNamedBy("x", explicit as NonNullable<typeof explicit>).written).toEqual([]);
});

test("a computed text is never the title by rule, nor written by the upgrade; the named field keeps a text type", () => {
  const computed = spec(`  Customer:
    fields:
      title: { type: string, formula: company }
      company: string!
`);
  expect(computed.diagnostics).toEqual([]);
  const model = computed.ir?.models[0] as NonNullable<typeof computed.ir>["models"][0];
  expect(titleField(model)).toBe("company");
  expect(writeNamedBy("x", computed.ir as NonNullable<typeof computed.ir>).written).toEqual([]);
  const set = applyOperation(files, "setNamedBy", { model: "Customer", field: "name" });
  if (!set.ok) throw new Error(set.message);
  const retyped = applyOperation(set.files, "changeField", {
    model: "Customer",
    field: "name",
    type: "int",
  });
  expect(retyped.ok ? "" : retyped.message).toContain("names a customer (namedBy)");
  const longer = applyOperation(set.files, "changeField", {
    model: "Customer",
    field: "name",
    type: "text!",
  });
  expect(longer.ok).toBe(true);
});
