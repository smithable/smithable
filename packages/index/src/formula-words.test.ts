import { humanize, parseFormula } from "@smithable/core";
import { expect, test } from "vitest";
import { formulaInWords } from "./formula-words.js";

const words = (source: string) =>
  formulaInWords(parseFormula(source), (name) => humanize(name).toLowerCase());

test("formulas read as plain words", () => {
  expect(words("quantity * unitPrice")).toBe("the quantity times the unit price");
  expect(words("(price - discount) * quantity")).toBe(
    "(the price minus the discount) times the quantity",
  );
  expect(words('IF(AND(method = "standard", total > 100), 0, 5)')).toBe(
    "0 if the method is “standard” and the total is more than 100, otherwise 5",
  );
  expect(words("SUM(lines.amount)")).toBe("the total amount of its lines");
  expect(words("COUNT(orders)")).toBe("the number of its orders");
  expect(words("customer.creditLimit - total")).toBe(
    "the credit limit of the customer minus the total",
  );
});
