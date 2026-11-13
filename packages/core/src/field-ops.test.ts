// A field's default, its bounds and its numbering in turn, each through its own operation (T727).
import { expect, test } from "vitest";
import { applyOperation } from "./apply.js";

const spec = `smithable: 0.1
app: { name: Shop }
models:
  Order:
    fields:
      number: int!
      minutes: int
      status: draft | sent | paid
      rush: bool
      note: string
pages:
  orders: { crud: Order }
`;
const apply = (op: string, args: Record<string, unknown>, from = spec) => {
  const result = applyOperation({ spec: from }, op, args);
  if (!result.ok) throw new Error(result.message);
  return result.files.spec;
};
const refused = (op: string, args: Record<string, unknown>) => {
  const result = applyOperation({ spec }, op, args);
  return result.ok ? undefined : result.message;
};

test("setFieldDefault writes the default as the spec does, and takes it away", () => {
  expect(apply("setFieldDefault", { model: "Order", field: "minutes", value: "60" })).toContain(
    "minutes: int = 60",
  );
  expect(apply("setFieldDefault", { model: "Order", field: "rush", value: "true" })).toContain(
    "rush: bool = true",
  );
  // A choice's default is its own key (the shorthand's "=" is refused on a choice).
  expect(apply("setFieldDefault", { model: "Order", field: "status", value: "sent" })).toMatch(
    /status: \{ type: draft \| sent \| paid, default: sent \}|status:\n\s+type: draft \| sent \| paid\n\s+default: sent/,
  );
  // A choice with no default at all.
  expect(apply("setFieldDefault", { model: "Order", field: "status", value: "none" })).toMatch(
    /default: none/,
  );
  const withDefault = apply("setFieldDefault", { model: "Order", field: "minutes", value: "60" });
  expect(
    apply("setFieldDefault", { model: "Order", field: "minutes", remove: true }, withDefault),
  ).toContain("      minutes: int\n");
  expect(refused("setFieldDefault", { model: "Order", field: "minutes" })).toMatch(
    /Say the default/,
  );
});

test("setFieldRange sets a number's bounds or a text's length, and none takes both away", () => {
  const ranged = apply("setFieldRange", { model: "Order", field: "minutes", min: 15, max: 240 });
  expect(ranged).toMatch(
    /minutes: \{ type: int, min: 15, max: 240 \}|minutes:\n\s+type: int\n\s+min: 15\n\s+max: 240/,
  );
  expect(
    apply("setFieldRange", { model: "Order", field: "minutes", none: true }, ranged),
  ).toContain("      minutes: int\n");
  expect(apply("setFieldRange", { model: "Order", field: "note", max: 80 })).toMatch(/max: 80/);
  expect(refused("setFieldRange", { model: "Order", field: "minutes", min: 10, max: 5 })).toMatch(
    /is above the largest/,
  );
  expect(refused("setFieldRange", { model: "Order", field: "minutes" })).toMatch(/Say min, max/);
});

test("setFieldRules numbers a whole-number field in turn, and stops", () => {
  const numbered = apply("setFieldRules", { model: "Order", field: "number", sequence: true });
  expect(numbered).toMatch(/sequence: true/);
  expect(
    apply("setFieldRules", { model: "Order", field: "number", sequence: false }, numbered),
  ).toContain("      number: int!\n");
});
