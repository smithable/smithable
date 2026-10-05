import { expect, test } from "vitest";
import { applyOperation } from "../apply.js";
import { nameProblem } from "./names.js";

test("a name that fits its kind has no problem; one that does not gets the kind's rule", () => {
  expect(nameProblem("page", "my-bookings")).toBeUndefined();
  expect(nameProblem("field", "createdBy")).toBeUndefined();
  expect(nameProblem("model", "InvoiceLine")).toBeUndefined();
  expect(nameProblem("page", "Hello")).toBe(
    'Page name "Hello" must start with a lowercase letter and use only letters, digits and dashes, like "orders" or "my-bookings".',
  );
  expect(nameProblem("field", "phone number")).toContain("only letters and digits");
  expect(nameProblem("model", "customer")).toContain("must start with a capital letter");
});

test("an operation refuses a name in the same words", () => {
  const spec =
    "smithable: 0.1\napp: { name: T }\nmodels:\n  Customer: { fields: { name: string! } }\n";
  const refused = applyOperation({ spec }, "addPage", { page: "Hello", model: "Customer" });
  expect(refused).toMatchObject({ ok: false, message: nameProblem("page", "Hello") });
});
