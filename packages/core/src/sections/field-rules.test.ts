import { expect, test } from "vitest";
import { applyOperation, findOperation, parseOperationArgs } from "../apply.js";
import { validateSpec } from "../spec.js";

const raw = (files: Record<string, unknown>) => Object.values(files)[0] as string;
const spec = raw(
  import.meta.glob("../../../../examples/crm/smithable.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);
const auth = raw(
  import.meta.glob("../../../../examples/crm/smithable.auth.yml", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
);
const order = (text: string) =>
  validateSpec({ path: "smithable.yml", text }).ir?.models.find((m) => m.name === "Order");

const op = (text: string, name: string, ...args: string[]) => {
  const operation = findOperation(name);
  if (!operation) throw new Error(`no ${name}`);
  return applyOperation({ spec: text, auth }, name, parseOperationArgs(operation, args));
};
const rules2 = (text: string, name: string, ...args: string[]) => {
  const result = op(text, name, ...args);
  if (!result.ok) throw new Error(result.message);
  return result.files.spec;
};

const rules = (text: string, ...args: string[]) => {
  const operation = findOperation("setFieldRules");
  if (!operation) throw new Error("no setFieldRules");
  const result = applyOperation(
    { spec: text, auth },
    "setFieldRules",
    parseOperationArgs(operation, args),
  );
  if (!result.ok)
    throw new Error(
      `${result.message} ${(result.diagnostics ?? []).map((d) => d.message).join(" ")}`,
    );
  return result.files.spec;
};

test("a field locked while a condition holds, and required while another does, in the long form", () => {
  const locked = rules(spec, "Order", "total", "--locked", "status=shipped | canceled");
  expect(locked).toContain(
    "      total:\n        type: money!\n        locked:\n          status: [shipped, canceled]\n",
  );
  const required = rules(locked, "Order", "placedAt", "--required", "status=placed");
  const fields = order(required)?.fields ?? [];
  expect(fields.find((f) => f.name === "total")?.locked).toEqual({
    status: ["shipped", "canceled"],
  });
  expect(fields.find((f) => f.name === "placedAt")?.requiredWhen).toEqual({
    status: "placed",
  });
  // Taken off again, the field is its shorthand once more.
  expect(rules(locked, "Order", "total", "--locked")).toContain("      total: money!\n");
  expect(
    order(rules(spec, "Order", "number", "--once"))?.fields.find((f) => f.name === "number")
      ?.locked,
  ).toBe(true);
});

test("by app, and a condition naming a field the model does not have refused", () => {
  const byApp = rules(spec, "Order", "number", "--by", "app");
  expect(order(byApp)?.fields.find((f) => f.name === "number")?.byApp).toBe(true);
  expect(() => rules(spec, "Order", "total", "--locked", "state=shipped")).toThrow(
    /no field named "state"/,
  );
});

test("ME() is a person's default; a computed field takes no rules", () => {
  const text = spec.replace(
    "      shippingMethod: standard | express\n",
    "      shippingMethod: standard | express\n      packedBy: { type: User, by: app, default: ME() }\n",
  );
  const packedBy = order(text)?.fields.find((f) => f.name === "packedBy");
  expect(packedBy).toMatchObject({ byApp: true, defaultMe: true });
  const wrong = validateSpec({
    path: "smithable.yml",
    text: spec.replace(
      "      status: draft",
      "      note: { type: string, default: ME() }\n      status: draft",
    ),
  });
  expect(wrong.diagnostics.map((d) => d.message).join()).toContain("must refer to User");
  expect(() => rules(spec, "Order", "shippingCost", "--by", "app")).toThrow(/computed/);
});

test("a lock's condition follows a renamed value and a renamed field; a value that goes, or the field, is refused", () => {
  const locked = rules(spec, "Order", "total", "--locked", "status=shipped");
  const renamed = rules2(
    locked,
    "changeField",
    "Order",
    "status",
    "draft | placed | sent | canceled",
    "--renames",
    "shipped=sent",
  );
  expect(order(renamed)?.fields.find((f) => f.name === "total")?.locked).toEqual({
    status: "sent",
  });
  const gone = op(
    locked,
    "changeField",
    "Order",
    "status",
    "draft | placed | canceled",
    "--renames",
    "shipped=canceled",
  );
  expect(gone.ok).toBe(true);
  const lost = op(locked, "changeField", "Order", "status", "draft | placed | canceled");
  expect(lost.ok ? "" : lost.message).toContain("Order.total is locked when status is shipped");
  const state = rules2(locked, "renameField", "Order", "status", "state");
  expect(order(state)?.fields.find((f) => f.name === "total")?.locked).toEqual({
    state: "shipped",
  });
  const removed = op(locked, "removeField", "Order", "status");
  expect(removed.ok ? "" : removed.message).toContain("change its rules first");
});

test("a condition on required for a field always required is refused", () => {
  const always = spec.replace(
    "      total: money!\n",
    "      total: { type: money!, required: { status: placed } }\n",
  );
  expect(
    validateSpec({ path: "smithable.yml", text: always }).diagnostics.map((d) => d.code),
  ).toContain("conflict");
});
