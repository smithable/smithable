import { expect, test } from "vitest";
import { applyOperation, type ProjectFiles } from "./apply.js";
import { renameTextInFormula } from "./formula.js";

const raw = import.meta.glob("../../../examples/*/smithable*.yml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const example = (name: string): ProjectFiles => {
  const file = (suffix: string) => raw[`../../../examples/${name}/smithable${suffix}.yml`];
  return {
    spec: file("") as string,
    auth: file(".auth"),
    content: file(".content"),
    ux: file(".ux"),
  };
};
const change = (
  files: ProjectFiles,
  model: string,
  field: string,
  type: string,
  renames: string[],
) => {
  const result = applyOperation(files, "changeField", { model, field, type, renames });
  if (!result.ok) throw new Error(result.message);
  return result.files;
};

test("a renamed choice value is followed where pages, actions and visitors' reading name it", () => {
  const after = change(
    example("status"),
    "Incident",
    "status",
    "investigating | identified | watching | resolved",
    ["monitoring=watching"],
  );
  // A landing section's and a dashboard tile's "where", a list among them.
  expect(after.spec).toContain(
    "open: { records: Incident, where: { status: [investigating, identified, watching] } }",
  );
  expect(after.spec).toContain(
    "open: { count: Incident, where: { status: [investigating, identified, watching] } }",
  );
  // An action's "when" and what it sets; what it adds to another model's field stays.
  expect(after.spec).toContain("when: { status: [investigating, identified, watching] }");
  expect(after.spec).toContain("set: { status: watching }");
  expect(after.spec).toContain("IncidentUpdate: { at: NOW(), status: monitoring,");
  // What visitors may read, and the value's tone.
  expect(after.auth).toContain(
    "Incident: { where: { status: [investigating, identified, watching, resolved] } }",
  );
  expect(after.ux).toMatch(/Incident\.status: \{[^}]*watching: warning/);
  expect(after.ux).not.toMatch(/Incident\.status: \{[^}]*monitoring/);
  // Another field's same-named value is not touched.
  expect(after.ux).toMatch(/IncidentUpdate\.status: \{[^}]*monitoring: warning/);
});

test("an action's condition and what it writes follow a renamed value", () => {
  const after = change(example("invoicing"), "Invoice", "status", "draft | issued | paid | late", [
    "sent=issued",
    "overdue=late",
  ]);
  expect(after.spec).toContain("set: { status: issued }");
  expect(after.spec).toContain("when: { status: [issued, late] }");
  expect(after.spec).toContain("outstanding: { sum: Invoice.total, where: { status: issued } }");
  expect(after.spec).toContain("overdue: { sum: Invoice.total, where: { status: late } }");
  expect(after.ux).toContain("Invoice.status: { paid: success, late: warning }");
});

test("two values becoming one leave a condition naming it once", () => {
  const after = change(example("invoicing"), "Invoice", "status", "draft | sent | paid", [
    "overdue=sent",
  ]);
  expect(after.spec).toContain("when: { status: [sent] }");
  // The tile that counted the value that went now counts what its records became.
  expect(after.spec).toContain("overdue: { sum: Invoice.total, where: { status: sent } }");
  // The tone of the value that went is not put on the one that stays.
  expect(after.ux).toContain("Invoice.status: { paid: success }");
});

test("formulas that compare with a renamed value, and their examples, follow it", () => {
  const after = change(example("crm"), "Order", "shippingMethod", "standard | fast", [
    "express=fast",
  ]);
  expect(after.spec).toContain('IF(shippingMethod = "fast", 15, 5)');
  expect(after.spec).toContain("input: { total: 150, shippingMethod: fast }");
  expect(after.spec).not.toContain("express");
});

test("the text of a renamed value goes to its new name; a removed value's goes with it", () => {
  const after = change(example("booking"), "ClassType", "level", "beginner | everyone | advanced", [
    "allLevels=everyone",
  ]);
  // The long form's default follows too.
  expect(after.spec).toMatch(/type: beginner \| everyone \| advanced\n\s+default: everyone/);
  expect(after.content).toContain("level: { values: { everyone: All levels } }");
});

test("a capacity that counts only some records follows a renamed value", () => {
  const booking = example("booking");
  const spec = booking.spec
    .replace(
      "      session: Session!  unique",
      "      session: Session!  unique\n      status: booked | waiting",
    )
    .replace(
      "      max: session.capacity",
      "      max: session.capacity\n      where: { status: booked }",
    );
  expect(spec).toContain("where: { status: booked }");
  const after = change({ ...booking, spec }, "Booking", "status", "confirmed | waiting", [
    "booked=confirmed",
  ]);
  expect(after.spec).toContain("where: { status: confirmed }");
});

test("a value whose records are left empty is not followed: what names it still refuses", () => {
  const files = example("api");
  const optional = files.spec.replace(/status: ([a-zA-Z| ]+)\n/, (_, values) => {
    return `status: { type: ${values.trim()}, default: none }\n`;
  });
  const values = /status: \{ type: ([a-zA-Z| ]+),/.exec(optional)?.[1] ?? "";
  const gone = values.split(" | ")[1] as string;
  const result = applyOperation({ ...files, spec: optional }, "changeField", {
    model: "Task",
    field: "status",
    type: `${values
      .split(" | ")
      .filter((v) => v !== gone)
      .join(" | ")} = none`,
    renames: [`${gone}=`],
  });
  expect(result).toMatchObject({ ok: false });
});

test("text in a formula is renamed only where it is compared with the field", () => {
  const rename = (source: string) =>
    renameTextInFormula(source, (field, list, value) =>
      field === "status" && value === "open" ? (list ? `${list}-new` : "new") : undefined,
    );
  expect(rename('IF(status = "open", "open", note)')).toBe('IF(status = "new", "open", note)');
  expect(rename('IF("open" <> status, 1, 2)')).toBe('IF("new" <> status, 1, 2)');
  expect(rename('COUNTIF(lines.status, "open") + countif(tasks.status, "open")')).toBe(
    'COUNTIF(lines.status, "lines-new") + countif(tasks.status, "tasks-new")',
  );
  expect(rename('kind = "open"')).toBe('kind = "open"');
});
