import { expect, test } from "vitest";
import { camel, humanize, kebab, pascal, plural, snake, words } from "./naming.js";

test.each([
  ["creditLimit", ["credit", "limit"]],
  ["ClassType", ["class", "type"]],
  ["class-types", ["class", "types"]],
  ["invoice_lines", ["invoice", "lines"]],
  ["VATNumber", ["vat", "number"]],
])("words(%s)", (input, expected) => {
  expect(words(input)).toEqual(expected);
});

test("conversions", () => {
  expect(humanize("creditLimit")).toBe("Credit limit");
  expect(humanize("class-types")).toBe("Class types");
  expect(camel("class-types")).toBe("classTypes");
  expect(pascal("my-bookings")).toBe("MyBookings");
  expect(kebab("ClassType")).toBe("class-type");
  expect(snake("InvoiceLine")).toBe("invoice_line");
});

test.each([
  ["Customer", "Customers"],
  ["ClassType", "ClassTypes"],
  ["Category", "Categories"],
  ["Day", "Days"],
  ["Address", "Addresses"],
  ["Box", "Boxes"],
  ["Match", "Matches"],
])("plural(%s)", (input, expected) => {
  expect(plural(input)).toBe(expected);
});
