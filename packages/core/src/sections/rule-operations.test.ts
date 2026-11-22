import { expect, test } from "vitest";
import { parse } from "yaml";
import { applyOperation, type ProjectFiles } from "../apply.js";

// Rules as sentences on any concept (T1242 G1): added, given an id, and taken away.
const spec = `smithable: 0.1
app: { name: Shop }
models:
  Order:
    fields:
      total: money
      status: { type: draft | sent, default: draft }
pages:
  orders: { crud: Order }
`;
const files: ProjectFiles = { spec };

function ok(name: string, args: Record<string, unknown>, from: ProjectFiles = files) {
  const result = applyOperation(from, name, args);
  if (!result.ok) throw new Error(result.message);
  return result;
}
const refused = (name: string, args: Record<string, unknown>, from: ProjectFiles = files) => {
  const result = applyOperation(from, name, args);
  return result.ok ? "applied" : result.message;
};

test("addRule writes a sentence, or one with an id, on the app, a model or a page", () => {
  const app = ok("addRule", { concept: "app", rule: "Prices include VAT" });
  expect(parse(app.files.spec).app.rules).toEqual(["Prices include VAT"]);
  const model = ok("addRule", {
    concept: "model:Order",
    rule: "An order over 1000 EUR needs approval",
    id: "big-orders",
  });
  const twice = ok(
    "addRule",
    { concept: "model:Order", rule: "A sent order is not changed" },
    model.files,
  );
  expect(parse(twice.files.spec).models.Order.rules).toEqual([
    { id: "big-orders", rule: "An order over 1000 EUR needs approval" },
    "A sent order is not changed",
  ]);
  const page = ok("addRule", { concept: "page:orders", rule: "Staff only" });
  expect(parse(page.files.spec).pages.orders.rules).toEqual(["Staff only"]);
  expect(refused("addRule", { concept: "model:Ordr", rule: "x" })).toMatch(/model:Order/);
  expect(
    refused("addRule", { concept: "model:Order", rule: "Again", id: "big-orders" }, model.files),
  ).toMatch(/already has a rule with the id/);
});

test("a field's rule gives it the long form, and removing the last one gives the shorthand back", () => {
  const added = ok("addRule", { concept: "field:Order.total", rule: "Never negative" });
  expect(parse(added.files.spec).models.Order.fields.total).toEqual({
    type: "money",
    rules: ["Never negative"],
  });
  const removed = ok("removeRule", { concept: "field:Order.total", number: "1" }, added.files);
  expect(parse(removed.files.spec).models.Order.fields.total).toBe("money");
  // A choice keeps its default as its own key.
  const choice = ok("addRule", { concept: "field:Order.status", rule: "Sent is final" });
  const back = ok("removeRule", { concept: "field:Order.status", number: "1" }, choice.files);
  expect(parse(back.files.spec).models.Order.fields.status).toEqual({
    type: "draft | sent",
    default: "draft",
  });
});

test("removeRule takes one away by its place, and asks first for one with an id", () => {
  const two = ok(
    "addRule",
    { concept: "app", rule: "Second", id: "second" },
    ok("addRule", { concept: "app", rule: "First" }).files,
  );
  const first = ok("removeRule", { concept: "app", number: "1" }, two.files);
  expect(parse(first.files.spec).app.rules).toEqual([{ id: "second", rule: "Second" }]);
  expect(first.destructive).toBe(false);
  const last = ok("removeRule", { concept: "app", number: "1" }, first.files);
  expect(parse(last.files.spec).app.rules).toBeUndefined();
  expect(last.destructive).toBe(true);
  expect(refused("removeRule", { concept: "app", number: "3" }, two.files)).toMatch(
    /has 2 rule\(s\), not 3/,
  );
});

test("a rule is added below the others, their comments kept, and a default stays its own key", () => {
  const commented = spec
    .split("      status: { type: draft | sent, default: draft }\n")
    .join(
      "      status: { type: draft | sent, default: draft }\n      quantity: { type: int, default: 1 }\n    rules:\n      # agreed with sales\n      - First\n",
    );
  const added = ok("addRule", { concept: "model:Order", rule: "Second" }, { spec: commented });
  expect(added.files.spec).toContain("      # agreed with sales\n      - First\n      - Second\n");
  const withDefault = ok(
    "addRule",
    { concept: "field:Order.quantity", rule: "At least one" },
    { spec: commented },
  );
  const back = ok(
    "removeRule",
    { concept: "field:Order.quantity", number: "1" },
    withDefault.files,
  );
  expect(parse(back.files.spec).models.Order.fields.quantity).toEqual({ type: "int", default: 1 });
});
